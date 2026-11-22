# Talent, Grades, Blurbs, In-Season Progress, Dark Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the league talent level, show colour-coded lettered ratings and a scouting blurb, let ratings move during the season, and switch the UI to dark grey.

**Architecture:** All rules live in the pure-TS engine (`src/engine/`). This covers grades, tiered generation, the sim pivot, the progression tick inside `stepDay`, and blurbs. The UI only renders them. The `League` gains `progress` events, so the save version goes from 1 to 2, with a migration applied in `loadSave` and `parseImport`.

**Tech Stack:** Existing — React, TypeScript, Vitest, IndexedDB (idb).

**Spec:** `docs/superpowers/specs/2026-11-22-talent-grades-progress-design.md` (follow-up to `docs/superpowers/specs/2026-11-22-ball-ball-manager-design.md`)

## Global Constraints
- Individual ratings and OVR are always integers in **40..99**.
- Grade scale:
  - A+ ≥97, A 93–96, A− 90–92
  - B+ 87–89, B 83–86, B− 80–82
  - C+ 77–79, C 73–76, C− 70–72
  - D+ 67–69, D 63–66, D− 60–62
  - F <60
- Colour scale: **dark red at 40 → dark green at 99**, continuous.
- League targets:
  - ≥70% of starters (rotation top 5) have OVR ≥ 76
  - Mean OVR of rotation spots 6–12 ≥ 70
  - Free agents are 60–68
- Sim realism tests in `tests/engine/game.test.ts` and `tests/engine/season.test.ts` stay green with their current bounds.
- In-season progress runs every 10 days of the **regular season only**, for **rostered** players. It never goes above `pot` when rising and never goes outside 40..99.
- Save `version: 2`. Version-1 saves (IndexedDB or import) migrate by adding `progress: []`.
- After the work: follow `CLAUDE.md`. Run tests and typecheck, push the branch, fast-forward `main`, push, and confirm the Pages deploy is green.

## Review Focus
1. **An existing v1 save on the owner's phone** loads without crashing and gets `progress: []`. Test in Task 4.
2. **Progress ticks never push a rating above 99 or below 40, or OVR above `pot` on a rise.** Test in Task 4.
3. **A player with no games yet** gets a ratings-only blurb, never "averaging 0.0 points". Test in Task 5.
4. **Free agents and the playoffs never trigger progress events.** Test in Task 4.
5. **An old league (v1 talent levels)** still renders grades and colours for ratings below 40, clamped to the F / dark-red end. Test in Task 1.

---

### Task 1: Grades and rating colours
**Files:** Create `src/engine/player/grades.ts`, `src/ui/ratingColor.ts`. Test `tests/engine/grades.test.ts`.

**Interfaces — Produces:**
- `gradeFor(v: number): string`, using the scale above. Values below 40 still return `'F'`.
- `ratingColor(v: number): string`, returning a CSS `hsl()` string. Clamp v to 40..99. Hue runs 0→130 linearly. Lightness is about 32% at both ends and about 48% in the middle, so the ends read as "dark" red and green on a dark surface. Saturation is about 70%.

- [ ] **Step 1: Write failing tests:**
  - `gradeFor` boundaries: 99 → A+, 97 → A+, 96 → A, 93 → A, 92 → A−, 90 → A−, 89 → B+, 83 → B, 80 → B−, 79 → C+, 76 → C, 73 → C, 72 → C−, 70 → C−, 69 → D+, 63 → D, 60 → D−, 59 → F, 40 → F, 12 → F.
  - `ratingColor(40)` has hue 0 and lightness ≤ 35. `ratingColor(99)` has hue ≥ 120 and lightness ≤ 35. Hue is non-decreasing from 40 to 99. `ratingColor(10)` equals `ratingColor(40)`.
- [ ] **Step 2:** `npx vitest run tests/engine/grades.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: letter grades and rating colour scale`.

### Task 2: Talent shift
**Files:** Modify `src/engine/player/generate.ts`, `src/engine/league/create.ts`, `src/engine/contracts.ts`. Tests: `tests/engine/player.test.ts`, `tests/engine/league.test.ts`.

**Interfaces — Produces (signatures unchanged):**
- `generatePlayer(rng, opts)`:
  - Clamps every rating to **40..99**.
  - The default target is `normal(70, 8)` clamped to 50..95.
  - `pot` is clamped to `max(ovr, …)..99`.
- `createLeague`:
  - Generates **tiers per team**: 1 lead from `normal(84,4)`, 4 starters from `normal(78,3)`, 7 bench from `normal(71,3)`, and 2 deep-bench from `normal(66,3)`. That's 14 per team, 420 in total.
  - Snake-drafts the players **within each tier** (the existing positional-needs logic applies across the whole build), so the teams stay balanced.
  - Free agents come from `normal(64,2.5)` clamped to 60–68.
