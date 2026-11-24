# Jersey Retirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire a player's number with each team he starred for (or loyally served and won a title with), show them on a new History tab, and give new players low "aesthetic" numbers.

**Architecture:** A pure number picker (`player/jerseyNumber.ts`), a stories module (`stories/jerseys.ts`) that scores a player's years with one team and decides retirement, called from `onRetired`. Save goes to version 10 with `retiredJerseys`. A "Jerseys" tab in `History.tsx` mirrors the Records team picker.

**Tech Stack:** TypeScript, React, Vitest. Engine stays free of React/DOM/`Math.random` (use `Rng`; story draws use `storyRng`).

**Spec:** `docs/superpowers/specs/2026-11-24-jersey-retirements-design.md`

## Global Constraints
- Engine code uses `Rng`, never `Math.random`; story randomness uses `storyRng` so game results never shift.
- Save is JSON-serializable; version bumps 9 → 10 with a migration in `src/save/migrate.ts`.
- Retired numbers are never worn by anyone new on that team; a current teammate wearing a freshly retired number gets a random new number avoiding teammates' numbers and the team's retired numbers.
- Number taste: 1-10 common, most under 35, above 10 the last digit is usually 0-5; outliers allowed; existing players keep their numbers.
- Doors: star (high team score) or loyal (lower bar + many seasons + at least one title with that team); bars rise with the team's retired count.
- `npm test` and `npm run typecheck` must pass before shipping.

## Review Focus
- Player who played for two teams: each team judged only on its own years.
- Player with no stat lines (never played): retires nothing, no crash.
- Retiree's number held by a teammate on a full-numbered roster: reassignment still terminates.
- Traded/drafted/signed/claimed player whose number is already retired by his new team: renumbered.
- Old save (v9) loads, gets `retiredJerseys`, no crash on empty history.

---

### Task 1: Number taste
**Files:** Create `src/engine/player/jerseyNumber.ts`; Modify `src/engine/player/generate.ts:57`, `src/engine/league/create.ts:130`; Test `tests/engine/jerseyNumber.test.ts`
**Interfaces:** Produces `pickJersey(rng: Rng, taken?: ReadonlySet<number>): number` (0-99, never in `taken`).
- [ ] Write failing tests: over 5000 draws from a seeded `Rng`, ≥85% are ≤35; ≥ 40% are 1-10; among draws >10 at least 85% end in 0-5; `taken` numbers never returned; some draws >60 still occur.
- [ ] Run `npx vitest run tests/engine/jerseyNumber.test.ts` → FAIL.
- [ ] Implement `pickJersey` as a weighted pick over 0..99: 1-10 weight 10 (0 weight 2); 11-35 weight 6 when last digit ≤5 else 1; 36-99 weight 0.5 when last digit ≤5 else 0.08; `taken` weight 0.
- [ ] Use it in `generate.ts` (`jersey: pickJersey(rng)`) and in the `create.ts` dedupe loop (`p.jersey = pickJersey(rng)`).
- [ ] Run full `npm test`; update any seed-pinned expectations that changed. Commit.

### Task 2: Data model and migration
**Files:** Modify `src/engine/types.ts` (add `RetiredJersey`, `League.retiredJerseys`, `version: 10`), `src/engine/stories/state.ts` (`emptyStories`), `src/engine/league/create.ts` (`version: 10`), `src/save/migrate.ts` (`CURRENT_VERSION`, 9→10 step); Test `tests/save/db.test.ts` (or new `tests/save/migrate.test.ts`)
**Interfaces:** Produces `interface RetiredJersey { teamId: string; playerId: string; number: number; season: number; seasons: number; titles: number; score: number; door: 'star' | 'loyal' }`.
- [ ] Failing test: a v9 league migrates to version 10 with `retiredJerseys: []`.
- [ ] Implement the changes above; migration adds `retiredJerseys: []` (backfill is Task 6). Run tests; commit.

