# Bench Swaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real, logged, coach-like substitutions in the game sim, shown in Watch mode as swaps into specific slots, with the bench card = everyone currently sitting.

**Architecture:** A pure, RNG-free `chooseSubs` decides up to 2 swaps per game-minute from game state (stint length, minutes plan, slot fit, blowout/clutch). `simGame` keeps a slot-ordered `onCourt`, applies swaps, and logs `lineup` + `sub` events. The replay model derives `court` from those events; the watch UI renders slot-keyed cards and a sitting-players bench card; the quarter-break bench row expands to all non-starters.

**Tech Stack:** React + TypeScript + Vite, Vitest. Engine is pure TS (no React/DOM/`Math.random`).

**Spec:** `docs/superpowers/specs/2026-11-23-bench-swaps-design.md`

## Global Constraints
- No fatigue effect on performance anywhere (spec non-goal).
- Sub logic uses **no RNG**; ties broken by `Ctx.ids` order. Game results are allowed to shift; realism tests are re-tuned, not loosened without justification.
- Max **2 swaps per side per game-minute**; never fewer than 5 on court; a swap replaces exactly one player.
- Blowout: margin ≥ 20 in Q4 (≥ 25 in Q3) rests starters; starters return if margin < 12. Clutch: last 4 minutes of Q4/OT with |margin| ≤ 8 → no resting swaps.
- Q1 and Q3 open with the starters (Q3 keeps the current lineup if |margin| ≥ 25); Q2/Q4 continue the previous lineup.
- Save format (`League` v4) and `BoxLine` unchanged; no migration.
- Legacy logs (no `lineup` event) render as today: starters + one lump bench.
- Ship per CLAUDE.md: `npm test` + `npm run typecheck` green, commit, merge into `main`, push, confirm "Deploy to GitHub Pages" run is green.

## Review Focus
1. Overtime games: lineup carries into OT, `minutesTargets` recomputed, subs keep working, no crash (Task 3).
2. A side with a short bench (injuries leave only 5–6 healthy): no swaps possible, no crash, still 5 on court (Task 3).
3. Blowout that tightens back up: starters return (Task 2).
4. Player subbed out and back in within one watched batch (skip/4× speed): `finalState` court equals the true end-of-game lineup, and shot FX anchor to the right card (Tasks 4, 5).
5. Legacy log with no `lineup`/`sub` events: identical to today's UI (Tasks 4, 5).

## File Structure
- Create `src/engine/sim/subs.ts` — pure sub decision (`chooseSubs`).
- Modify `src/engine/sim/playlog.ts` — `lineup`/`sub` event types; `boxFromLog` guard.
- Modify `src/engine/sim/game.ts` — slot-ordered court, minute-level sub step, event emission.
- Modify `src/ui/watch/replay.ts` — `court` in `ReplayState`, legacy fallback, helpers.
- Modify `src/ui/watch/WatchGame.tsx`, `WatchCard.tsx`, `QuarterBreak.tsx`, `watch.css`.
- Tests: create `tests/engine/subs.test.ts`; extend `tests/engine/playlog.test.ts`, `tests/engine/game.test.ts`, `tests/ui/replay.test.ts`; create `tests/ui/quarterBreak.test.tsx` only if the project already renders components in tests (otherwise test the pure row-builder in Task 6).

---

### Task 1: Log event types

**Files:** Modify `src/engine/sim/playlog.ts`; Test `tests/engine/playlog.test.ts`

**Interfaces:**
- Produces, added to the `PlayEvent` union:
  - `{ k: 'lineup'; side: Side; players: string[] }` (slot order PG,SG,SF,PF,C)
  - `{ k: 'sub'; side: Side; out: string; in: string; slot: number }`