- `salaryForPlayer`:
  - Anchors become OVR ≤ 64 → `MIN_SALARY` and OVR ≥ 92 → `MAX_SALARY`, same convex curve. The age discount is unchanged.
  - Payroll trimming stays as a safety net.

- [ ] **Step 1: Update tests first:**
  - Player: the default-distribution test becomes "median 68–72, share ≥ 85 between 1% and 8%". Add a test that all ratings are in 40..99 over 2000 players, including `targetOvr: 45`.
  - Salary anchors: OVR 60 → 1000, OVR 92 → 45000, and monotone from 40 to 99.
  - League:
    - `≥70% of rotation starters OVR ≥ 76`
    - `mean OVR of bench slots (rotation.bench) ≥ 70`
    - `every free agent 60..68`
    - The existing spread, payroll, and balance tests stay as they are.
- [ ] **Step 2:** `npx vitest run tests/engine/player.test.ts tests/engine/league.test.ts`. Expected: FAIL on the new assertions.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS. Sim tests may now fail; that's Task 3.
- [ ] **Step 5:** Commit `feat: raise league talent level (starters 76+, bench 70+)`.

### Task 3: Recalibrate the sim
**Files:** Modify `src/engine/sim/game.ts`.

**Interfaces — Produces:** `K.pivot`, the rating that counts as "average". It replaces every literal `60` used as a rating baseline in `game.ts`: shooter, defender, turnover, rebound, IQ/ath and usage. Start it at the new league mean, about 72. Retune `K` and the FT formula until the existing realism tests pass.

- [ ] **Step 1:** Run `npx vitest run tests/engine/game.test.ts tests/engine/season.test.ts`. Expected: FAIL or PASS with the new talent. Record which bounds fail.
- [ ] **Step 2:** Introduce `K.pivot` and tune. Use a temporary calibration print (as in M1, then delete it). Target about 111 PPG, FG% about 46.5, 3P% about 36, FT% about 77, and leaders around 30/13/9.
- [ ] **Step 3:** Run the full `npm test`. Expected: PASS.
- [ ] **Step 4:** Commit `fix: recalibrate sim for the new talent level`.

### Task 4: In-season progress + save v2
**Files:**
- Create `src/engine/player/progress.ts`, `src/save/migrate.ts`.
- Modify `src/engine/types.ts`, `src/engine/season/advance.ts`, `src/engine/league/create.ts`, `src/save/db.ts`.
- Tests: `tests/engine/progress.test.ts`, `tests/save/db.test.ts`.

**Interfaces — Produces:**
- `types.ts`:
  - `export interface ProgressEvent { season: number; day: number; playerId: string; teamId: string; from: number; to: number }`
  - `League.version: 2`
  - `League.progress: ProgressEvent[]`
- `progressTick(league: League, rng: Rng): ProgressEvent[]` mutates player ratings and returns the events (only players whose OVR changed). Rules:
  - Rostered players only.
  - Chance to rise: age ≤ 23: 0.40; 24–27: 0.25; 28–30: 0.12; 31+: 0.06.
  - Chance to fall: age ≤ 27: 0.04; 28–30: 0.12; 31–32: 0.25; 33+: 0.40.
  - On a change, pick 2–4 ratings, weighted toward the player's position weights, and move each by 1–2 points in that direction.
  - Clamp ratings to 40..99. On a rise, undo the step if the new OVR would exceed `pot`.
  - Tune the probabilities so the spec's season totals hold.
- In `stepDay`: when `phase === 'regular'` and `league.day % 10 === 0`, after the day's games, push `progressTick` events into `league.progress`.
- `createLeague` sets `version: 2, progress: []`.
- `migrateLeague(raw: any): League` in `src/save/migrate.ts`:
  - v1 → v2 adds `progress: []`.
  - v2 passes through unchanged.
  - Any other version throws `SaveImportError`.
- `loadSave` and `parseImport` call `migrateLeague`. `parseImport` accepts versions 1 and 2, and its structural checks run after migration.

- [ ] **Step 1: Write failing tests:**
  - `progress.test.ts`:
    - `season totals`: sim a full regular season with `simUntil('regularEnd')`. The mean OVR change for players aged ≤ 23 is between +1.5 and +5, and for age ≥ 33 it is between −4 and −0.5.
    - `bounds`: after the season, every rating is in 40..99, and no player who only rose went above `pot`.
    - `free agents untouched`: FA ratings deep-equal the pre-season ratings.
    - `no events in playoffs`: every event has `day ≤` the last regular-season day.
    - `events only when OVR changed`: `from !== to` for every event.
    - `deterministic`.
  - `db.test.ts`:
    - `loads a v1 save from IndexedDB and migrates`: write a league with `version: 1` and no `progress`, then `loadSave` returns `version: 2` with `progress: []`.
    - `imports a v1 file` (same check).
    - `rejects version 3`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full `npm test && npm run typecheck`. Expected: PASS. Update any test that asserted `version: 1`.
