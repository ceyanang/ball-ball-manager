# Jersey Retirements — Design

## Intent
When a long-time player retires, each team he gave a lot to can retire his number. The honor is per team (he can be a legend on two squads). A new History tab, built like the Records page with a team picker, shows each team's retired numbers and immortalizes the players.

## Goals
- Two ways in, as the owner described them:
  - **Star door:** he was a star for that team (franchise icon).
  - **Lowry door:** not the most insane player, but consistently good over a long stay and won a title with that team.
- Honor is decided at retirement only, per team he played for.
- Rare: a team's retired numbers should feel special, not common.
- Each card says why ("9 seasons · 2 titles") so the reason is visible.
- "Immortalized": players are linked to their player page, which shows a "#N retired by TEAM" mark. News item for any retirement; inbox ping when it is the user's team.

- **Number clash:** if a current player on that team already wears the retired number (numbers don't change on trades, so this happens), he is given a random new number. It avoids his teammates' numbers and that team's retired numbers, and follows the number taste below.
- **Number taste (new players only):** newly generated numbers prefer low, "aesthetic" ones. Roughly: 1-10 are common; most of the rest are under 35; above 10 the last digit is usually 5 or lower (23, 15, 30 yes; 17, 28, 39 rarely); 36-99 and ugly endings still happen as rare outliers. Existing players keep their numbers.

## Non-goals / anti-goals
- No GM button to retire a number by hand, no fan vote, no ceremony screen.
- Must not change game results (no RNG; fully deterministic from league state).
- Must not feel like a participation award: if every long-term starter gets one, it failed.

## Approaches considered
- **A. Team score (chosen).** Reuse the Hall of Fame `careerScore` math, restricted to the player's seasons with one team. Star door = high team score. Lowry door = lower bar plus many seasons plus at least one title with that team. Bars rise as a team's retired list grows.
- B. Plain checklist (years + award/title). Easy to read but blunt.
- C. Fan vote via `fans.base`. Rejected: that stat tracks current players and is messy for retired ones.

## Design
- **Data:** `League.retiredJerseys: RetiredJersey[]` with `{ teamId, playerId, number, season, seasons, titles, score, door: 'star' | 'loyal' }`. Bump the save to version 10 and add a migration (empty list; see my calls).
- **Engine:** new `src/engine/stories/jerseys.ts`. `careerScore` is split so it can score a subset of seasons for one team (stat lines, awards, title rosters from that team's years). `onRetired` in `stories/hooks.ts` calls it after Hall of Fame induction, once per team the player played for. Only the engine hook touches it, as with the other stories.
- **Cap:** each team's bars rise with the number it has already retired (exact curve left to the builder, tuned by simulating many seasons so a team averages roughly one retirement every few seasons).
- **UI:** a new "Jerseys" tab in `History.tsx`, with a team dropdown like Records (defaults to the user's team). Cards are banner/jersey-shaped in team colors: number, face, name, "seasons · titles", link to the player page. Empty state text for teams with none. Player page gets a small mark per retired number.
- **Tests:** unit tests for both doors, the rising bar, per-team scoring, the migration, and a check that results are unchanged with the feature on.

## My calls (not yours, check these)
- The number shown is the player's `jersey` at retirement. If the engine already changes it on moves, the builder uses the most recent one worn with that team.
- Old saves backfill from players who already retired, so the tab isn't empty. If that proves messy, they start empty instead.
- Retired numbers are never given to anyone new on that team (draft, signing, trade, reassignment). This replaces the earlier "if easy" idea.
- The reassignment draw uses `storyRng`, so it can't shift game results. The new number-taste draw changes the RNG stream for brand-new leagues only (seeded new leagues will look different from before; saves are untouched), so any seed-pinned test expectations get updated.
- Where number generation is used (`player/generate.ts`, `league/create.ts`), both share one helper so the taste lives in one place.
- Unsigned or released-at-the-end retirees count the same way as anyone else.

## Left to the builder
Exact score thresholds, season counts and the cap curve; card styling; where the player-page mark sits.
