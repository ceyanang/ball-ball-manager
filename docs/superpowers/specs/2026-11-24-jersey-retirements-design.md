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
- If assigning jerseys is simple, a retired number is skipped for new players on that team. If not, it is a later follow-up.
- Unsigned or released-at-the-end retirees count the same way as anyone else.

## Left to the builder
Exact score thresholds, season counts and the cap curve; card styling; where the player-page mark sits.