- [ ] **Step 1: Write failing test** in `playlog.test.ts`: `it('boxFromLog and quartersFromLog ignore lineup and sub events')` — hand-build a log `[lineup, sub, fg made 2pts by 'a', periodEnd]` and assert `boxFromLog(log)` equals `{ a: pts 2, fgm 1, fga 1, rest 0 }` with no key for the subbed ids, and `quartersFromLog` still returns the one period.
- [ ] **Step 2: Run** `npx vitest run tests/engine/playlog.test.ts` — expect FAIL (type/runtime error reading `e.player`).
- [ ] **Step 3: Add the two union members; in `boxFromLog` skip `lineup` and `sub` (alongside `periodEnd`).** To keep typecheck green, also skip both kinds in `describePlays` (`continue`) and `apply` in `replay.ts` (`case 'lineup': case 'sub': break`).
- [ ] **Step 4: Run** `npx vitest run tests/engine/playlog.test.ts tests/ui/replay.test.ts` and `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(log): lineup and sub play events`.

---

### Task 2: Coach sub logic

**Files:** Create `src/engine/sim/subs.ts`; Test `tests/engine/subs.test.ts`

**Interfaces:**
- Consumes: `SLOTS`, `slotFit` from `rotation.ts`; `Player` type.
- Produces:
```ts
export interface SubInput {
  period: number            // 1-based; 5+ = OT
  minuteInPeriod: number    // 0-based minute about to be played
  periodMinutes: number     // 12 or 5
  elapsed: number           // game minutes already played (all periods)
  gameMinutes: number       // 48 + 5·OT periods so far (plan horizon)
  margin: number            // this side's score minus the opponent's
  onCourt: string[]         // slot order, length 5
  sitting: string[]         // active players not on court, roster order
  stint: Record<string, number>   // consecutive minutes on court (0 when sitting)
  played: Record<string, number>
  target: Record<string, number>  // full-game minutes plan
  starters: string[]
  players: Record<string, Player>
}
export interface Swap { slot: number; out: string; in: string }
export function chooseSubs(i: SubInput): Swap[]   // 0–2 swaps, no RNG
```