- [ ] **Step 5:** Commit `feat: in-season rating progress and save v2 migration`.

### Task 5: Scouting blurb
**Files:** Create `src/engine/player/describe.ts`. Test `tests/engine/describe.test.ts`.

**Interfaces — Produces:** `describePlayer(p: Player, stats: StatLine | null): string`, made of 1–3 sentences.
1. **Archetype line from ratings.** Use the top two skill groups and a weakness, where:
   - shooting = three/mid
   - finishing = ins/ath
   - playmaking = pass/handle
   - rebounding = oreb/dreb
   - perimeter D = perD/stl
   - rim protection = intD/blk
   - IQ = iq

   Example: "A knockdown shooter who can also run the offense." The weakness is the lowest group, and only if it's < 65: "Defense is a work in progress."
2. **Season line**, only when `stats && stats.gp > 0`. Example: "Averaging 24.1 points and 6.3 assists this season." Use the two most notable per-game numbers.
3. **Age/potential flavour:** "Still raw, with a high ceiling." when age ≤ 22 and pot − ovr ≥ 8, or "A savvy veteran." when age ≥ 32.

Template variants are picked with `Rng.fromSeed(p.faceSeed)`, so the text is deterministic per player and never touches the league RNG.

- [ ] **Step 1: Write failing tests:**
  - A high-three player (three 92, the rest about 70) mentions shooting: matches `/shoot|range|three|arc/i`.
  - A high intD/blk center mentions rim protection: `/rim|block|paint|protect/i`.
  - Low defense (perD, intD, stl and blk all 45) gives a weakness sentence: `/defen/i`.
  - `stats === null` or `gp === 0` never contains "averaging" or "0.0".
  - With stats, it contains "Averaging" and a per-game number.
  - Deterministic for the same player.
  - Returns 1–3 sentences.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: algorithmic scouting blurbs`.

### Task 6: UI — dark grey theme, graded ratings, blurb, progress report
**Files:** Modify `src/ui/theme.css`, `src/ui/screens/PlayerPage.tsx`, `src/ui/screens/Home.tsx`, `src/ui/components/OvrChart.tsx`, `src/ui/components/RosterTable.tsx`, `src/ui/screens/MyTeam.tsx`, `index.html` (theme-color), `vite.config.ts` (manifest colours).

Behaviour:
- **Theme:** a single dark grey palette in `:root`. Remove the light and dark media blocks. Tokens:
  - `--bg #121314`, `--surface #1b1c1e`, `--surface-2 #242528`
  - `--ink #ececee`, `--ink-2 #9b9ea5`, `--line #303236`
  - Sidebar `#0b0b0c`. The accent stays orange. `color-scheme: dark`.
  - Win and loss tokens stay readable on dark: `#3ccf8e` and `#ff6b6b`.
- **Player page:**
  - Each rating row shows the value and its grade. The bar fill uses `ratingColor(v)`.
  - The OVR big number is coloured with `ratingColor` and shows its grade.
  - Potential shows `gradeFor(pot)`.
  - The blurb (`describePlayer`) sits under the header.
  - "+N this season" (green) or "−N" (red) compares the current OVR with `ratingHistory` for the current season. It is omitted when the change is 0.
- **OVR chart:** append a "Now" point when the current OVR differs from the last history value.
- **Roster tables and My Team:** the OVR cell is a small pill coloured by `ratingColor`, with the grade in a tooltip.
- **Home:** a "Progress report" panel.
  - It lists the user's team's events from `league.progress` for the current season (newest first, up to 8), formatted like "📈 Name 74 → 76" or "📉 …".
  - It also lists "Around the league": the 3 biggest season-to-date risers and 3 biggest fallers, by current OVR − season-start OVR.
  - Empty state: "Ratings update every 10 days of the season."

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify:**
  - `npm run typecheck && npm test`.
  - Playwright on the dev server: new league → sim to day 21 → check that Home shows a Progress report entry, that the player page shows grades for all 15 ratings plus OVR and potential, and that the bar colour for a 40-something rating is reddish and for a 90+ rating greenish (read the computed style hues).
  - Screenshots at desktop width and 390px, with no horizontal page overflow and no console errors.
- [ ] **Step 3:** Commit `feat: dark grey theme, graded colour ratings, blurbs, progress report`.

### Task 7: Ship
- [ ] Push the branch. Run `git checkout main && git merge --ff-only <branch> && git push origin main`, then return to the branch.
- [ ] Confirm the "Deploy to GitHub Pages" run is green and `https://ceyanang.github.io/ball-ball-manager/manifest.webmanifest` returns 200 with the new build. A Playwright smoke test on the live URL should create a league and show a dark UI.
