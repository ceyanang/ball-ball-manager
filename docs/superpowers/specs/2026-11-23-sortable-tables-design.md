# Sortable tables, full stat lines & roster peek — design

Date: 2026-11-23 · Status: awaiting approval

## Intent and the why
The owner decides trades on a phone and wants to judge players by real production (STL, BLK, FG%, …) and
compare their own roster with other players *without leaving the trade*. Today the roster table shows only
GP/PTS/REB/AST, is unsortable, and checking "how is my team producing" means leaving the Trade screen.
The owner also wants Excel-style sorting/filtering on most tables, and starters/bench grouping by default.

## Goals
1. Roster tables (team page, My Team) show the full stat line: MIN, PTS, REB, AST, STL, BLK, TOV, PF, FG%, 3P%, FT%, +/-.
2. Roster tables group by **Starters / Bench / Inactive** by default (from `team.rotation`; teams without
   a usable rotation fall back to OVR order, top 5 = starters).
3. A reusable `DataTable`: click header to sort asc/desc (click again flips, third click clears),
   position filter, text search, numeric min/max filter on a chosen column (e.g. OVR ≥ 75, FG% ≥ 45).
4. A **roster peek sheet** (existing `Sheet` component) opened from the Trade screen for *my* team and the
   *trade partner's* team, and from the top bar for my team. Opening it never disturbs the in-progress offer.
5. Roll `DataTable` out to the other plain tables (Leaders, Free Agents, Draft, Standings, All-Star,
   My Team contracts, Offseason, FrontOffice, History) — after the roster tables are proven.

## Non-goals / anti-goals
- No engine, sim, or save-format change (display only; no `League` version bump).
- Do not make the Trade screen layout cramped or side-by-side on phones.
- Do not lose the trade offer, scroll position, or rotation edits when the sheet opens/closes.
- No new dependencies (no table library).
- Failure even if it "works": unreadable on a 360px phone, or sorting that scrambles Starters/Bench with no way back.

## Constraints
- React + TS; pure-TS logic belongs in `src/ui/` helpers that are unit-testable (Vitest); no `Math.random`.
- Stats come from `playerSeasonStats` / `perGame` (`src/engine/stats/stats.ts`); players with 0 GP show "—" and sort last in both directions.
- Percentages with 0 attempts are "—", not .000.
- Sticky first (Player) column + horizontal scroll for wide tables.
- Must pass `npm test`, `npm run typecheck`; ship per CLAUDE.md (push branch, merge to `main`, check Deploy workflow).

## Approaches considered
- **A (chosen): roster-peek sheet, either team, from anywhere.** Fits the trade workflow and reuses `Sheet`;
  phone-friendly; partner-team button gives most of the side-by-side value.
- B: side-by-side panel inside Trade. Best comparison but cramped on phones and a Trade redesign (risky).
- C: only improve the big tables, no popup. Smallest, but doesn't solve "check my team mid-trade".
Owner picked A.

## Design
- `src/ui/tableSort.ts` (pure): `Column<T>` = `{ key, label, value(row) → number|string|null, format, align, defaultDir, filterable? }`;
  `sortRows(rows, col, dir)` (nulls last always, stable, name tiebreak); `filterRows(rows, {pos, q, ranges})`.
- `src/ui/components/DataTable.tsx`: renders columns, sortable `<th>` (button, `aria-sort`, ▲/▼), optional
  filter bar (pos chips, search, "column ≥ / ≤ value"), optional `groups` prop (`[{label, rows}]`) rendered
  as header rows. Sorting while grouped → flat list with a "Back to Starters/Bench" chip.
- `src/ui/rosterColumns.ts`: the column set (identity: Player/Pos/Age/OVR/POT; stats; contract) shared by
  team page, My Team and the peek sheet; stat columns are per-game, with a Per game/Totals toggle (my call, cheap).
- `RosterTable` becomes a thin wrapper over `DataTable` (+ grouping from rotation). `TeamPage` and `MyTeam` get it for free.
- `src/ui/components/RosterPeek.tsx`: `Sheet` + `RosterTable` for a `teamId`. Trade screen gets two buttons
  ("My team", "Their team"); top bar gets a 📊 for my team.
- Rollout step: convert remaining `<table className="stats">` screens one by one with per-screen columns.

## Decided by the owner
Approach A; full stat columns; starters/bench default; Excel-like sort/filter on most tables; peek used while trading.

## My calls (flag if you disagree)
- Sort cycle desc→asc→off, numeric columns default to descending, name/pos ascending.
- Per-game default with Totals toggle.
- Inactive players shown in a third group, collapsed by default.
- Filter/sort state is per-table and **not** persisted across visits (keeps it simple).
- Rollout screens ordered: roster tables → peek sheet → Free Agents → Leaders → the rest.

## Left to the builder
Exact column widths/abbreviations, styling tokens, a11y details, and test fixtures.

## Testing
Unit tests for `sortRows`/`filterRows` (nulls-last, ties, asc/desc, ranges, 0-attempt pct) and grouping
from a rotation; manual phone-width check of the peek sheet over a half-built trade.
