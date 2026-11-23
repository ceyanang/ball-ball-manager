# Random Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Random, mostly funny pop-ups (2–3 gamble-y choices each) that fire around the user's games and change fans, morale, team chemistry, temporary buffs, rests, and training/ratings — plus a "Sim to next event" button.

**Architecture:** A data catalog of `EventDef`s (TS data) is interpreted by a pure-TS engine in `src/engine/events/` (roll → pending → resolve with a seeded outcome → apply effects). Pending/active state lives on `League` (v8). Temporary effects reach `simGame` as an optional `mods` argument, never as rating edits. The sim worker pauses on a pending event the way it already pauses on trade offers.

**Tech Stack:** TypeScript, React, Zustand (`useStore`), Vitest, Vite web worker.

**Spec:** `docs/superpowers/specs/2026-11-23-random-events-design.md`

## Global Constraints

- `src/engine/` is pure TS: no React/DOM, no `Math.random`; use `Rng` / `storyRng(l, salt)` (`src/engine/stories/state.ts`).
- Events only for the user team. AI-vs-AI games and every existing test must behave exactly as before (events only roll when `SimOpts.pauseForEvents` is true; only the worker sets it).
- Temporary buffs are `GameMods` passed into `simGame`; never mutate ratings for a temporary effect.
- Outcome rolls are derived from the league seed (no save-scumming).
- `League.version` goes 7 → 8 with a migration in `src/save/migrate.ts` (`CURRENT_VERSION = 8`); League stays JSON-serializable.
- Frequency setting values: `'off' | 'some' | 'lots'`, default `'lots'` (~15–25 events/season).
- Launch catalog ≈ 60 events (≥ 15 player requests, ≥ 10 pre-game, a few playoff-only). Halftime events and AI-team events are out of scope.
- Ship per `CLAUDE.md`: `npm test` + `npm run typecheck` green, merge to `main`, push, confirm the Pages deploy is green.

## Review Focus

1. **Reload / double answer:** reloading a save mid-prompt and answering gives the same outcome; answering with no pending event is a no-op (Task 3).
2. **Subject gone:** the player in a pending event is traded/released/retired before the user answers → event is dropped cleanly with no crash or effects (Task 3).
3. **Rest leaves too few players:** a `rest` effect that would leave fewer than 5 able players is ignored (Task 4).
4. **Not enough eligible subjects / frequency off:** `pick` returns null, tiny rosters, or `'off'` never produces a pending event or an infinite loop in "Sim to next event" (Tasks 3, 5).
5. **Old saves:** a v7 save loads, migrates to v8 with chemistry 50 for every team, and keeps playing (Task 1).

---

### Task 1: League v8 state + migration

**Files:**
- Create: `src/engine/events/state.ts`
- Modify: `src/engine/types.ts` (League `version: 8`, new fields), `src/save/migrate.ts`, `src/engine/league/create.ts`
- Test: `tests/save/migrate.test.ts` (create if absent), `tests/engine/events.state.test.ts`

**Interfaces:**
- Produces (`src/engine/events/state.ts`):
  - `type EventFrequency = 'off' | 'some' | 'lots'`
  - `interface PendingEvent { eventId: string; season: number; phase: Phase; day: number; subjects: Subjects }`
  - `interface Subjects { playerIds: string[]; coachId?: string; teamId?: string; opponentId?: string }`
  - `interface ActiveEffect { id: string; kind: 'shooting' | 'defense' | 'energy' | 'all'; playerId: string | null /* null = whole team */; amount: number; gamesLeft: number; rest?: boolean }`
  - `interface EventLogEntry { eventId: string; season: number; day: number; title: string; choice: string; outcomeText: string; tone: 'good' | 'bad' | 'neutral'; changes: string[] }`
  - `interface EventsState { frequency: EventFrequency; pending: PendingEvent | null; active: ActiveEffect[]; history: EventLogEntry[]; cooldowns: Record<string, number>; rolled: { season: number; phase: Phase; day: number; slot: 'pre' | 'day' | 'post' } | null }`
  - `emptyEvents(): EventsState` (frequency `'lots'`, everything else empty/null)
  - `League` gains `events: EventsState` and `chemistry: Record<string, number>`.

