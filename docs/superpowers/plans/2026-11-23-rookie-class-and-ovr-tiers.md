# Rookie Class, Tighter OVR Scale and New Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make first-round rookies playable (floor 68, #1 pick about 80), trim the middle of new leagues so 80+ means a star, and recolor the OVR tiers to the new scale.

**Architecture:** Draft-class quality becomes a pure, testable target curve (`prospectTargets`) consumed by `generateProspects`. New-league tier constants in `create.ts` shift down. `ovrTier` and `watch.css` get the new tier names and colors. No save-format change.

**Tech Stack:** TypeScript, Vitest, React/Vite, pure-TS engine (`Rng` only, never `Math.random`).

**Spec:** `docs/superpowers/specs/2026-11-23-rookie-class-and-ovr-tiers-design.md`

## Global Constraints

- Engine code in `src/engine/` uses `Rng`, never `Math.random`, React or DOM.
- Story randomness must not shift game results, and this change touches no story code.
- First-round prospects (the top 30 of the class) have OVR >= 68. Round-2 prospects stay about 45-60 (cap 62).
- POT: minimum `ovr + 3`, maximum 97 for prospects (existing rule, keep it).
- Tiers: below 70 bronze, 70-75 silver, 76-80 gold, 81-85 purple, 86-94 diamond, 95+ prismatic. 95 itself is prismatic (my call from the spec).
- League top end unchanged: 1 lead at 94-97, 7 superstars at 89-97, 22 leads at 78-88.
- Do not deploy red: run `npm test` and `npm run typecheck` before merging to `main`.

## Review Focus

- A class that rolls no generational player still has 30 prospects at 68 or above.
- Tier boundaries 69/70, 75/76, 80/81, 85/86, 94/95 land in the right tier.
- Nothing still references the removed `tier-dual` / `'dual'` names.
- Existing saves still load and play, because only generation and UI colors change.
- Ten seasons of drafts do not inflate the league's share of 80+ players.

---

### Task 1: Tier function and colors

**Files:**
- Modify: `src/ui/ovrTier.ts`
- Modify: `src/ui/watch/watch.css:107-120`
- Test: `tests/ui/ovrTier.test.ts` (create)

**Interfaces:**
- Produces: `type OvrTier = 'prismatic' | 'diamond' | 'purple' | 'gold' | 'silver' | 'bronze'`; `ovrTier(v: number): OvrTier`.
- Consumes: `WatchCard.tsx` already builds `tier-${ovrTier(ovr)}` class names, so CSS must define a class for every tier name.

- [ ] **Step 1: Write the failing test** in `tests/ui/ovrTier.test.ts`. One `it.each` table asserting `ovrTier(v)` for: 50 and 69 → `bronze`; 70 and 75 → `silver`; 76 and 80 → `gold`; 81 and 85 → `purple`; 86 and 94 → `diamond`; 95 and 99 → `prismatic`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/ovrTier.test.ts`. Expected: FAIL (wrong tiers).
- [ ] **Step 3: Implement** the new `OvrTier` union and thresholds in `src/ui/ovrTier.ts`, and update its doc comment.
- [ ] **Step 4: Update `watch.css`.** Rename the `tier-dual` rules to `tier-prismatic` (keep the `--rainbow` gradient). Add `tier-diamond` rules for `.w-face` (icy-cyan border, about `#7fe7ff`) and `.w-ovr` (cyan background with dark text). `purple` stays `#a45bff`, and `gold` and `silver` keep their colors. Update the comment above the block. Then `grep -rn "dual" src` must return nothing relevant.
- [ ] **Step 5: Run** `npx vitest run tests/ui/ovrTier.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(ui): new OVR tiers (diamond and prismatic)`.

### Task 2: Draft class curve

**Files:**
- Modify: `src/engine/gm/draft.ts:28-46`
- Test: `tests/engine/draftClass.test.ts` (create)

**Interfaces:**
- Produces: `export function prospectTargets(rng: Rng): { target: number; generational: boolean }[]` returns `PROSPECTS` (70) entries sorted by `target` descending. Also `export function generateProspects(l: League, rng: Rng)` (same return shape as today, now exported).
- Consumes: `generatePlayer(rng, { season, age, targetOvr })` from `src/engine/player/generate.ts`.

- [ ] **Step 1: Write the failing tests** in `tests/engine/draftClass.test.ts`. Loop over seeds 1..200 with `Rng.fromSeed(seed)`:
  - `prospectTargets` has length 70 and is sorted descending.
  - The first 30 entries are all `>= 68`; entries 30..69 are all `<= 62` and `>= 42`.
  - Over all seeds, the mean of entry 0 is between 77 and 82. Entry 0 is always `<= 84`.
  - The class has a generational player (`generational: true`) in at least 40% of seeds and at most 80% of seeds.
  - Mean of entries 14..29 is between 68 and 71.5. Mean of entries 5..13 is between 70 and 75.
  - Using `createLeague({ seed: 1, userTeamIndex: 0, name: 'T' })` and `generateProspects`, each of the first 30 prospect ids has `computeOvr(p.ratings, p.pos) >= 67`, and every prospect has `pot >= ovr + 3` and `pot <= 97`.