Rules (from spec): *out score* = minutes the stint exceeds `allowance = 7 + 6·(stam/99)`, plus minutes `played` is ahead of `target·elapsed/gameMinutes`; *in score* = minutes owed vs plan plus `slotFit(in, slot)/10` so adjacent positions win; swap the best pair when combined score > threshold (start at 2.0, tune in Task 3); a player at the 48(+5·OT) cap is always a forced out; blowout/clutch rules from Global Constraints (blowout lowers starters' allowance to 3 and adds +4 owed to non-starters; clutch returns only forced-cap swaps).

- [ ] **Step 1: Write failing tests** in `subs.test.ts` using `generatePlayer` fixtures (pattern: `cloneTeam` in `tests/engine/game.test.ts`):
  - `it('rests a starter with a long stint and brings in the best-fitting sitter')` — PG on court 12 straight minutes, sitters = one PG backup + one C; assert one swap `{ slot: 0, out: pg, in: backupPg }`.
  - `it('prefers an adjacent position over a better but distant one')` — SG tired; sitters PG (adjacent) and C (higher OVR); asserts the PG comes in.
  - `it('never makes more than 2 swaps and keeps 5 distinct on court')`.
  - `it('blowout rests starters, and brings them back when the margin falls under 12')` — margin +22 in period 4 ⇒ starters swapped out; margin +8 ⇒ a sitting starter swaps back in.
  - `it('clutch: close game in the last 4 minutes makes no resting swaps')` but still swaps a player at the minutes cap.
  - `it('returns [] when nobody is sitting')`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/subs.test.ts` — FAIL (module missing).
- [ ] **Step 3: Implement `chooseSubs`** per the rules above. Deterministic: iterate in array order, strict `>` comparisons.
- [ ] **Step 4: Run** the file — PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(sim): coach substitution logic`.

---

### Task 3: Wire into `simGame`

**Files:** Modify `src/engine/sim/game.ts` (`Ctx`, `makeSide`, `chooseFive` → removed, `runPeriod`); Test `tests/engine/game.test.ts`, `tests/engine/playlog.test.ts`

**Interfaces:**
- Consumes: `chooseSubs`, `SubInput`, `Swap` (Task 2); `lineup`/`sub` events (Task 1).
- Produces: logs `lineup` (both sides, `t=0`, period 1, starters in slot order) and `sub` events; `Ctx.onCourt` is slot-ordered and always paired with `courtPenalties(..., true)`.

- [ ] **Step 1: Write failing tests:**
  - `it('logs a lineup per side and replaying subs always leaves 5 distinct players')` (playlog.test, 100 games): apply `sub` events to the `lineup` arrays; after each event assert length 5, all distinct, `out` was on court and `in` was not.
  - `it('most swaps are same or adjacent position')` — over 100 games, share of subs with `|SLOT_IDX[in.pos] - slot| ≤ 1` ≥ 0.7.
  - `it('blowouts rest starters')` (game.test): lopsided matchup (target OVR 88 vs 55 via `cloneTeam`), averaged over 40 games, winner starters' mean minutes < their `minutesTargets` mean by ≥ 2.
  - `it('minutes stay near plan')`: every player's minutes within 6 of `minutesTargets` on average over 100 games, and each side's minutes sum is exactly 240+25·OT.
  - `it('short bench and overtime do not crash')`: team with exactly 5 healthy players (others `injury` set) still sims; find an OT game by looping seeds and assert it completes with `box` minutes summing correctly.
  - Keep `does not change results` (log vs no log) passing — the sub step must not consume RNG or depend on `log`.
- [ ] **Step 2: Run** `npx vitest run tests/engine` — new tests FAIL.
- [ ] **Step 3: Implement.** `Ctx` gains `stint: Record<string, number>`, `sitting()` derived. Replace `chooseFive`: at period start set the opening five (Q1, Q3 per Global Constraints — diff against the current lineup and emit `sub` events for changed slots at `t=0`); Q2/Q4/OT keep the lineup. At the start of each game-minute (except the opening minute of Q1/Q3) call `chooseSubs` per side with the current score margin, apply swaps, emit `sub`, then play the minute: `played += 1`, `stint++` for on-court, `stint = 0` for sitters. `emit` already handles `t` via `possInPeriod`. Remove the `same ? ... : re-slotted` logic: penalties are always slot-pinned.
- [ ] **Step 4: Run** `npx vitest run` (whole suite). Expected: new tests PASS; some realism/season tests may drift. Re-tune the Task 2 thresholds (allowance, swap threshold) — not the test tolerances — until realism tests pass; if a tolerance genuinely must move, note why in the commit message.
- [ ] **Step 5: Run** `npm run typecheck` — PASS. **Commit** `feat(sim): in-game coach substitutions`.

---

### Task 4: Replay court model

**Files:** Modify `src/ui/watch/replay.ts`; Test `tests/ui/replay.test.ts`

**Interfaces:**
- Consumes: `lineup`/`sub` events.
- Produces:
```ts
export interface ReplayState { …existing; court: Record<Side, string[]> | null }  // null = legacy log
export function sittingIds(all: string[], court: string[]): string[]
export function courtCard(state: ReplayState, side: Side, playerId: string): number | null  // slot index or null
```
`initState()` sets `court: null`; `advanceTo` sets it from `lineup`, then applies `sub` events in order, immutably.

- [ ] **Step 1: Write failing tests:**
  - `it('court is built from lineup and sub events and matches the final lineup')` — for 50 games, `finalState(log).court` equals replaying events by hand; each side length 5.
  - `it('legacy logs (no lineup) leave court null')` — filter `lineup`/`sub` out of a log.
  - `it('advanceTo stays immutable across subs')` — previous state's `court` arrays are not mutated.
  - `it('sittingIds returns everyone not on court in input order')`.
  - `it('courtCard resolves the slot at each point in the log')`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/replay.test.ts` — FAIL.
- [ ] **Step 3: Implement** the interface; copy arrays on `sub` (`slot` replaces `out` with `in`).
- [ ] **Step 4: Run** the file + `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(watch): replay tracks who is on the court`.

---

### Task 5: Watch cards and swap animation

**Files:** Modify `src/ui/watch/WatchGame.tsx`, `src/ui/watch/WatchCard.tsx`, `src/ui/watch/watch.css`; Test: pure helper tests in `tests/ui/replay.test.ts`

**Interfaces:**
- Consumes: `ReplayState.court`, `sittingIds`, `courtCard` (Task 4).
- Produces: `cardIdFor(state: ReplayState, side: Side, id: string, matchup): string` (slot card id `"${side}-slot-${i}"`, else `bench-${side}`; legacy fallback to today's `cardOf`) and `describeSub(e, last): string` → `🔁 {in} in for {out}` (exported from `replay.ts`, used by `describePlays`' caller in `onFired`).

- [ ] **Step 1: Write failing tests:** `describeSub` returns `🔁 Garcia in for Lee`; `cardIdFor` anchors a shooter to the slot where he stands in a mid-batch state and to `bench-…` when sitting; legacy state returns the old mapping.
- [ ] **Step 2: Run** `npx vitest run tests/ui/replay.test.ts` — FAIL.
- [ ] **Step 3: Implement.** `row(side)` renders five cards keyed by slot id from `rs.court[side]` (occupant's live `pts/reb/ast/hot`), plus the bench card from `benchLine(rs, sittingIds(allIds[side], court))` with `benchCount = sitting.length`; legacy (`court === null`) keeps today's rendering. `animate()` resolves each event's card with `cardIdFor` against a court state advanced event-by-event within the batch (keep a local copy of `prev.court` and apply `sub`s as you iterate). On a `sub`, add a short CSS class animation on that slot card (`.w-card.swap`, skipped under `reducedMotion()`) and set the feed text via `describeSub` when no hot callout is holding the feed. `sheetTeam` must work for non-starters (look up by team of the player, not `m.starters`). `WatchCard` aria-label unchanged for players.
- [ ] **Step 4: Run** `npx vitest run` and `npm run typecheck`. Then `npm run dev` and watch a game: confirm swaps appear, the bench card number changes, shots fly from the right cards, Skip to final works. (If you cannot drive a browser, say so rather than claiming it was checked.)
- [ ] **Step 5: Commit** `feat(watch): slot cards, swap animation, bench = sitting`.

---

### Task 6: Quarter-break bench expansion, then ship

**Files:** Modify `src/ui/watch/QuarterBreak.tsx`, `src/ui/watch/WatchGame.tsx` (`breakView`), `src/ui/watch/watch.css`; Test `tests/ui/replay.test.ts` (or the new component test file)

**Interfaces:**
- Consumes: `m.bench[side]` (all `gs=false` players for the side — role-based, not court-based), `lineOf`.
- Produces: `RecapRow` gains `children?: RecapRow[]` (non-starter rows, each with `playerId`); `QuarterBreak` renders a bench row as a toggle button (`aria-expanded`) that reveals the children rows; the bench row's own totals are the sum of **all non-starters** (not just sitting).
  - `export function recapRows(...)`? Only if needed to test: extract the row-building from `breakView` into `recapRows(m, rs, side, favs): RecapRow[]` in `WatchGame.tsx`'s module or a new `src/ui/watch/recap.ts`, and test that.

- [ ] **Step 1: Write failing test** for `recapRows`: starters rows in order, then a bench row whose `children` are exactly the `gs=false` players (including one who is on court in `rs.court`), and a starter who is sitting stays in the starters rows, not the bench.
- [ ] **Step 2: Run** the test file — FAIL.
- [ ] **Step 3: Implement** the extraction and the expandable bench row (one tap from the recap; tapping a child opens the player sheet via `onPick`; keep the existing focus-on-next-button behavior untouched).
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` and `npm run build` — all green.
- [ ] **Step 5: Ship per CLAUDE.md.** Commit on the working branch and push; fast-forward/merge into `main`, `git push origin main`; check the "Deploy to GitHub Pages" workflow run is green (fix and re-push if not); report to the owner that the site is updated.