- [ ] **Step 1: Write failing tests** — `tests/engine/events.state.test.ts`: `createLeague({seed:1,userTeamIndex:0,name:'x'})` has `events.frequency === 'lots'`, `events.pending === null`, `version === 8`, and `chemistry[t] === 50` for all 30 teams. `tests/save/migrate.test.ts`: a v7 league (build with `createLeague`, then delete `events`/`chemistry` and set `version: 7`) passes through `migrate` (use the exported function in `migrate.ts`) and comes out `version 8` with `chemistry` 50 for each team and `events` equal to `emptyEvents()`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/events.state.test.ts tests/save/migrate.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the types in `state.ts`, add the League fields (bump `version: 8`), set both in `createLeague`, and add `if (raw?.version === 7) raw = { ...raw, version: 8, events: emptyEvents(), chemistry: Object.fromEntries(Object.keys(raw.teams).map((id) => [id, 50])) }` plus `CURRENT_VERSION = 8`. Fix any other `version: 7` literal the typechecker flags.
- [ ] **Step 4: Run** the two tests plus `npm run typecheck` — expect PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(events): League v8 state and migration"`

### Task 2: Effects engine

**Files:**
- Create: `src/engine/events/effects.ts`
- Test: `tests/engine/events.effects.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `clamp` from `src/engine/stories/state.ts`; `ovr` from `src/engine/gm/cap.ts`; `Ratings` from `types.ts`.
- Produces:
  - `type Target = { player: string } | 'team'` (team = the user's team)
  - `type Effect =
    | { kind: 'morale'; target: Target | 'roster'; delta: number }
    | { kind: 'fans'; target: Target; delta: number }
    | { kind: 'chemistry'; delta: number }
    | { kind: 'buff'; target: Target; stat: 'shooting' | 'defense' | 'energy' | 'all'; amount: number; games: number }
    | { kind: 'rest'; player: string }
    | { kind: 'train'; player: string; skill: keyof Ratings; delta: number }
    | { kind: 'ovrNudge'; player: string; delta: number }
    | { kind: 'inbox'; title: string; body: string }`
  - `applyEffects(l: League, effects: Effect[]): string[]` — mutates `l`, returns one human-readable line per change (e.g. `"Marcus Webb morale +8"`), used by the result card.
- A `{ player: string }` field is a resolved player id; catalog events build effects after `pick` runs (Task 6 uses `s.playerIds[0]`).

- [ ] **Step 1: Write failing tests** (each builds a fresh `createLeague`, uses a user player `p`): morale clamps to 0–100 (`+500` → 100, `−500` → 0); `roster` morale hits every user-team player; fans clamp to ±100 for a player and for `'team'`; chemistry clamps 0–100 on the user team; `buff` pushes an `ActiveEffect` with `gamesLeft = games` and `playerId` null for `'team'`; `rest` pushes `{rest:true, gamesLeft:1}`; `train` raises that rating by `delta` capped at 99 and appends no more than that (other ratings unchanged); `ovrNudge +1` raises `ovr(p)` by ≥ 1 and spreads across at most 5 ratings; `inbox` appends an inbox item; the returned strings mention the player's last name and the signed delta.
- [ ] **Step 2: Run** `npx vitest run tests/engine/events.effects.test.ts` — expect FAIL.
- [ ] **Step 3: Implement `applyEffects`** with one small handler per kind; ids for active effects from `nextId(l, 'fx')`; `inbox` uses `ping(l, 'morale', key, title, body)` from `stories/inbox.ts` with key `evt:${nextId(...)}`.
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(events): effect handlers`

### Task 3: Catalog types, roller and resolver

**Files:**
- Create: `src/engine/events/types.ts`, `src/engine/events/engine.ts`, `src/engine/events/catalog/index.ts` (exports `CATALOG: EventDef[]`, starts with 2 test-grade events), `src/engine/events/hooks.ts`
- Test: `tests/engine/events.engine.test.ts`

