# Play Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every player a fixed play style (Smart, Offense, All-Around, Power, Defensive) that changes his sim habits, boosts his key stats inside the sim only, and shows as an emoji badge on portraits.

**Architecture:** A new pure module `src/engine/player/playStyle.ts` owns the type, the position odds, the ratings-fit tilt, the roll, the habit multipliers and the boost table. The roll is seeded from the player's `rawSeed` (generation) or id (migration), never the league `Rng`. `simGame` builds boosted "effective ratings" once per game (stored ratings and OVR untouched) and multiplies the archetype tendencies by the style's habits. UI reads `Player.playStyle`.

**Tech Stack:** TypeScript, React, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-28-play-styles-design.md`

## Global Constraints

- Engine code in `src/engine/` is pure TS: no React/DOM/`Math.random`; randomness only via `Rng` or seed hashing.
- The style roll must not draw from the league `Rng`: generating a league for a given seed yields the same ids, names and ratings as before.
- Styles: `'smart' | 'offense' | 'allAround' | 'power' | 'defensive'`. Badges: 🧠 Smart, ⚔️ Offense, 🏀 All-Around, 💪 Power, 🛡 Defensive.
- Position odds (% before the tilt): PG 35/30/18/5/12, SG 15/38/20/7/20, SF 18/18/28/18/18, PF 8/12/14/38/28, C 8/8/10/36/38, each in the order smart/offense/allAround/power/defensive.
- Boosts live only in `simGame`; stored ratings, OVR (`ovrOf`/`computeOvr`/`careerOvr`), trade value and contracts never see them. Boosted ratings cap at 99 (`RATING_MAX`).
- Style never changes after generation. Save `League` goes from version 15 to 16 with a migration.
- `npm test` and `npm run typecheck` must pass before each commit; ship per CLAUDE.md at the end.

## Review Focus

- A player with every rating 99 or every rating 25: odds finite, roll valid, boosted ratings never above 99 (Task 1, 4).
- A team with no Smart player, or a lineup of all Smart players: no NaN, bounded boost (Task 4).
- Retired players, free agents and draft prospects in an old save: all get a valid style, stable across repeated loads (Task 2).
- The followed MyCareer player: his Career OVR and `ovrOf` do not change with style; invalid or missing chosen style falls back to the rolled one (Task 2, 6).
- Same seed gives the same game result twice, and generating a league does not shift the league `Rng` stream (Task 2, 3).

---

### Task 1: Style module — odds, tilt, roll

**Files:**
- Create: `src/engine/player/playStyle.ts`
- Test: `tests/engine/playStyle.roll.test.ts`

**Interfaces:**
- Produces:
  - `type PlayStyle = 'smart' | 'offense' | 'allAround' | 'power' | 'defensive'`
  - `const PLAY_STYLES: readonly PlayStyle[]` (order above), `STYLE_LABEL: Record<PlayStyle, string>`, `STYLE_EMOJI: Record<PlayStyle, string>`
  - `const POSITION_ODDS: Record<Position, Record<PlayStyle, number>>` (the chart)
  - `styleOdds(pos: Position, r: Ratings): Record<PlayStyle, number>` — normalized probabilities summing to 1
  - `rollPlayStyle(pos: Position, r: Ratings, seed: number): PlayStyle` — deterministic weighted pick from `styleOdds` using an integer hash of `seed`
  - `hashId(id: string): number` — FNV-1a 32-bit of a string (for migration seeds)

- [ ] **Step 1: Write the failing tests** in `tests/engine/playStyle.roll.test.ts`:
  - `odds table rows sum to 100 and keep the owner's ordering`: each `POSITION_ODDS[pos]` sums to 100; PG top two are smart then offense; SG top is offense then defensive; SF top is allAround and the other four are equal; PF top two are power then defensive; C top two are defensive then power.
  - `styleOdds sums to 1 and is finite for all-99 and all-25 ratings`: build ratings with every key set to 99 / 25 using `RATING_KEYS`; assert each value is finite and ≥ 0 and the sum ≈ 1 for every position.
  - `rollPlayStyle is deterministic`: same inputs twice → same style.
  - `roll frequencies match styleOdds`: for a mid ratings object (all 70) at C, roll over seeds 1..20000; each style's frequency is within 0.02 of `styleOdds`.
  - `a power-profile center is mostly Power`: C with strength, vertical, standingDunk, drivingDunk, postControl, layup = 90, perimeterDefense/interiorDefense/steal/block/rebounds = 60, everything else 60 → `styleOdds('C', r).power >= 0.6`.
  - `a lockdown-profile center is mostly Defensive`: mirror image → `defensive >= 0.6`.
  - `every style keeps a chance at every position`: every `styleOdds(pos, r)` value for a power-profile ratings object is ≥ 0.005.