### Task 3: Team scoring, doors, retirement hook
**Files:** Create `src/engine/stories/jerseys.ts`; Modify `src/engine/stories/awards.ts` (export a shared per-season score helper so `careerScore` and the team score use one formula), `src/engine/stories/hooks.ts` (`onRetired`); Test `tests/engine/jerseys.test.ts`
**Interfaces:** Produces `teamStint(l: League, playerId: string, teamId: string): { seasons: number; titles: number; score: number }`; `evaluateJerseys(l: League, playerIds: string[], opts?: { silent?: boolean }): RetiredJersey[]`; constants `STAR_SCORE`, `LOYAL_SCORE`, `LOYAL_SEASONS`, `BAR_STEP`.
- [ ] Failing tests (hand-built league via `tests/engine/helpers.ts`): star with high team-only score is retired by that team; a long-serving title-winner below the star bar is retired through the loyal door; the same player without a title is not; a player with two teams is judged per team (big years on team A do not retire him with team B); a team's second candidate needs a higher score than its first; a player with no stat lines retires nothing; retiring creates a news item and, for the user's team, an inbox ping.
- [ ] Implement `teamStint` (non-playoff stat lines for that team only; awards count only for seasons he has a line with that team; a title counts when `championId === teamId` and he is in `championRoster`; no pre-league credit) and `evaluateJerseys` (per team: star if `score >= STAR_SCORE + BAR_STEP * retiredCount`, loyal if `score >= LOYAL_SCORE + BAR_STEP * retiredCount && seasons >= LOYAL_SEASONS && titles >= 1`; number = `p.jersey`; skip if that team already retired him). Call it from `onRetired` after `induct`.
- [ ] Run tests; commit.

### Task 4: Number clashes
**Files:** Modify `src/engine/stories/jerseys.ts`, `src/engine/gm/roster.ts` (`sign`, `claimWaiver`), `src/engine/gm/draft.ts` (rookie signing), `src/engine/gm/trade.ts` (`executeTrade`); Test `tests/engine/jerseys.test.ts`
**Interfaces:** Produces `renumberIfRetired(l: League, p: Player): void` (new number from `pickJersey(storyRng(l, salt), taken)`; `taken` = teammates' numbers + that team's retired numbers; no-op if his number is not retired by his team) and `renumberHolders(l: League, teamId: string, number: number, exceptId: string): void`.
- [ ] Failing tests: retiring #23 renumbers a current teammate wearing 23 and nobody else; the new number is not a teammate's or retired; a player signed/claimed/drafted/traded to a team that retired his number gets a new one; renumbering is deterministic for the same league.
- [ ] Implement both; call `renumberHolders` from `evaluateJerseys` and `renumberIfRetired` after the team change in the four join sites. Run tests; commit.

### Task 5: Jerseys tab and player mark
**Files:** Modify `src/ui/screens/History.tsx` (add `'Jerseys'` to `TABS`, new `Jerseys` component beside `Records`), `src/ui/screens/PlayerPage.tsx`, `src/ui/theme.css`; Test `tests/ui/` (follow the existing History/Hall of Fame test pattern)
- [ ] Failing UI test: with a league containing one retired jersey, the Jerseys tab shows the number, player name and "9 seasons · 2 titles" text for that team and an empty-state message for a team with none; the player page shows "#N retired by TEAM".
- [ ] Implement: team dropdown (defaults to the user's team), banner cards in team colors with `Face`, number, name link to `/player/:id`, seasons/titles line, a "Star" or "Loyal" label; empty state. Add the mark on `PlayerPage`. Run tests and `npm run typecheck`; commit.

### Task 6: Backfill and tuning
**Files:** Modify `src/save/migrate.ts`; Create `scripts/tuneJerseys.ts` (or a throwaway test) ; Test `tests/save/`
- [ ] Failing test: migrating a v9 league that has retired players with long careers yields retired jerseys without news/pings and without crashing on a league with no stat lines.
- [ ] Implement backfill (same structural guard as the fan backfill; retirees ordered by last season played; `evaluateJerseys(..., { silent: true })`).
- [ ] Sim many seasons with several seeds; adjust `STAR_SCORE`, `LOYAL_SCORE`, `LOYAL_SEASONS`, `BAR_STEP` so a team averages about one retirement every few seasons and the first ones feel like real stars. Commit the final constants.

### Task 7: Ship
- [ ] `npm test` and `npm run typecheck` green. Merge into `main`, push, confirm the "Deploy to GitHub Pages" run is green, then tell the owner (per `CLAUDE.md`).
