# Rookie classes, a tighter OVR scale, and new rating tiers — design

Date: 2026-11-23 · Size: small change (short design)

## Intent
First-round rookies are often unplayable, and 80+ OVR is too common to feel special (~1 in 3 starters).
The owner wants rookies who matter (think Flagg or Wembanyama) and a scale where 70 is a solid rotation
player, mid-80s is elite, 90 is a build-around player, and 95+ is a hard carry.

## Goals
- First-rounders are playable: floor about 68 OVR. Lottery picks are better, and the #1 pick is often about 80.
- 80+ means a star; the top end (~90 and ~95+) is unchanged.
- The tier colors match the new scale.

## Non-goals / anti-goals
- No save migration. Saves are throwaway, so new leagues get the new scale and old saves just keep their vets.
- Must not inflate the league over many seasons (about 30 strong rookies a year must not push everyone up).
- Draft randomness stays on the existing `Rng`; story RNG is untouched.

## Approaches considered
- A. Fix only the draft: cheap, but 80s stay common, so an 80 rookie feels like a normal starter.
- **B. Trim the middle for new leagues plus fix the draft (chosen).**
- C. Remap existing saves through a migration: cleanest result, but it changes every team and contract, which is too risky.

## Design
1. **Draft class** (`src/engine/gm/draft.ts`): rank the class by quality. Rank 1 targets about 80 (generational roll keeps a ~60% chance at the top two, otherwise about 74-77). Ranks 2-5 are about 74-79, 6-14 about 70-75, and 15-30 about 68-71 (floor 68). Round 2 stays about 45-60. POT scales with it (`o + 3` minimum, cap 97), so an 80 rookie sits in the 90s.
2. **New-league talent** (`src/engine/league/create.ts`): starters go from `N(78,3)` to about `N(74.5,3)` (range about 68-84), bench stays about 70, and deep bench goes to about 64. Superstar and lead tiers are unchanged. The free-agent pool and the `roster.ts` filler players shift down by the same offset.
3. **Tiers** (`src/ui/ovrTier.ts`, `src/ui/watch/watch.css`):

   | OVR | Tier |
   |---|---|
   | below 70 | bronze |
   | 70-75 | silver |
   | 76-80 | gold |
   | 81-85 | purple |
   | 86-94 | diamond (new icy-cyan look) |
   | 95+ | prismatic diamond (the current rainbow) |

   *My call:* the "86-95 diamond, 95+ prismatic" ranges overlap at 95, so 95 itself goes to prismatic.
4. **Verification:** unit tests for the draft class shape (floor, top-pick range, POT bounds) and the tier function. A 10-season sim confirms the league's OVR distribution stays stable. `npm test` and `npm run typecheck` must pass before shipping.

## Left to the builder
Exact curve constants (tuned with the sim), the diamond color values, and whether the Draft/Roster screens need any copy changes.

## Verification results (8-season sim, seed 5, `SIM_LONG=1 npx vitest run tests/engine/inflation.test.ts`)
- **Finding:** the old engine already inflated (80+ players 63 → ~110, top-8 average 77.0 → 79.5). With stronger classes alone the plateau got worse (80+ about 155, top-8 about 82).
- **Causes fixed (all in the spirit of the spec's "no inflation" anti-goal):**
  1. Prospect POT offsets lowered (elite +9, generational +14, rest +6; age penalty 1.5/yr).
  2. Veteran POT growth at generation trimmed (`(27 - age) * 1.0`, sd 3, was `* 1.6`, sd 4).
  3. `createLeague` franchise-quality shift now moves POT with ratings (it used to leave POT behind, so "bad" teams snapped back up).
  4. Offseason no longer lets non-development players grow 1 point past their ceiling, and the under-27 POT random walk is biased slightly down (`N(-0.6, 1.5)`).
- **Result (rostered players, 420):** start 80+ = 37; plateau after about 6 seasons is 80+ ≈ 74 (about 18%, 2-3 per team), 85+ ≈ 30, 90+ ≈ 10, top-8 average 74.9 → 77.8. The old engine plateaued at 80+ ≈ 110.
- The default `npm test` skips the long sim.
