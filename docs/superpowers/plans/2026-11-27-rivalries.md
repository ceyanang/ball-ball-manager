# Rivalries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every team 2 fixed + up to 2 heat-driven rivals; rival games get volatile, vets burst / new guys struggle, fans and morale swing harder, and good-performing new guys can earn a small POT bump.

**Architecture:** A pure-TS `src/engine/rivals/` module owns data, heat, rival lookup and the dynamic draw. Heat is added from `onSeriesDecided` and cooled/redrawn in `onNewSeason`. The sim sees rivalry only through a new optional `GameMods.volatility` (per-player tilt), so non-rival games stay bit-identical. Save bumps v12 → v13.

**Tech Stack:** TypeScript, Vitest, React/Vite (UI), IndexedDB saves.

**Spec:** `docs/superpowers/specs/2026-11-27-rivalries-design.md`

## Global Constraints
- Engine is pure TS: no React/DOM/`Math.random`; use `Rng`. Story randomness uses `storyRng(l, salt)` so game results never shift.
- Volatility is a temporary `GameMods` field, never a rating edit.
- Save is `League` version 13 after this work; JSON-serializable; migration from 12 required.
- Heat per series decided: Finals (round 4) +40, conference finals (round 3) +20, any earlier round +6. Cooling each season: ×0.7, ×0.5 for pairs that did not meet that year; drop values < 1.
- Dynamic rivals: up to 2 per team, drawn at season rollover, weighted by heat, minimum heat 15, never a starting rival or self.
- Vet = 3+ seasons with the team (tilt +1); new = ≤ 1 season with the team (tilt −1); otherwise 0.
- Rival-game swing: fans and morale ×1.5. Rival-game POT bump: only for tilt −1 players, rolled in the offseason.
- Before calling work done: `npm test` and `npm run typecheck` pass; then ship per `CLAUDE.md` (merge to `main`, push, confirm Deploy workflow is green).