- [ ] **Step 2: Run** `npx vitest run tests/engine/draftClass.test.ts`. Expected: FAIL (`prospectTargets` not exported).
- [ ] **Step 3: Implement `prospectTargets`.**
  - Ranks 0 and 1 each roll generational with probability 0.6, giving `N(80, 1.5)` clamped to 77..84. Otherwise they use the slot curve below.
  - Slot curve by rank `r`: `r` 0-4 about `79 - 0.9 * r` (with rank 0 non-generational at about 77); `r` 5-13 about `74.5 - 0.55 * (r - 5)`; `r` 14-29 about `70.5 - 0.15 * (r - 14)`. Add `rng.normal(0, 1.2)` noise, round, and clamp the first 30 to `>= 68`.
  - Ranks 30-69 use `clamp(round(rng.normal(54, 5.5)), 42, 62)`.
  - Sort descending at the end. The constants are guides; tune them so the Step 1 means hold.
- [ ] **Step 4: Rewire `generateProspects`** to take targets from `prospectTargets` in order. Keep the existing POT formula, using `elite = rank < 8` and the entry's `generational` flag. The `targetOvr` passed to `generatePlayer` is clamped to 42..84 (it was 42..74). Keep the scouting-fuzz code unchanged.
- [ ] **Step 5: Run** `npx vitest run tests/engine` and `npm run typecheck`. Expected: PASS, including the existing `gm.test.ts` (it asserts 70 prospects).
- [ ] **Step 6: Commit** `feat(engine): stronger first-round draft classes`.

### Task 3: New-league talent scale

**Files:**
- Modify: `src/engine/league/create.ts:63-72,139-143`
- Modify: `src/engine/gm/roster.ts:223`
- Test: `tests/engine/leagueScale.test.ts` (create)

**Interfaces:**
- Consumes: `createLeague({ seed, userTeamIndex, name }): League` and `computeOvr`.

- [ ] **Step 1: Write the failing test.** For seeds 1..10, build a league and take every player with a `teamId`. Assert on their OVRs:
  - count `>= 80` is at most 12% of rostered players (was about 25%);
  - count `>= 89` is between 6 and 10, and at least 1 player is `>= 94`;
  - the mean OVR of non-star players is between 66 and 72;
  - the count `>= 70` is at least 40% of rostered players (rotation players are common).
- [ ] **Step 2: Run** `npx vitest run tests/engine/leagueScale.test.ts`. Expected: FAIL (too many 80+).
- [ ] **Step 3: Implement the scale change in `create.ts`.** Starters: `clampT(rng.normal(74.5, 3), 68, 84)`. Bench: `clampT(rng.normal(70, 3), 62, 79)`. Deep bench: `clampT(rng.normal(64, 3), 56, 72)`. Superstar and lead tiers untouched. Free agents: `clampT(rng.normal(62, 2.5), 58, 66)` with the reject loop bounds `58..66`. Update the comment above the tiers.
- [ ] **Step 4: Implement the matching filler shift in `roster.ts:223`:** `targetOvr: Math.max(53, Math.min(70, Math.round(rng.normal(62, 3.5))))`.
- [ ] **Step 5: Run** `npm test` and `npm run typecheck`. Fix any existing test that hard-coded the old scale by adjusting its numbers, not by weakening what it checks. Expected: PASS.
- [ ] **Step 6: Commit** `feat(engine): tighter OVR scale for new leagues`.

### Task 4: Ten-season inflation check

**Files:**
- Test: `tests/engine/inflation.test.ts` (create)
- Modify: `docs/superpowers/specs/2026-11-23-rookie-class-and-ovr-tiers-design.md` (append results)

**Interfaces:**
- Consumes: the season and offseason loop used by `tests/engine/gm.test.ts:145-190` (`advanceOffseason`, draft auto-picks, free agency, new schedule). Reuse that loop.

- [ ] **Step 1: Write the test** as `it.skipIf(!process.env.SIM_LONG)('league does not inflate over 10 seasons', { timeout: 600_000 }, ...)`. It builds a league, records the count of rostered players with OVR `>= 80` and the mean OVR of the top 8 per team, plays 10 full seasons, and asserts the final count of 80+ players is within 1.5x of the starting count and the top-8 mean moved by less than 3 points.
- [ ] **Step 2: Run** `SIM_LONG=1 npx vitest run tests/engine/inflation.test.ts`. If it fails, tune the Task 2 and 3 constants (mostly the 15-30 band and the starter mean) and re-run Tasks 2 and 3 tests. Expected: PASS.
- [ ] **Step 3: Append the measured start and end numbers** to the spec doc under a "Verification results" heading, and note that the default `npm test` skips this test.
- [ ] **Step 4: Commit** `test(engine): 10-season inflation check`.

### Task 5: Ship to the live site

**Files:** none.

- [ ] **Step 1: Run** `npm test`, `npm run typecheck` and `npm run build`. All must pass.
- [ ] **Step 2: Push** the working branch `claude/blissful-lovelace-o0vd3l`, then fast-forward or merge into `main` and `git push origin main` (standing permission in `CLAUDE.md`).
- [ ] **Step 3: Check** that the "Deploy to GitHub Pages" workflow run finishes green (use the GitHub Actions tools). If it fails, fix it before calling the work done.
- [ ] **Step 4: Tell the owner** the site is updated and that the phone app picks it up on its next launch with signal.