- [ ] **Step 2: Run to verify failure:** `npx vitest run tests/engine/playStyle.roll.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `playStyle.ts`.** Fit scores are plain averages of ratings: offense = avg(threePointShot, midRangeShot, closeShot, speed, speedWithBall); smart = avg(passVision, passIQ, passAccuracy, shotIQ, helpDefenseIQ, passPerception); power = avg(strength, vertical, standingDunk, drivingDunk, postControl, layup); defensive = avg(max(perimeterDefense, interiorDefense), steal, block, defensiveRebound, offensiveRebound). For the four specialties `fit = clamp(exp((score − mean of the four scores) / 10), 0.4, 3)`; for allAround `fit = clamp(1 + (10 − spread) / 20, 0.6, 1.4)` where spread = max − min of the four scores. `weight = POSITION_ODDS[pos][style] * fit`, normalized. The roll maps `hash(seed)` to [0,1) and walks the cumulative odds. Numbers are starting values; the tests above are the contract.

- [ ] **Step 4: Run to verify pass:** same command → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/engine/player/playStyle.ts tests/engine/playStyle.roll.test.ts
git commit -m "feat: play style odds, ratings tilt and seeded roll"
```

---

### Task 2: Store the style, roll at generation, migrate saves

**Files:**
- Modify: `src/engine/types.ts` (`Player`), `src/engine/player/generate.ts` (return of `generatePlayer`), `src/engine/career/create.ts`, `src/engine/league/create.ts:176` (`version: 16`), `src/save/migrate.ts` (`CURRENT_VERSION = 16`, new `15 → 16` step), any test/fixture building `Player` literals (found by typecheck)
- Test: `tests/engine/playStyle.generate.test.ts`, `tests/save/playStyleMigration.test.ts`

**Interfaces:**
- Consumes: `rollPlayStyle`, `hashId`, `PlayStyle` (Task 1)
- Produces: `Player.playStyle: PlayStyle` (required); `createCareerLeague` opts `build.playStyle?: PlayStyle` (invalid/missing → rolled from the final career ratings); `backfillPlayStyles(raw: { players?: unknown }): void` in `src/engine/player/playStyle.ts` (defensive, works on raw save data, only fills missing/invalid)

- [ ] **Step 1: Write failing tests.**
  - `playStyle.generate.test.ts`: `generatePlayer` gives a valid style; same `Rng` seed twice → same style; **stream unchanged**: after `generatePlayer(rng, …)` the next `rng.next()` equals the value recorded before this change (capture the value on the current commit before editing generate.ts, hard-code it in the test); `createLeague({seed:1,…})` player ids/ratings equal the pre-change run (compare a hash of ids + OVRs recorded before editing); position mix: over a generated league of ≥ 400 players, each position's most common style matches the owner's list (PG smart/offense, SG offense, SF allAround, PF power, C defensive/power).
  - `playStyleMigration.test.ts`: build a v15 `League` (createLeague, delete `playStyle` from every player including a retired one and a free agent, set `version: 15`), run the existing migrate entry point, assert every player has a valid style, `version === 16`, and migrating a second time from the same v15 input gives identical styles. Career: `createCareerLeague` with `build.playStyle = 'power'` keeps `'power'`; with `'bogus' as any` falls back to a valid roll; `ovrOf(player)` is identical for every style.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** (a) Add `playStyle: PlayStyle` to `Player`. (b) In `generatePlayer`, after `ratings` exists, `playStyle: rollPlayStyle(pos, ratings, mixHash(rawSeed, 0x5ca1ab1e))` — no `rng` calls. (c) `createCareerLeague`: after the final `ratings: startRatings(b.max)` is set, `playStyle` = `b.playStyle` if it is in `PLAY_STYLES`, else `rollPlayStyle(b.pos, p.ratings, hashId(p.id))`. (d) Add `backfillPlayStyles` and call it in a `raw.version === 15` step that sets `version: 16`, seeding each player by `hashId(player.id)` and its `pos` + `ratings` (skip players lacking them). (e) Bump `CURRENT_VERSION` and `league/create.ts`.

- [ ] **Step 4: Fix compile errors:** `npm run typecheck`; add `playStyle` to every `Player` literal it reports (use `'allAround'` in fixtures).