**Interfaces:**
- Consumes: Task 1 state, Task 2 `Effect`/`applyEffects`; `storyRng`, `ping`.
- Produces (`types.ts`):
  - `interface EventCtx { l: League; when: 'preGame' | 'postGame' | 'day'; game: Game | null; userGame: { won: boolean; margin: number } | null /* postGame only */; roster: Player[] /* user team, healthy-first */ }`
  - `interface EventDef { id: string; when: 'preGame' | 'postGame' | 'day'; weight: number; cooldownDays?: number; kind?: 'request'; playoffsOnly?: boolean; pick(ctx: EventCtx): Subjects | null; emoji: string; title(s: Subjects, l: League): string; text(s: Subjects, l: League): string; choices: ChoiceDef[] }`
  - `interface ChoiceDef { label: string; emoji?: string; outcomes: OutcomeDef[] }`
  - `interface OutcomeDef { weight: number; tone: 'good' | 'bad' | 'neutral'; text(s: Subjects, l: League): string; effects(s: Subjects, l: League): Effect[] }`
- Produces (`engine.ts`):
  - `rollEvent(l: League, when: 'preGame' | 'postGame' | 'day', game: Game | null): boolean` — if allowed, draws with `storyRng(l, 77)` against `EVENT_TUNING[frequency][when]` probabilities, picks a weighted eligible event (skip cooldowns, `playoffsOnly` outside playoffs, `pick` returning null), and sets `l.events.pending`. Records `l.events.rolled` so a day/slot is never re-rolled. Returns true if pending was set.
  - `EVENT_TUNING: Record<'some' | 'lots', Record<'preGame' | 'day' | 'postGame', number>>` with lots = `{ preGame: 0.28, day: 0.25, postGame: 0.10 }`, some = `{ preGame: 0.12, day: 0.10, postGame: 0.04 }`.
  - `answerEvent(l: League, choiceIndex: number): EventLogEntry | null` — null if no pending, or if any subject player is no longer on the user team/retired (then pending is cleared with no effects). Else picks the outcome with `storyRng(l, hash(eventId) + choiceIndex)` (weighted), applies effects, pushes to `history` (cap 100), sets `cooldowns[eventId] = l.day + (cooldownDays ?? 10)`, clears pending.
  - `skipEvent(l: League): boolean` — only for `when: 'day'` events: clears pending, no effects.
  - `describePending(l: League): { def: EventDef; title: string; text: string } | null`
- `hooks.ts` exports `beforeUserGame(l, g)`, `afterUserGame(l, g)`, `onOffDay(l)` — thin wrappers over `rollEvent` (used in Task 5).

- [ ] **Step 1: Write failing tests** (use a tiny test-only `EventDef` array injected via an exported `setCatalogForTests(defs)`; reset afterAll): (a) `answerEvent` twice on the same league clone gives identical `changes`, and a structuredClone of the league (simulating a reload) gives the same outcome (Review Focus 1); `answerEvent` with no pending returns null. (b) subject traded away (`p.teamId = null`) → `answerEvent` returns null, pending cleared, no morale change (Review Focus 2). (c) `frequency: 'off'` → `rollEvent` never sets pending over 200 days; `'lots'` sets pending in 15%–50% of 200 simulated preGame calls; a `pick` that returns null never sets pending (Review Focus 4). (d) `rolled` slot prevents a second roll for the same day/slot. (e) cooldown blocks the same event until `l.day` passes it. (f) `skipEvent` works for `day`, refuses `preGame`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/events.engine.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `engine.ts` per the interfaces; weighted choice via `rng.weighted`. Outcome text and effects are computed at answer time from `pending.subjects`.
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** `feat(events): roller and resolver`

### Task 4: Sim mods and chemistry