## Review Focus
- A rival pair that has never met / empty `rivalry.heat` must not crash and gives no dynamic rivals.
- Old saves (v12) load, and a v13 save with partially missing rivalry keys is tolerated.
- Non-rival games must produce byte-identical results to before (RNG stream untouched).
- A team with a stale/removed dynamic rival id (team ids are fixed, but players retire) must not break `rivalsOf`.
- Rival games between two AI teams get volatility too (not only the user's games).
- A player with no stat lines (fresh rookie, FA signing) must get tilt −1 without errors.

---

### Task 1: Rival data, state, and save v13

**Files:**
- Create: `src/engine/rivals/data.ts`, `src/engine/rivals/state.ts`
- Modify: `src/engine/types.ts` (League), `src/engine/league/create.ts` (~line 174), `src/save/migrate.ts`, `tests/save/db.test.ts:35`
- Test: `tests/engine/rivals.data.test.ts`, `tests/save/rivalryMigration.test.ts`

**Interfaces:**
- Produces: `STARTING_RIVALS: Record<string /*abbrev*/, [string, string]>`; `interface RivalryState { heat: Record<string, number>; dynamic: Record<string, string[]>; showing: Record<string, number>; met: string[] }`; `emptyRivalry(): RivalryState`; `League.rivalry: RivalryState`; `League.version: 13`.

- [ ] **Step 1: Write failing tests.** `rivals.data.test.ts`: every PARODY_TEAMS abbrev has an entry; each entry has 2 distinct abbrevs, neither itself, both valid; `STARTING_RIVALS.CLE` contains `'GSW'` and `STARTING_RIVALS.LAF` contains `'LAK'`. `rivalryMigration.test.ts` (style of `tests/save/heritageMigration.test.ts`): JSON-clone a `createLeague` league, set `version = 12`, delete `rivalry`, `migrateLeague` → `version === CURRENT_VERSION (13)` and `rivalry` equals `{ heat: {}, dynamic: {}, showing: {}, met: [] }`; also `createLeague` output has that `rivalry`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/rivals.data.test.ts tests/save/rivalryMigration.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** `data.ts` with this exact table (abbrev → rivals): ATL: MIA, CHA · BOS: NYK, PHI · BKN: NYK, PHI · CHA: ATL, WAS · CHI: MIL, DET · CLE: GSW, DET · DET: CHI, CLE · IND: CHI, MIL · MIA: ORL, ATL · MIL: CHI, MIN · NYK: BKN, BOS · ORL: MIA, ATL · PHI: BOS, NYK · TOR: DET, BOS · WAS: PHI, CHA · DAL: HOU, SAS · DEN: UTA, MIN · GSW: CLE, LAK · HOU: DAL, SAS · LAF: LAK, GSW · LAK: LAF, GSW · MEM: NOP, OKC · MIN: MIL, DEN · NOP: HOU, MEM · OKC: DAL, MEM · PHX: LAK, UTA · POR: SAC, DEN · SAC: GSW, POR · SAS: HOU, DAL · UTA: DEN, PHX. Team ids are `'t_' + abbrev.toLowerCase()`. `state.ts` exports `RivalryState` and `emptyRivalry`. Add `rivalry: RivalryState` and bump `version: 13` in `types.ts`; set both in `createLeague`. In `migrate.ts`: `CURRENT_VERSION = 13`, add `if (raw?.version === 12) raw = { ...raw, version: 13, rivalry: emptyRivalry() }`, and after the version check default a missing/partial `rivalry` to `emptyRivalry()` shape-wise (`heat`, `dynamic`, `showing` each default `{}`, `met` defaults `[]`). In `tests/save/db.test.ts` change the "wrong version" fixture from `version: 13` to `version: 99`.
- [ ] **Step 4: Run** the two new tests plus `npx vitest run tests/save` → PASS.
- [ ] **Step 5: Commit** `feat(rivals): rival data, state, save v13`.

### Task 2: Rivalry engine (heat, lookup, dynamic draw)

**Files:**
- Create: `src/engine/rivals/rivalry.ts`
- Test: `tests/engine/rivals.engine.test.ts`

**Interfaces:**
- Consumes: `STARTING_RIVALS`, `RivalryState` (Task 1); `storyRng`, `clamp` from `../stories/state`.
- Produces (all in `rivalry.ts`):
  - `pairKey(a: string, b: string): string` (sorted ids joined with `'|'`)
  - `RIVAL = { heat: { finals: 40, confFinals: 20, series: 6 }, minHeat: 15, cool: 0.7, coolNoMeet: 0.5, fanSwing: 1.5, moraleSwing: 2 }`
  - `startingRivals(teamId: string): string[]`
  - `rivalsOf(l: League, teamId: string): string[]` (starting + stored dynamic, unique, only existing team ids)
  - `isRivalGame(l: League, g: Pick<Game, 'homeId' | 'awayId'>): boolean` (either team lists the other)
  - `addSeriesHeat(l: League, s: Series): void` — decided series only; loser/winner pair gets the round's heat; records that the pair met this season (use `rivalry.heat` plus a transient set returned/stored — implementer chooses; cooling must know "met this year", so also push the pair key onto `rivalry.met`, cleared at rollover; `met` is already part of `RivalryState` from Task 1).
  - `rolloverRivalry(l: League): void` — cool heat, drop < 1, clear `met`, redraw `dynamic` for every team via `storyRng(l, 71)`.

- [ ] **Step 1: Write failing tests** (build a league with `createLeague({ seed: 3, userTeamIndex: 0, name: 'R' })`): `pairKey('b','a') === pairKey('a','b')`; `rivalsOf` for `t_cle` includes `t_gsw`; `addSeriesHeat` on a decided round-4 series adds 40 to that pair, round 3 adds 20, round 1 adds 6; undecided series adds nothing; `rolloverRivalry` multiplies a met pair by 0.7 and an unmet pair by 0.5 and drops values below 1; after giving a pair heat 60 `rolloverRivalry` can include it in `dynamic` (assert across a few seeds that it is picked when it is the only hot pair), never picks heat < 15, never picks a starting rival, never more than 2; same league state twice gives identical `dynamic` (determinism); `isRivalGame` true for CLE–GSW, true when only one side lists the other, false for unrelated pair; empty `heat` gives `dynamic` all `[]`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/rivals.engine.test.ts` → FAIL.
- [ ] **Step 3: Implement** the signatures above in `rivalry.ts`. Draw: per team, candidates = other teams with heat ≥ minHeat, not self, not in `startingRivals` of either side; weighted-without-replacement by heat using `storyRng(l, 71)` (one rng for the whole pass, teams iterated in id order for determinism), up to 2.
- [ ] **Step 4: Run** tests → PASS, then `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(rivals): heat, rival lookup, dynamic draw`.

### Task 3: Wire heat and rollover into the season loop

**Files:**
- Modify: `src/engine/stories/hooks.ts` (`onSeriesDecided` ~line 45, `onNewSeason` ~line 129)
- Test: `tests/engine/rivals.hooks.test.ts`

**Interfaces:**
- Consumes: `addSeriesHeat`, `rolloverRivalry` (Task 2).
- Produces: nothing new; behavior only. When `rolloverRivalry` creates a new dynamic rival for the **user's** team, add one news item (`addNews`, `kind: 'award'`, `emoji: '🔥'`, `title: '<City> <Name> are becoming rivals'` style text, `teamIds` both, `weight: 6`) — compare `dynamic` before/after inside `onNewSeason`.

- [ ] **Step 1: Write failing test:** simulate a full season with `simDays` (pattern from `tests/engine/season.test.ts`) and assert `league.rivalry.heat` has an entry for the Finals pair with value ≥ 40 right after the Finals end; then advance into the next season and assert that value ≈ 40 × 0.7 (or 0.5 — it met, so 0.7) and `met` is empty. Second test: a user-team new dynamic rival produces a news item.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement:** in `onSeriesDecided` call `addSeriesHeat(l, s)` for each newly decided series (alongside the existing `seriesNews`); in `onNewSeason` call `rolloverRivalry(l)` first, then the news step.
- [ ] **Step 4: Run** the new test and `npx vitest run tests/engine/season.test.ts tests/engine/stories.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(rivals): heat from series, rollover each season`.

### Task 4: Sim volatility with vet/new-guy tilt

**Files:**
- Modify: `src/engine/events/mods.ts`, `src/engine/sim/game.ts` (~line 745 `runPeriod`), `src/engine/stories/sentiment.ts` (export a tenure helper)
- Create: `src/engine/rivals/tilt.ts`
- Test: `tests/engine/rivals.sim.test.ts` (and keep `tests/engine/events.mods.test.ts` green)

**Interfaces:**
- Consumes: `isRivalGame`, `RIVAL` (Task 2).
- Produces:
  - `GameMods.volatility?: Record<string, number>` — player id → tilt −1 | 0 | 1 (optional so existing `empty()` fixtures stay valid).
  - `seasonsWithTeam(l: League, playerId: string, teamId: string): number` exported from `sentiment.ts` (same logic as `scanCareers().seasonsWith`, but for one player; 0 when no stat lines).
  - `rivalTilt(l: League, p: Player, teamId: string): -1 | 0 | 1` in `tilt.ts` (≥3 seasons → 1, ≤1 → −1, else 0).
  - `buildMods(l, g)` now returns volatility for **any** rival game (user or AI); user events/chemistry still only for the user's games. "Empty" check includes `volatility`.
  - `K.rivalSd = 0.03`, `K.rivalTilt = 0.015` (probability units) in `sim/game.ts`.

- [ ] **Step 1: Write failing tests** (pattern `tests/engine/events.mods.test.ts`): (a) `simGame` with `mods` undefined vs `{...empty, volatility: {}}` stays bit-identical; (b) with `volatility` set for the whole roster to +1, mean points of that roster over 200 games > mean with −1 (same seeds); (c) a game with tilt 0 volatility has higher box-score variance (stddev of team points) than no mods; (d) `buildMods` for an AI-vs-AI rival game returns `volatility` with an entry for every rostered player and undefined for an AI-vs-AI non-rival game; (e) `rivalTilt`: a player with 3+ seasons of stat lines for the team → 1, a freshly signed player → −1, 2 seasons → 0.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** In `runPeriod` (where `qOffMod[id] = rng.normal(0, prof[id].offSpread)` is set) add, only when `mods?.volatility?.[id] !== undefined`: `qOffMod[id] += rng.normal(tilt * K.rivalTilt, K.rivalSd)` — extra rng draws happen only in rival games, so other games are unaffected. In `buildMods`, restructure so the `isUserGame` early return only guards events/chemistry; compute `volatility` for both rosters when `isRivalGame`.
- [ ] **Step 4: Run** `npx vitest run tests/engine/rivals.sim.test.ts tests/engine/events.mods.test.ts tests/engine/game.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(rivals): rival-game volatility, vets burst and new guys struggle`.

### Task 5: Bigger fan and morale swings in rival games

**Files:**
- Modify: `src/engine/stories/sentiment.ts` (`updateFans`, ~line 149)
- Test: `tests/engine/rivals.fans.test.ts`

**Interfaces:**
- Consumes: `isRivalGame`, `RIVAL.fanSwing`, `RIVAL.moraleSwing`.
- Produces: no new exports.

- [ ] **Step 1: Write failing test:** clone a league, play the same decided game result through `updateFans` twice — once where the pair is rivals (set via `rivalry.dynamic`), once not — and assert the winner's `fans.teams` delta is ×1.5 (rounded) larger in the rival case and a rotation player with ≥6 minutes gets `morale` +2 (winner) / −2 (loser), clamped 0–100; non-rival leaves morale untouched.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement:** multiply the player `perf` swing (the `clamp(perf,-1,1) * 15` term) and the team `swing` by `RIVAL.fanSwing` when `isRivalGame`; add the ±`moraleSwing` nudge for players with `b.min >= 6`.
- [ ] **Step 4: Run** new test + `npx vitest run tests/engine/stories.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(rivals): rival games swing fans and morale harder`.

### Task 6: "Rival showing" tally and offseason POT bump

**Files:**
- Modify: `src/engine/stories/hooks.ts` (`afterGame`, `onBreakout`), `src/engine/gm/offseason.ts` (`startOffseason`, near the breakout code ~line 165)
- Test: `tests/engine/rivals.pot.test.ts`

**Interfaces:**
- Consumes: `rivalTilt`, `isRivalGame`, `breakoutBump(p, rng)` from `src/engine/gm/training.ts`, `expectedGameScore`/`gameScore` as used in `updateFans`.
- Produces: `onBreakout(l, p, potFrom, cause?: 'rival')` — when `cause === 'rival'` the news says the player "stepped up in the rivalry games" and no "development program" ping unless the player is on the user's team (then ping with rival wording). `RIVAL.showingMin = 2`, `RIVAL.bumpChancePerShowing = 0.08`, cap 0.3.

- [ ] **Step 1: Write failing tests:** after an `afterGame` for a rival game, a tilt −1 player whose game score beats `expectedGameScore(ovr, min)` gets `rivalry.showing[id] += 1`; a tilt +1 / 0 player and non-rival games add nothing. In `startOffseason` with `rivalry.showing[id] = 3` and a seeded `rng`, over many seeds the bump happens in roughly `min(0.3, 0.08*3)` of runs and raises `pot` by `breakoutBump`, never above 99; `showing` is cleared after every offseason; players with showing < 2 never get a bump.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** both steps; the offseason roll goes in the per-player loop of `startOffseason` after the existing user/CPU slot breakout code, calling `onBreakout(l, p, potFrom, 'rival')` on success, then clearing `l.rivalry.showing` after the loop.
- [ ] **Step 4: Run** new test + `npx vitest run tests/engine/offseasonDev.test.ts tests/engine/progress.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(rivals): rival showing tally and POT bump for new guys`.

### Task 7: UI — rivals on team page, rivalry tag on games

**Files:**
- Create: `src/ui/rivals.ts` (pure helper `rivalLabel`)
- Modify: `src/ui/screens/TeamPage.tsx`, `src/ui/screens/Schedule.tsx`
- Test: `tests/ui/rivals.test.ts`

**Interfaces:**
- Consumes: `rivalsOf`, `isRivalGame` (Task 2).
- Produces: `rivalLabel(l: League, teamId: string, otherId: string): 'starting' | 'dynamic' | null` — `'starting'` if in `startingRivals(teamId)`, `'dynamic'` if only in stored dynamic, else null.

- [ ] **Step 1: Write failing test** for `rivalLabel` (CLE→GSW `'starting'`; a team given a dynamic rival `'dynamic'`; unrelated `null`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the helper; add a "Rivals" panel on `TeamPage` (below the header, above Roster) listing each rival with `TeamBadge`, name linking to `/teams/<id>` as the app already does for teams, and a small "🔥 new" tag for dynamic ones; add a "🔥 Rivalry" badge in the `Schedule` game row when `isRivalGame` (reuse the existing badge/`muted` styling there).
- [ ] **Step 4: Run** `npx vitest run tests/ui/rivals.test.ts`, `npm run typecheck`, `npm run build` → all pass. Then `npm run dev`, open a team page and the schedule and confirm the Rivals panel and tags render (report what you saw).
- [ ] **Step 5: Commit** `feat(rivals): rivals panel on team page, rivalry tag on schedule`.

### Task 8: Docs and ship

**Files:**
- Modify: `CLAUDE.md` (save format line → version 13, add one bullet on rivalries), spec status line to "implemented".

- [ ] **Step 1:** Update `CLAUDE.md`: "Save format is `League` (version 13)"; add bullet: rivalries live in `src/engine/rivals/` (data, heat, rivalry, tilt), enter the sim only via `GameMods.volatility`, state in `League.rivalry`.
- [ ] **Step 2:** Run `npm test` and `npm run typecheck` — both must be green; fix anything red.
- [ ] **Step 3:** Commit, push the working branch, merge into `main`, `git push origin main`, confirm the "Deploy to GitHub Pages" run finishes green (per `CLAUDE.md`), then report the site is updated.