- [ ] **Step 5: Run everything:** `npm test` → all PASS except possibly `tests/engine/golden.test.ts` (handled in Task 3).

- [ ] **Step 6: Commit**
```bash
git add -A src tests
git commit -m "feat: store play style on players, roll at generation, save v16 migration"
```

---

### Task 3: Habits in the sim

**Files:**
- Modify: `src/engine/player/playStyle.ts` (add `STYLE_HABITS`, `applyHabits`), `src/engine/sim/game.ts` (`makeSide`, around the `prof[id] = {…}` build)
- Test: `tests/engine/playStyle.habits.test.ts`

**Interfaces:**
- Consumes: `Player.playStyle` (Task 2), `ArchetypeTendencies` (`player/archetype.ts`)
- Produces: `STYLE_HABITS: Record<PlayStyle, StyleHabits>` where `StyleHabits = { zoneMult: [number ×7]; usageMult; handlerMult; passerMult; tovDelta; assistShareDelta; foulDrawMult; stealMult; blockMult; rebOffMult; rebDefMult; paceDelta }`; `applyHabits(t: ArchetypeTendencies, style: PlayStyle): { t: ArchetypeTendencies; rebOffMult: number; rebDefMult: number; paceDelta: number }` (multiplies the multiplier fields, adds the delta fields; returns a new object)

Starting values (zone order layup, driveDunk, standDunk, close, post, mid, three):
- smart: zones [1,1,1,1,1,1.04,1]; usage 1.0; handler 1.1; passer 1.25; tov −0.008; assistShare +0.03; foul 1; steal 1.06; block 1; rebs 1/1; pace 0
- offense: zones [1.06,1.1,0.9,1,0.85,1,1.2]; usage 1.06; handler 1.05; passer 1; tov +0.002; assist 0; foul 1.04; steal 1; block 0.97; rebs 0.95/0.95; pace +8
- allAround: zones all 1; usage 1.02; handler 1.04; passer 1.05; rest neutral; pace 0
- power: zones [1.1,1.08,1.2,1.15,1.3,0.9,0.7]; usage 1.04; handler 0.92; passer 0.95; tov +0.002; foul 1.12; steal 0.97; block 1.08; rebOff 1.15; rebDef 1.05; pace −8
- defensive: zones all 1; usage 0.94; handler 0.96; passer 1; steal 1.2; block 1.2; rebOff 1.1; rebDef 1.2; pace 0

- [ ] **Step 1: Write failing tests.**
  - Unit: `applyHabits` on a neutral tendency object multiplies as listed (e.g. power zone[4] === 1.3, defensive stealMult === 1.2, smart tovDelta === −0.008) and returns a new object (input not mutated).
  - Sim (`createLeague({seed: 1})` + `simGame`, 300 games, same two teams, same ratings): clone the home team's center, give clone A `playStyle: 'power'` and clone B `'defensive'`, identical ratings; over the games, A's (close + post + dunk attempts share) > B's, A's three attempts < B's, B's blk + stl > A's, B's dreb > A's. Use box score lines from `GameResult.box`.
  - Pace: a roster of Offense players averages more possessions per game than the same roster set to Power (compare total FGA + TOV + 0.44 FTA over 100 games).
  - Determinism: the same call with the same seed twice → `JSON.stringify` equal.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** In `makeSide`, replace `const t = arch.tendencies` with the result of `applyHabits(arch.tendencies, p.playStyle)`; multiply `rebOffW`/`rebDefW` by the returned rebound multipliers and add `paceDelta` to `paceSkill`. Archetype detection (`generatePlayerArchetype`) still reads stored ratings — do not change it.

- [ ] **Step 4: Run tests:** `npm test`. The golden hash (`tests/engine/golden.test.ts`) will change because the style now affects games; confirm the new totals are sane (league average points per team 95–120, nothing absurd in `tests/engine/inflation.test.ts` / realism tests), then update the recorded hash deliberately in a separate step of this commit and say why in the message.

- [ ] **Step 5: Commit**
```bash
git add -A src tests
git commit -m "feat: play style habits change shot mix, usage, passing, boards and pace"
```

---

### Task 4: In-sim boosts