**Files:**
- Create: `src/engine/events/mods.ts`
- Modify: `src/engine/sim/game.ts` (new optional `mods` param, `K.chemistry`), `src/engine/season/advance.ts` (`playGame` passes mods and ticks them)
- Test: `tests/engine/events.mods.test.ts`

**Interfaces:**
- Consumes: Task 1 `ActiveEffect`.
- Produces (`mods.ts`):
  - `interface GameMods { shooting: Record<string, number>; defense: Record<string, number>; energy: Record<string, number>; sit: string[]; chemistry: Record<string, number> /* teamId → 0..100 */ }`
  - `buildMods(l: League, g: Game): GameMods | undefined` — undefined when the user's team isn't in `g` or nothing is active and chemistry is 50. `team` effects expand over the user roster; `'all'` adds the same amount to shooting, defense and energy; a `rest` effect goes in `sit` unless that would leave fewer than 5 able players (Review Focus 3).
  - `tickEffects(l: League): void` — decrements `gamesLeft` on all active effects after the user's game and removes spent ones.
- `simGame(home, away, players, coaches, rng, log?, mods?)` — optional 7th argument. `shooting[id]` adds to make-probability as `amount × 0.01` per point (cap ±0.06); `defense[id]` adds the same to that defender's `perD`/`intD`; `energy[id]` adds to the starting energy (cap 100); `sit` players are treated as inactive for this game; chemistry adds `(chem − 50) × K.chemistry` to team make-probability with `K.chemistry = 0.0004` (±2% at the extremes). With `mods` undefined or all-empty the result must be bit-identical to today.

- [ ] **Step 1: Write failing tests**: (a) same seed, `simGame(..., undefined)` vs `simGame(..., emptyMods)` give equal `GameResult` (existing `tests/engine/game.test.ts` stays green); (b) over 200 seeded games a `+5` shooting buff on the star raises his points vs baseline (mean diff > 0); (c) `sit: [starId]` → his box line `min === 0`; (d) chemistry 100 vs 0 on the home team changes mean margin in the right direction over 300 games; (e) `buildMods` ignores `rest` when only 5 healthy players exist; (f) `tickEffects` removes an effect after its last game and `buildMods` then returns undefined.
- [ ] **Step 2: Run** `npx vitest run tests/engine/events.mods.test.ts tests/engine/game.test.ts` — expect FAIL on the new tests.
- [ ] **Step 3: Implement** `mods.ts`; thread `mods` through `simGame` (shot probability line near `p += ((players[shooter].morale ?? 60) - 60) * K.morale`, `makeSide`/`gameLineup` for `sit`, energy init); in `playGame`, call `buildMods(league, g)` and, after the user's game, `tickEffects`.
- [ ] **Step 4: Run** the tests plus the full `npx vitest run tests/engine` — expect PASS.
- [ ] **Step 5: Commit** `feat(events): sim mods and team chemistry`

### Task 5: Pause the sim on events + "Sim to next event"

**Files:**
- Modify: `src/engine/season/advance.ts` (`SimOpts.pauseForEvents`, `stepDay` hooks, `simUntil` target `'event'`), `src/worker/protocol.ts`, `src/worker/simWorker.ts`, `src/ui/store.ts` (watch handling), `src/ui/components/SimControls.tsx`
- Test: `tests/engine/events.sim.test.ts`

**Interfaces:**
- Consumes: Task 3 `beforeUserGame`/`afterUserGame`/`onOffDay`; Task 4.
- Produces:
  - `SimOpts.pauseForEvents?: boolean` (set `true` in `simWorker.ts` for every command; default false so tests/scripts never see events).
  - `stepDay(league, rng, capture, pause)` returns true when an event is pending. If `league.events.pending` already exists the day is **not** played (return true immediately). A `preGame`/`day` roll happens before games are played, a `postGame` roll after the user's game; pending stops `simDays`/`simUntil` loops via the existing `stopOnOffer` break.
  - `simUntil(league, 'event', opts)` — loops until `events.pending` is set, or the phase leaves `regular`/`playoffs`, or a 1000-day guard.
  - `SimCommand` gains `{ type: 'simUntil'; target: 'event' }`; `SimControls` gets a **"Sim to next event"** action (`key: 'event'`, short: `Until the next pop-up`), shown in regular and playoffs, disabled while an event is pending.
  - `watchDay` with a pending pre-game event returns `watch: null` and the store must open the event modal instead of a blank watch (store code path for a null capture).

