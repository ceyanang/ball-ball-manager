# Game Day Watch Mode + Playoff Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user watch their own games quarter by quarter as a replay of the real result, and give the playoffs a bracket-first hub on Home.

**Architecture:** `simGame` gains an optional play log that it fills without touching the RNG. A new `watchDay` sim (engine + worker command) plays one day exactly like `simDays(1)` and hands back the user's game log. The store keeps a `watch` session (log + the pre-game league); while it is set, the Shell shows the full-screen `WatchGame` instead of the app. Replay math lives in a pure TS module so it can be unit tested; React components only draw it. The playoff hub reuses the existing bracket, extracted into a component.

**Tech Stack:** React 19 + TypeScript + Vite, zustand store, Web Worker sims, Vitest (pure-TS tests only; no React testing library in the repo).

**Spec:** `docs/superpowers/specs/2026-11-23-game-day-watch-mode-design.md` (read it with this plan). Mockup: https://claude.ai/artifact/QXs16a95SQHYHSECp34dKm

## Global Constraints

- Engine code (`src/engine/`) stays pure TS: no React, DOM or `Math.random`; randomness only through `Rng`.
- Watching never changes results: `simGame` with and without a log must consume identical RNG draws and return identical `GameResult`s; `watchDay` must produce the same `League` as `simDays(league, 1, opts)`.
- Every number shown in watch mode comes from the log; replaying the whole log equals the saved box score exactly.
- No spoilers: while a watch session is open, the rest of the app is not rendered. The player-page link appears only on the final recap.
- The play log is never saved (lives only in the store's watch session).
- Save: `League.version` becomes `5`; v4 → v5 migration adds `favoritePlayerIds: []`.
- Quarter = `15000` ms of real time at 1×; OT period = `15000 * 5 / 12` ms. Speeds: 1, 2, 4.
- Hot streak: `pts >= ppg * elapsedFraction + 8 && pts >= 10`, where `elapsedFraction` is game time elapsed / 48 min (OT counts past 1); skipped when the player has no average yet. One feed line the moment he passes his season average: `🔥 {First Last} already has {pts}. He averages {ppg}.`
- Free throws animate: one short, flatter ball per attempt, a beat apart, "+1" on makes, feed `🎯 {Last} at the line: {made}/{att}`.
- `prefers-reduced-motion`: no flying balls or pops; numbers and feed still update.
- After all tasks: `npm test` and `npm run typecheck` pass, then ship per `CLAUDE.md` (push branch, merge to `main`, check the Pages deploy is green).

## Review Focus

1. **Overtime games** — periods 5+ must replay as "OT", "2OT" with a break before each; the final equals the box score. (Test in Task 1 and Task 3.)
2. **Skip to final at any moment** (mid-quarter, during a break, before Q1) — the recap must show the exact final box, never a partial one. (Test in Task 3: `finalState` equals full-replay state.)
3. **The day that changes phase** — the last regular-season day or a Finals clincher moves the league to playoffs/offseason in the sim. Watch mode must read records, series and averages from the pre-game league and still find its game. (Test in Task 2.)
4. **No average yet** — first game of a season, a rookie, a player's first playoff game: no hot glow, "on pace" shows without the "vs his average" part, nothing divides by zero. (Test in Task 3.)
5. **No user game today** — off day, eliminated, or waiting on another series: no Watch button; `watchDay` behaves like Sim day and returns `watch: null`. (Test in Task 2.)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/sim/playlog.ts` (new) | `PlayEvent` type + `boxFromLog()` helper (used by tests and the replay) |
| `src/engine/sim/game.ts` (modify) | optional `log` param, push events, period `t` normalisation |
| `src/engine/season/advance.ts` (modify) | `watchDay()`, `simUntil(..., 'seriesEnd')`, capture hook in `stepDay`/`playGame` |
| `src/engine/types.ts`, `src/engine/league/create.ts`, `src/save/migrate.ts` (modify) | version 5 + `favoritePlayerIds` |
| `src/worker/protocol.ts`, `simWorker.ts`, `client.ts` (modify) | `watchDay` command, `runWatch()` |
| `src/ui/store.ts` (modify) | `watch` session, `startWatch()`, `endWatch()`, `toggleFavorite()` |
| `src/ui/watch/replay.ts` (new) | pure replay model: timeline, live lines, score, hot, on-pace, recap standout |
| `src/ui/watch/WatchGame.tsx`, `WatchCard.tsx`, `QuarterBreak.tsx`, `WatchPlayerSheet.tsx`, `watch.css` (new) | the watch screen |
| `src/ui/components/SimControls.tsx`, `GameDay.tsx`, `src/ui/layout/Shell.tsx` (modify) | Watch button, Sim series, full-screen watch |
| `src/ui/components/Bracket.tsx` (new), `src/ui/screens/Playoffs.tsx` (modify) | shared bracket |
| `src/ui/playoffs/stakes.ts` (new), `src/ui/screens/PlayoffHub.tsx` (new), `src/ui/screens/Home.tsx` (modify) | playoff hub on Home |
| `src/ui/components/PlayerCell.tsx`, `src/ui/screens/PlayerPage.tsx` (modify) | ⭐ favorites |

---

### Task 1: Play log in `simGame`

**Files:**
- Create: `src/engine/sim/playlog.ts`
- Modify: `src/engine/sim/game.ts`
- Test: `tests/engine/playlog.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Side = 'home' | 'away'
  interface Base { period: number; t: number }            // period 1–4, 5+ = OT; t in [0,1) inside the period
  export type PlayEvent = Base & (
    | { k: 'fg'; side: Side; player: string; made: boolean; three: boolean; home: number; away: number }
    | { k: 'ft'; side: Side; player: string; made: boolean; home: number; away: number }
    | { k: 'reb'; side: Side; player: string; off: boolean }
    | { k: 'ast'; side: Side; player: string }
    | { k: 'stl'; side: Side; player: string }
    | { k: 'blk'; side: Side; player: string }
    | { k: 'tov'; side: Side; player: string }
    | { k: 'periodEnd'; min: Record<string, number>; pm: Record<string, number> })
  export function boxFromLog(log: PlayEvent[]): Record<string, { pts: number; oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number }>
  export function quartersFromLog(log: PlayEvent[]): { home: number[]; away: number[] }
  ```
  `simGame(home, away, players, coaches, rng, log?: PlayEvent[]): GameResult` — `side` is the side of the player named in the event; `home`/`away` on fg/ft are the running score after the event; `periodEnd.min`/`pm` are cumulative `played`/`pm` per player id at the end of that period.

- [ ] **Step 1: Write the failing tests** in `tests/engine/playlog.test.ts`, reusing the `sample()` pattern from `tests/engine/game.test.ts` (same league, 300 games, a second run with a log array per game):
  - `it('does not change results')`: for seeds 1..300, `simGame(..., Rng.fromSeed(s))` and `simGame(..., Rng.fromSeed(s), log)` give `toEqual` results, and the two RNG states after are equal.
  - `it('rebuilds every box line')`: for each game, `boxFromLog(log)[id]` equals the result's box line for pts, oreb, dreb, ast, stl, blk, tov, fgm, fga, tpm, tpa, ftm, fta (players with no events count as all zeros).
  - `it('rebuilds quarter scores, including OT')`: `quartersFromLog(log)` equals `res.quarters`; assert at least one sampled game has `res.ot > 0` (raise the sample until true) and that game has `periodEnd` events for periods 5+.
  - `it('orders events inside each period')`: `t` is non-decreasing within a period, in `[0, 1)`, and the last fg/ft's running score equals the final score.
  - `it('ends each period with minutes and plus-minus')`: last `periodEnd`'s `min`/`pm` equal the box `min`/`pm`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/playlog.test.ts` — expect FAIL (`playlog` module missing).
- [ ] **Step 3: Implement.** In `game.ts` add `log?: PlayEvent[]`; push events right next to the existing `box[...]++` lines (`addPoints` for running score, `rebound`, `maybeAssist`, steal, block, turnover, `freeThrows`). Never add an `rng` call inside an `if (log)` branch. Record `possInPeriod` on each event while the period runs; when `runPeriod` finishes, set each of that period's events `t = possIdx / possessionsInPeriod` (0 when the period had none), then push `periodEnd`. An and-one is a made `fg` followed by its `ft`; a shooting foul with no make produces only `ft` events. Implement `boxFromLog` / `quartersFromLog` in `playlog.ts`.
- [ ] **Step 4: Run** `npx vitest run tests/engine` — expect all PASS (existing realism tests unchanged).
- [ ] **Step 5: Commit** `git add src/engine/sim tests/engine/playlog.test.ts && git commit -m "feat(engine): optional play-by-play log in simGame"`

### Task 2: `watchDay`, `seriesEnd`, worker command

**Files:**
- Modify: `src/engine/season/advance.ts`, `src/worker/protocol.ts`, `src/worker/simWorker.ts`, `src/worker/client.ts`
- Test: `tests/engine/watchday.test.ts`, `tests/ui/workerClient.test.ts`

**Interfaces:**
- Consumes: `PlayEvent`, `simGame(..., log)` (Task 1).
- Produces:
  ```ts
  export interface WatchCapture { gameId: string; log: PlayEvent[] }
  export function watchDay(league: League, opts?: SimOpts): { league: League; watch: WatchCapture | null }
  export function simUntil(league, target: 'regularEnd' | 'playoffsEnd' | 'deadline' | 'seriesEnd', opts?): League
  export function userSeries(league: League): Series | null   // the user's undecided series in the current bracket
  // protocol.ts
  SimCommand |= { type: 'watchDay' } ; SimCommand simUntil target |= 'seriesEnd'
  SimResponse = { id: number; league: League; watch?: WatchCapture | null } | { id: number; error: string }
  // client.ts
  export function runWatch(league: League): Promise<{ league: League; watch: WatchCapture | null }>
  ```

- [ ] **Step 1: Write failing tests** in `tests/engine/watchday.test.ts` (league `createLeague({ seed: 404, userTeamIndex: 3, name: 'W' })`):
  - `it('plays the same day as simDays')`: from a day the user plays, `watchDay(l).league` `toEqual` `simDays(l, 1)`; `watch.gameId` is that day's user game; `watch.log` non-empty and `boxFromLog` matches that game's box.
  - `it('returns null on a user off day')`: find a day the user doesn't play; `watch` is `null` and the league equals `simDays(l, 1)`.
  - `it('captures the game that ends the regular season')` and `it('captures a Finals clincher')`: sim to the day before (use `simUntil`/`simDays` loops), run `watchDay`; result phase changed (`'playoffs'` / `'offseason'`) and `watch` is still non-null when the user played. (For the Finals, pick a seed/user team that reaches the Finals or set `userTeamId` to the Finals winner before the clinching day.)
  - `it('seriesEnd stops when the user series is decided')`: from the first playoff day with a user series, `simUntil(l, 'seriesEnd')` returns a league where that series has a `winnerId` and the day before it did not; with no undecided user series it returns the league unchanged.
  - `it('does not mutate its input')` like the existing `simDays` test.
  - In `tests/ui/workerClient.test.ts`, add a case that `runWatch` resolves to `{ league, watch }` from a mocked worker response.
- [ ] **Step 2: Run** `npx vitest run tests/engine/watchday.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** Thread an optional `capture?: { teamId: string; out: WatchCapture | null }` through `stepDay` → `playGame`; `playGame` passes a fresh log to `simGame` only for the game with `capture.teamId`. `watchDay` = clone + one `stepDay` with capture (honouring `opts.stopOnOffer`, same as `simDays`). `seriesEnd` snapshots `userSeries(next)?.id` at start; done when that series has a winner or phase is offseason; no-op when null. Worker: route `watchDay` and include `watch` in the response; client keeps `runSim` returning `League` and adds `runWatch`.
- [ ] **Step 4: Run** `npm test` — expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(engine): watchDay sim with play log capture, sim to end of series"` (include new test file).

### Task 3: Pure replay model

**Files:**
- Create: `src/ui/watch/replay.ts`
- Test: `tests/ui/replay.test.ts`

**Interfaces:**
- Consumes: `PlayEvent`, `boxFromLog` (Task 1); `WatchCapture` (Task 2); `seasonLine` (`src/ui/util.ts`).
- Produces:
  ```ts
  export const QUARTER_MS = 15000
  export const periodMs = (period: number) => period <= 4 ? QUARTER_MS : QUARTER_MS * 5 / 12
  export const periodLabel = (period: number) => period <= 4 ? `Q${period}` : period === 5 ? 'OT' : `${period - 4}OT`
  export interface LiveLine { pts; reb; oreb; dreb; ast; stl; blk; tov; fgm; fga; tpm; tpa; ftm; fta: number; byPeriod: number[]; min: number; pm: number }
  export interface ReplayState { cursor: number; period: number; home: number; away: number; lines: Record<string, LiveLine> }
  export function periodCount(log: PlayEvent[]): number
  export function initState(): ReplayState
  export function advanceTo(log: PlayEvent[], s: ReplayState, period: number, t: number): { state: ReplayState; fired: PlayEvent[] }  // applies events with (period, t) <= target; immutable
  export function finalState(log: PlayEvent[]): ReplayState
  export function benchLine(state: ReplayState, ids: string[]): LiveLine   // summed
  export function elapsedFraction(period: number, t: number): number       // game minutes elapsed / 48
  export function isHot(pts: number, ppg: number | null, frac: number): boolean
  export function onPace(pts: number, frac: number): number                // round(pts / frac), 0 when frac == 0
  export function standout(state: ReplayState, ppg: Record<string, number | null>, frac: number, ids: string[]): string | null  // biggest pts − ppg·frac
  ```
  `min`/`pm` update only on `periodEnd` (as of the last break).

- [ ] **Step 1: Write failing tests** (build logs with `simGame(..., log)` like Task 1, seeds 1..100):
  - `finalState(log).lines` totals equal `boxFromLog(log)`; `home`/`away` equal the result.
  - Stepping `advanceTo` in 1000 random small increments across every period ends in a state equal to `finalState` (Review Focus 2: skip from any point = same final).
  - A game with OT: `periodCount` is 5+, `periodLabel(5) === 'OT'`, `periodLabel(6) === '2OT'`.
  - `isHot(18, 10, 0.5) === true`; `isHot(12, 10, 0.5) === false`; `isHot(9, 0, 0.5) === false` (under 10 pts); `isHot(30, null, 0.5) === false` (no average).
  - `onPace(10, 0.5) === 20`; `onPace(0, 0) === 0`.
  - `elapsedFraction(2, 0.5) === 0.375`; OT: `elapsedFraction(5, 1) === 53/48`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/replay.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `replay.ts`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `git add src/ui/watch/replay.ts tests/ui/replay.test.ts && git commit -m "feat(ui): pure replay model for watch mode"`

### Task 4: Save v5 favorites + store watch session

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/league/create.ts`, `src/save/migrate.ts`, `src/ui/store.ts`
- Modify tests: `tests/engine/league.test.ts:114`, `tests/save/db.test.ts:70-86` (expect `5`), `tests/ui/store.test.ts`

**Interfaces:**
- Consumes: `runWatch`, `WatchCapture` (Task 2).
- Produces:
  ```ts
  League.version: 5; League.favoritePlayerIds: string[]
  // store
  watch: { gameId: string; log: PlayEvent[]; before: League } | null
  startWatch: () => Promise<void>   // same busy/error/save/offer-notice handling as sim(); sets watch when capture is non-null
  endWatch: () => void              // watch = null
  toggleFavorite: (playerId: string) => void  // via act(); adds/removes in favoritePlayerIds
  ```

- [ ] **Step 1: Write failing tests:** migration v4 → v5 adds `favoritePlayerIds: []` and v1 saves still load (bump expected versions to 5); store: `startWatch` with a mocked `runWatch` that returns a capture sets `league` to the new league, `watch.before` to the old league and `busy` false; with `watch: null` it behaves like `sim`; `toggleFavorite` twice returns to the original list and persists.
- [ ] **Step 2: Run** `npx vitest run tests/save tests/ui/store.test.ts tests/engine/league.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** `CURRENT_VERSION = 5`; add `if (raw?.version === 4) raw = { ...raw, version: 5, favoritePlayerIds: [] }`; extend the migrate doc comment. Share the save/notice code between `sim` and `startWatch` instead of duplicating it.
- [ ] **Step 4: Run** `npm test && npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `git commit -am "feat: save v5 favorites, store watch session"`

### Task 5: Watch screen

**Files:**
- Create: `src/ui/watch/WatchGame.tsx`, `WatchCard.tsx`, `QuarterBreak.tsx`, `WatchPlayerSheet.tsx`, `watch.css`
- Modify: `src/ui/layout/Shell.tsx`

**Interfaces:**
- Consumes: store `watch`, `endWatch`, `toggleFavorite`; everything in `replay.ts`; `Face` (`src/ui/face/Face.tsx`), `Sheet` (`src/ui/components/Sheet.tsx`), `seasonLine`, `fullName`, `teamFull`.
- Produces: `export function WatchGame()`; `Shell` renders only `<WatchGame />` while `useStore(s => s.watch)` is non-null.

Build to the spec's "watch screen" section and the mockup, with these decisions:
- Top = opponent, bottom = user. Each row: the five box lines with `gs: true` in box order (= slot order) + a Bench card summing `gs: false` lines (`benchLine`). Cards show the real `<Face>` (team colors, jersey), last name, live PTS · REB · AST; ⭐ ring for favorites; 🔥 glow when `isHot`.
- Header: team names + records and (playoffs) series text computed from `watch.before`, not the live league. Season ppg from `seasonLine(watch.before, p)` (playoff line when `before.phase === 'playoffs'` and he has one).
- Clock: `requestAnimationFrame` advances `t += dt * speed / periodMs(period)`; call `advanceTo`; fire a ball for each fired `fg`/`ft` (Web Animations API from the shooter's card rect to the rim rect, made = drops through, missed = clanks away, `blk` = swatted; FT = flatter shot, 2nd attempt delayed); bump stats; feed line for the newest event. Game clock text from `t` (12:00 per quarter, 5:00 OT).
- At `t >= 1`: pause, show `QuarterBreak` over a `backdrop-filter: blur(10px)` layer: score, leader text, `standout` line, PTS/REB/AST/FG/3P for all ten starters + both bench totals, names tappable → `WatchPlayerSheet`; button "Start {next periodLabel} ▶". After the last period: final recap (win/loss), player-page links appear only here, button "Done" → `endWatch()` and navigate to `/`.
- Controls: 1×/2×/4× (keeps position when changed), "Skip to final" (→ `finalState`, final recap), "Exit" (same as Skip). No other navigation is rendered.
- `WatchPlayerSheet`: PTS, REB, AST, STL, BLK, TOV, FG, 3P, FG%, MIN, +/- from the live line; points by period bars; "On pace for {onPace} tonight" plus "· {±diff} vs his average" only when ppg exists; ⭐ toggle → `toggleFavorite`.
- `prefers-reduced-motion`: skip ball/net/pop animations.

- [ ] **Step 1:** Implement the components and CSS.
- [ ] **Step 2: Run** `npm run typecheck && npm test` — expect PASS.
- [ ] **Step 3: Commit** `git add src/ui && git commit -m "feat(ui): watch mode screen"`

### Task 6: Watch / Sim series buttons

**Files:**
- Modify: `src/ui/components/SimControls.tsx`, `src/ui/components/GameDay.tsx`

**Interfaces:**
- Consumes: `startWatch` (Task 4), `nextGame` (`src/ui/util.ts`), `userSeries` (Task 2), `simUntil` target `'seriesEnd'`.
- Produces: `useSim()` actions include `{ key: 'watch', label: 'Watch game', primary: true }` first when the user plays today (`nextGame(l, l.userTeamId)?.day === l.day`), then `Sim day`. Playoffs add `{ key: 'series', label: 'Sim series', short: 'Until your series is decided' }` while `userSeries(l)` is non-null. `GameDayHero` gets a "▶ Watch game" button calling `startWatch`, disabled under the same roster-problem rule.

- [ ] **Step 1:** Implement. Mobile: the big thumb button becomes "Watch game" on game days; Sim day moves into the sheet list as its first row.
- [ ] **Step 2: Run** `npm run typecheck && npm test` — expect PASS.
- [ ] **Step 3: Visual check** with the `run` skill (or Playwright on `npm run dev`) at 390×844: new league → Watch game → watch Q1 at 4×, open a player sheet at the break, Skip to final, Done. Screenshot mid-quarter and the break; confirm balls fly into the rim, FTs show, recap is readable, final score equals the box score page for that game.
- [ ] **Step 4: Commit** `git commit -am "feat(ui): watch game and sim series buttons"`

### Task 7: Playoff hub on Home

**Files:**
- Create: `src/ui/components/Bracket.tsx`, `src/ui/playoffs/stakes.ts`, `src/ui/screens/PlayoffHub.tsx`
- Modify: `src/ui/screens/Playoffs.tsx`, `src/ui/screens/Home.tsx`
- Test: `tests/ui/stakes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function Bracket({ league, bracket, conf, highlightTeamId }: { league: League; bracket: PlayoffBracket; conf?: 'East' | 'West'; highlightTeamId?: string })  // no conf = both sides (Playoffs screen)
  export type Stake = 'sweep' | 'elimination' | 'decider'
  export function seriesStake(s: Series): Stake | null
  ```
  `need = bestOf === 7 ? 4 : 3`. `decider` (label "winner takes all") when both teams have `need − 1`; `sweep` ("sweep watch 🧹") when one has `need − 1` and the other `0`; `elimination` ("elimination game") when one has `need − 1`; else `null`. (This replaces the spec's "series-clincher" tag, which is the same game seen from the other side.)

- [ ] **Step 1: Write failing tests** for `seriesStake`: 3–0 bo7 → `sweep`; 3–2 → `elimination`; 3–3 → `decider`; 2–2 → `null`; 2–0 bo5 → `sweep`; 2–2 bo5 → `decider`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/stakes.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** Move `SeriesBox`/columns from `Playoffs.tsx` into `Bracket` (Playoffs screen output unchanged). `PlayoffHub`: header pill "Round N · Day D"; bracket panel with a West/East toggle on narrow screens (default the user's conference; columns scroll sideways inside the panel; both conferences side by side at ≥ 900px), user's series highlighted; "Today · N games" list from today's unplayed playoff games, each row "AWY @ HOM · Game n", series text and stake tag, the user's row highlighted with a Watch button; buttons Sim day / Sim series / Sim playoffs (reuse `useSim` actions). `Home`: when `phase === 'playoffs'` render champion banner, team scoreboard, `PlayoffHub`, Inbox and Highlights only; regular season unchanged.
- [ ] **Step 4: Run** `npm test && npm run typecheck` — expect PASS; visual check at 390px and 1280px during playoffs (sim to `regularEnd` first).
- [ ] **Step 5: Commit** `git add src/ui tests/ui/stakes.test.ts && git commit -m "feat(ui): playoff hub on Home"`

### Task 8: Favorites around the app

**Files:**
- Modify: `src/ui/components/PlayerCell.tsx`, `src/ui/screens/PlayerPage.tsx`

**Interfaces:**
- Consumes: `league.favoritePlayerIds`, `toggleFavorite` (Task 4).

- [ ] **Step 1:** `PlayerCell` shows "⭐" after the name when favorited. `PlayerPage` header gets a "☆ Favorite" / "⭐ Your guy" toggle button.
- [ ] **Step 2: Run** `npm run typecheck && npm test` — expect PASS.
- [ ] **Step 3: Commit** `git commit -am "feat(ui): favorite players"`

### Task 9: Ship

- [ ] **Step 1:** `npm test && npm run typecheck && npm run build` — all pass.
- [ ] **Step 2:** Push `claude/inspiring-wozniak-r5u0kr`, fast-forward/merge into `main`, `git push origin main`.
- [ ] **Step 3:** Confirm the "Deploy to GitHub Pages" workflow run is green (fix and redeploy if not).
- [ ] **Step 4:** Tell the owner the site is updated.
