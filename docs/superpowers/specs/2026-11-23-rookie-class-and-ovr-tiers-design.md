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