- [ ] **Step 1: Write failing tests**: with `pauseForEvents: true` and a seeded league on `'lots'` and a test catalog whose only event always fires: `simDays(l, 7, {stopOnOffer:true, pauseForEvents:true})` stops with `events.pending` set and `l.day` unchanged by the paused day; calling `simDays` again before answering plays nothing; after `answerEvent`, the same day plays and is **not** re-rolled for the same slot; `simUntil(l,'event',…)` returns with pending set; with `frequency:'off'` `simUntil(l,'event',…)` ends at `phase !== 'regular'` (Review Focus 4, no infinite loop); without `pauseForEvents`, a 20-day sim leaves `events.pending === null` and results equal the pre-change snapshot.
- [ ] **Step 2: Run** `npx vitest run tests/engine/events.sim.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the wiring. Keep the user-team-only check in the hooks (`g.homeId === l.userTeamId || g.awayId === l.userTeamId`).
- [ ] **Step 4: Run** `npm test` and `npm run typecheck` — expect all PASS (existing season tests unchanged).
- [ ] **Step 5: Commit** `feat(events): pause sim on events, sim to next event`

### Task 6: Catalog validity test + launch catalog, part 1 (pre-game + player requests)

**Files:**
- Create: `src/engine/events/catalog/preGame.ts`, `src/engine/events/catalog/requests.ts`; Modify: `catalog/index.ts` to export them
- Test: `tests/engine/events.catalog.test.ts`

**Interfaces:**
- Consumes: Task 3 `EventDef`; Task 2 `Effect`.
- Produces: `PRE_GAME_EVENTS: EventDef[]` (≥ 12) and `REQUEST_EVENTS: EventDef[]` (≥ 15, each with `kind: 'request'`).

- [ ] **Step 1: Write the lint test** (runs over the whole `CATALOG`, so later tasks only add data): unique ids; 2–3 choices; each choice has ≥ 1 outcome; weights > 0; **every event has at least one `bad` or `neutral` outcome and at least one `good` outcome**; no choice has only `good` outcomes; every `title`/`text` renders without `undefined` or `{` for a league where `pick` succeeds; every `pick` returns subjects who are on the user's roster; every effect target references a player in `subjects`. Add count asserts (`preGame ≥ 12`, `requests ≥ 15`). Add a test that simulates a full 82-game season on `'lots'` (answering every event with choice 0) and sees between 12 and 40 events.
- [ ] **Step 2: Run** `npx vitest run tests/engine/events.catalog.test.ts` — expect FAIL.
- [ ] **Step 3: Write the events** as plain data following the spec samples (🛌 day-off request with both-ways risk, 🏋️ "I want to work on my three" using `train`, rookie streaming at 3am, etc.). Gamble rule: no choice may be strictly dominant; mix which slot holds the "good" gamble.
- [ ] **Step 4: Run** the lint test — expect PASS.
- [ ] **Step 5: Commit** `feat(events): launch catalog part 1`

### Task 7: Launch catalog, part 2 (post-game, between-day, playoffs)

**Files:**
- Create: `src/engine/events/catalog/postGame.ts`, `catalog/days.ts`, `catalog/playoffs.ts`; Modify: `catalog/index.ts`
- Test: extend `tests/engine/events.catalog.test.ts` (counts: `postGame ≥ 12`, `day ≥ 12`, `playoffsOnly ≥ 4`, total `≥ 55`)

**Interfaces:**
- Consumes: Task 3/6. Produces: `POST_GAME_EVENTS`, `DAY_EVENTS`, `PLAYOFF_EVENTS` (all `EventDef[]`) merged into `CATALOG`.

- [ ] **Step 1:** Add the count asserts; run — expect FAIL.
- [ ] **Step 2:** Write the events. `postGame` use `ctx.userGame` (blowout win/loss, big comeback, star went off, losing streak ≥ 3 via standings); `day` events can be skipped, so make them flavourful and low-stakes; `playoffsOnly` ones raise stakes.
- [ ] **Step 3: Run** the full lint test — expect PASS.
- [ ] **Step 4: Commit** `feat(events): launch catalog part 2`

### Task 8: UI — modal, result card, store actions, log, frequency setting

**Files:**
- Create: `src/ui/components/EventModal.tsx`, `src/ui/screens/EventLog.tsx` (or a section on `Inbox.tsx`; builder's call)
- Modify: `src/ui/store.ts` (`answerEvent(i)`, `skipEvent()`, `setEventFrequency(f)` via `act`), `src/ui/App.tsx` (mount the modal globally), `src/ui/components/SimControls.tsx` (disable sim buttons while pending), `src/ui/screens/Home.tsx` or Saves/settings area for the frequency control
- Test: `tests/ui/store.test.ts` (extend)

**Interfaces:**
- Consumes: Task 3 `describePending`, `answerEvent`, `skipEvent`; `useStore().act`.
- Produces: `useStore` actions `answerEvent: (choice: number) => EventLogEntry | null`, `skipEvent: () => void`, `setEventFrequency: (f: EventFrequency) => void`. `EventModal` shows emoji, title, text, 2–3 big choice buttons (Skip button only for `day` events), then a result card (🎯 good / 💥 bad / 😐 neutral) listing `changes`; stays responsive at phone width and traps focus.

- [ ] **Step 1: Write failing store tests**: with a forced pending event, `answerEvent(0)` clears `league.events.pending`, adds a `history` entry and persists (existing store tests show the `writeSave` mock pattern); `setEventFrequency('off')` updates the league; sim buttons report disabled while `pending` is set (`useSim().disabled`).
- [ ] **Step 2: Run** `npx vitest run tests/ui/store.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** store actions, the modal (result-card state after answering, then "Continue"), global mount, log screen/section (newest first, shows title, choice, outcome, changes), and the frequency control (Off / Some / Lots).
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run build` — all PASS; then `npm run dev` and in the browser: sim until an event, answer it, check the result card and log, test phone width.
- [ ] **Step 5: Commit** `feat(events): pop-up UI, log and frequency setting`

### Task 9: Docs and ship

**Files:**
- Modify: `CLAUDE.md` (project notes: events live in `src/engine/events/`, save is League v8, events only roll with `pauseForEvents`), this plan's checkboxes.

- [ ] **Step 1:** Update `CLAUDE.md` basics (save version 8; events paragraph).
- [ ] **Step 2:** `npm test && npm run typecheck && npm run build` — all green.
- [ ] **Step 3:** Commit, push the working branch, fast-forward/merge into `main`, `git push origin main`.
- [ ] **Step 4:** Check the "Deploy to GitHub Pages" workflow run finished green (GitHub MCP `actions_list`); fix and re-ship if it didn't.
- [ ] **Step 5:** Tell the owner the site is updated.

---

## Self-review

- **Spec coverage:** events data catalog (T3, T6–7), outcomes weighted and hidden (T3), effects fans/morale/chemistry/buff/rest/train/ovrNudge/inbox (T2), chemistry stat + sim effect (T1, T4), mods not rating edits (T4), pause like trade offers (T5), no save-scum (T3), frequency Off/Some/Lots (T1, T3, T8), day-event skip (T3, T8), result card + log (T8), sim to next event (T5, T8), migration v7→v8 (T1), ~60 events (T6–7), ship (T9).
- **Types:** `Subjects`, `Effect`, `EventDef`, `GameMods`, `ActiveEffect` defined once and referenced by name; `answerEvent`/`skipEvent` exist in both engine (T3) and store (T8) with matching meaning.
- **Proportion:** plan is code-light; bodies are left to the implementer.