**Files:**
- Modify: `src/engine/player/playStyle.ts` (add `BOOSTED_KEYS`, `boostedRatings`), `src/engine/sim/game.ts` (`R`, `makeSide`'s `const r = p.ratings`, the defender loop that reads `players[id].ratings`)
- Test: `tests/engine/playStyle.boost.test.ts`

**Interfaces:**
- Consumes: `Player.playStyle` (Task 2), `RATING_MAX`, `SKILL_KEYS` (`player/ratings.ts`)
- Produces:
  - `BOOSTED_KEYS: Record<PlayStyle, readonly (keyof Ratings)[]>` — offense: threePointShot, midRangeShot, closeShot, speed, speedWithBall; power: strength, vertical, standingDunk, drivingDunk, layup, postControl, postHook, postFade; defensive: perimeterDefense, interiorDefense, steal, block, defensiveRebound, offensiveRebound, helpDefenseIQ; smart: passVision, passIQ, passAccuracy, ballHandle, shotIQ, helpDefenseIQ, passPerception; allAround: every key in `SKILL_KEYS`
  - `boostedRatings(p: Player, smartIq: number, hasSmartMate: boolean): Ratings` — new object; specialties +5 on their keys, allAround +2 on all; smart +`Math.round(3 + clamp((smartIq − 70) / 10, 0, 3))` on its keys; a non-Smart player with `hasSmartMate` gets +1 on `shotIQ` and `passIQ`; every value capped at `RATING_MAX`; input never mutated; `intangibles` never boosted
  - `smartIqOf(r: Ratings): number` = mean of passVision, passIQ, shotIQ

- [ ] **Step 1: Write failing tests.**
  - `boostedRatings` power: power player's `strength` is +5 vs stored, `threePointShot` unchanged; input object unchanged (deep equal to a copy).
  - Cap: a player with every skill 99 stays all 99; with every skill 25 power gets 30 on its keys.
  - allAround: every skill key +2 except `intangibles` (unchanged).
  - Smart scaling: the Smart bump is `Math.round(3 + clamp((smartIq − 70) / 10, 0, 3))`, so `smartIq` 70 → +3, 85 → +5, 100 → +6; teammate lift gives a non-Smart player +1 on `shotIQ`/`passIQ` only.
  - No-Smart team and all-Smart lineup: `simGame` runs without NaN scores (`Number.isFinite` on both scores and every box stat) for a team whose roster is all `'smart'` and one with none.
  - OVR untouched: after `simGame`, the league's `players[id].ratings` deep-equal their pre-game values and `ovrOf` unchanged.
  - Effect: 300 games, a team of five clones set to `'power'` vs the same team set to `'allAround'` with identical ratings → the power team's points in the paint share is higher, and a 70-OVR all-power team does not beat an 80-OVR non-boosted team in a majority of 200 games (balance guard).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** In `simGame` after `players` is resolved: for each side compute `smartIq` = max `smartIqOf` among that team's top-8 rotation (starters + first bench slots in rotation order) whose `playStyle === 'smart'` (none → 0, hasSmartMate false); build `eff: Record<string, Ratings>` with `boostedRatings`. Change `R = id => eff[id]`; in `makeSide` use `const r = eff[id]` for the profile math **but keep `generatePlayerArchetype(p)` on the stored player**; in the defender loop use `eff[id]`. Leave `slotFit`, `lineupPenalties`, `drainPerMinute` (stamina) and everything outside `simGame` on stored ratings. No `rng` draws.

- [ ] **Step 4: Run tests and re-check calibration:** `npm test`; if league averages drift out of the realism tests' bounds, reduce the +5 specialty / +2 allAround values together until they pass, and update the spec's "starting sizes" line with the final numbers. Update the golden hash again if it changed.

- [ ] **Step 5: Commit**
```bash
git add -A src tests docs
git commit -m "feat: play style boosts inside the sim (ratings and OVR untouched)"
```

---

### Task 5: Portrait badges and boosted stat highlights

**Files:**
- Create: `src/ui/components/StyleBadge.tsx`
- Modify: `src/ui/theme.css`, `src/ui/components/PlayerCell.tsx`, `src/ui/components/GameDay.tsx` (`StarterCard`), `src/ui/components/EventModal.tsx`, `src/ui/watch/WatchCard.tsx`, `src/ui/watch/WatchPlayerSheet.tsx`, `src/ui/screens/PlayerPage.tsx` (header portrait and the ratings list at the `p.ratings[k]` rows)
- Test: `tests/ui/styleBadge.test.ts`

**Interfaces:**
- Consumes: `STYLE_EMOJI`, `STYLE_LABEL`, `BOOSTED_KEYS` (Tasks 1, 4)
- Produces: `<StyleBadge style={PlayStyle} corner="tl"|"tr"|"bl"|"br" />` — an absolutely positioned emoji `span` with `title`/`aria-label` `"<Label> style"`; pure helper `badgeLabel(style: PlayStyle): string` (the title text) and `isBoosted(style: PlayStyle, key: keyof Ratings): boolean` for the list highlight

- [ ] **Step 1: Write failing tests** (`tests/ui/styleBadge.test.ts`): `badgeLabel('power') === 'Power style'`; `STYLE_EMOJI` is exactly 🧠 ⚔️ 🏀 💪 🛡 for smart/offense/allAround/power/defensive; `isBoosted('power','strength') === true`, `isBoosted('power','threePointShot') === false`, `isBoosted('allAround', k)` is false for every key (All-Around gets a text note instead of per-stat marks, see Step 3).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement.** The portrait site gets a `position: relative` wrapper and a badge in the corner **opposite the OVR**: GameDay `StarterCard` (OVR pill sits below the face) → top-right; EventModal and WatchCard/WatchPlayerSheet/PlayerPage header → opposite corner from wherever each already shows OVR (read the surrounding markup; default top-right if OVR is bottom-left/below); `PlayerCell` small table portraits (OVR is its own column) → bottom-right at a size scaled to the face (`size * 0.45`px font). Roster/trade tables call `PlayerCell`, so they pick it up for free. In the PlayerPage ratings list, rows where `isBoosted(p.playStyle, k)` get a class `boosted` (accent colour on the name plus a small ▲) with a title "Power boost: plays +5 in games" (use the real bump from the boost table); under the list a one-line note for All-Around ("All-Around: +2 to every stat in games") and for Smart ("Smart: boost grows with the smartest Smart player on the roster"). Displayed numbers and OVR stay the stored ones.

- [ ] **Step 4: Verify.** `npm run typecheck && npm test`; then `npm run dev`, load a league and screenshot the Game Day hero, the Roster table and a player page with Playwright (chromium preinstalled; `deviceScaleFactor: 2`), check each badge sits opposite the OVR and nothing overflows at 390px width.

- [ ] **Step 5: Commit**
```bash
git add -A src tests
git commit -m "feat: play style emoji badges on portraits, boosted stats highlighted"
```

---

### Task 6: MyCareer — choose a style

**Files:**
- Modify: `src/ui/screens/career/Builder.tsx` and the store action that calls `createCareerLeague` (find with `grep -rn createCareerLeague src`)
- Test: extend `tests/engine/career.create.test.ts`

**Interfaces:**
- Consumes: `CareerBuildInput.playStyle?` (Task 2), `PLAY_STYLES`, `STYLE_EMOJI`, `STYLE_LABEL`, `styleOdds`
- Produces: Builder state `playStyle: PlayStyle`, defaulting to the most likely style from `styleOdds(pos, startRatings(max))` and re-defaulting only until the user touches the picker

- [ ] **Step 1: Write failing test** in `career.create.test.ts`: `createCareerLeague` with `build.playStyle='smart'` → `league.players[career.playerId].playStyle === 'smart'`, and `ovrOf` is equal across all five styles for the same build.

- [ ] **Step 2: Run to verify failure,** then implement the picker (five emoji buttons with labels, the current choice highlighted, a one-line description of each style) and pass the choice through to `createCareerLeague`.

- [ ] **Step 3: Verify:** `npm run typecheck && npm test`; screenshot the builder at phone width.

- [ ] **Step 4: Commit**
```bash
git add -A src tests
git commit -m "feat: MyCareer builder lets the player pick his play style"
```

---

### Task 7: Docs and ship

**Files:**
- Modify: `CLAUDE.md` (add a play-styles bullet and bump "Save format … (version 16)")

- [ ] **Step 1:** Add to CLAUDE.md: play styles live in `src/engine/player/playStyle.ts`; `Player.playStyle` is rolled once at generation from position odds × ratings fit (seeded from `rawSeed`, never the league `Rng`); habits and boosts only inside `simGame` (`eff` ratings), never in stored ratings or OVR; spec path.
- [ ] **Step 2:** `npm test && npm run typecheck && npm run build` → all green.
- [ ] **Step 3:** Commit on the working branch, push it, fast-forward into `main`, push `main`, and check the "Deploy to GitHub Pages" workflow finishes green (CLAUDE.md "Always ship to the live site"). If it fails, fix before reporting done.
- [ ] **Step 4:** Tell the owner the site is updated and what changed in a few sentences.

```bash
git add CLAUDE.md
git commit -m "docs: play styles notes"
```
