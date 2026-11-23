# Sortable tables, full stat lines & roster peek — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortable/filterable tables with full stat lines, Starters/Bench grouping, and a roster-peek sheet usable mid-trade.

**Architecture:** Pure sort/filter helpers (`tableSort.ts`) feed a generic `DataTable`. `rosterColumns.ts` defines the roster column set and starters/bench grouping; `RosterTable` becomes a thin wrapper. `RosterPeek` is the existing `Sheet` around `RosterTable`, opened from Trade and the app bar. Display-only: no engine or save changes.

**Tech Stack:** React + TypeScript + Vite, Vitest (`renderToStaticMarkup` for component tests, as in `tests/ui/recapTable.test.tsx`), plain CSS in `src/ui/theme.css`.

**Spec:** `docs/superpowers/specs/2026-11-23-sortable-tables-design.md`

## Global Constraints

- No engine/sim/save change; no `League` version bump. No new dependencies. No `Math.random`.
- Stats come from `seasonLine(league, p)` (`src/ui/util.ts`) → `{ s: StatLine, pg: PerGame } | null`.
- Players with 0 GP show "—" and sort last in **both** directions. Percentages with 0 attempts are `null` ("—"), never ".000".
- Percent columns' `value()` is 0–100 (what the user sees/types), not 0–1.
- Sort cycle per header: `defaultDir` → opposite → off. Numeric columns default `desc`; Player/Pos default `asc`.
- Sticky first (Player) column + horizontal scroll (`.table-wrap`); readable at 360px.
- Peek sheet must never reset trade state (it lives in `Trade`; the sheet holds only its own state).
- Filter/sort state is per-table, not persisted.
- Ship per CLAUDE.md: `npm test` + `npm run typecheck` green, push branch, merge to `main`, push, confirm "Deploy to GitHub Pages" is green.

## Review Focus

- Player with 0 GP (new signee/rookie): row shows "—", sorts last for asc and desc.
- 0-attempt FG%/3P%/FT%: `null`, excluded by a range filter, sorts last.
- Sorting while grouped flattens the list; clearing the sort restores Starters/Bench/Inactive.
- `team.rotation` referencing a player no longer on the roster, or an unlisted new signee: grouping must not crash and must still list every rostered player exactly once.
- Filter that matches nothing shows "No players match", not an empty table; tied values keep a stable order.

---

### Task 1: Pure sort/filter helpers

**Files:**
- Create: `src/ui/tableSort.ts`
- Test: `tests/ui/tableSort.test.ts`

**Interfaces:**
- Produces:
  - `type SortDir = 'asc' | 'desc'`; `type SortState = { key: string; dir: SortDir } | null`
  - `nextSort(cur: SortState, key: string, defaultDir: SortDir): SortState`
  - `sortRows<T>(rows: readonly T[], value: (r: T) => number | string | null, dir: SortDir): T[]` (nulls last for both dirs, stable, strings via `localeCompare`)
  - `filterRows<T>(rows: readonly T[], f: { pos?: string; q?: string; range?: { value: (r: T) => number | null; min?: number; max?: number } }, get?: { pos?: (r: T) => string; name?: (r: T) => string }): T[]` (`pos` of `'All'`/undefined = no filter; `q` case-insensitive substring of `get.name`; range excludes `null` values)

- [ ] **Step 1: Write failing tests** in `tests/ui/tableSort.test.ts`: `nextSort(null,'pts','desc')` → `{key:'pts',dir:'desc'}`; then `'asc'`; then `null`; a different key restarts at its `defaultDir`. `sortRows([{v:2},{v:null},{v:1}], r=>r.v, 'asc')` → `[1,2,null]` and with `'desc'` → `[2,1,null]`; equal values keep input order; strings sort `a<B` case-insensitively. `filterRows` with `range {min:45}` drops `null` and `44.9`, keeps `45`; `q:'smi'` matches "Smith"; `pos:'All'` keeps everything; no match returns `[]`.
- [ ] **Step 2:** Run `npx vitest run tests/ui/tableSort.test.ts` — expect FAIL (module missing).
- [ ] **Step 3:** Implement the module above. Sort with an index tiebreak for stability.
- [ ] **Step 4:** Run the same command — expect PASS.
- [ ] **Step 5:** Commit `feat(ui): table sort/filter helpers`.

### Task 2: Roster columns and Starters/Bench grouping

**Files:**
- Create: `src/ui/rosterColumns.ts`
- Test: `tests/ui/rosterColumns.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `seasonLine`, `ovrOf`, `money`, `one`, `pct` from `src/ui/util.ts`; `archetypeFor`.
- Produces:
  - `interface StatCol<T> { key: string; label: string; title?: string; align?: 'left' | 'right'; defaultDir: SortDir; value: (r: T) => number | string | null; text?: (r: T) => string }` (React-free; `DataTable` adds rendering via `text`/`cell`)
  - `type StatMode = 'pg' | 'tot'`
  - `rosterColumns(league: League, mode: StatMode): StatCol<Player>[]` — keys/order: `player`(name), `pos`, `age`, `ovr`, `pot`, `gp`, `min`, `pts`, `reb`, `ast`, `stl`, `blk`, `tov`, `pf`, `fg`, `tp`, `ft`, `pm`, `salary`, `through`. `fg/tp/ft` are 0–100 or `null` at 0 attempts; every stat column is `null` when the player has no GP (`gp` itself is `0`).
  - `groupRoster(team: Team, players: Player[]): { label: 'Starters' | 'Bench' | 'Inactive'; rows: Player[] }[]` — from `team.rotation` (ids not on `players` dropped; rostered players absent from the rotation appended to Bench); if fewer than 5 starters resolve, fall back to OVR order (top 5 Starters, rest Bench, no Inactive). Empty groups omitted.

- [ ] **Step 1: Write failing tests** using `createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })` (see `tests/ui/recapTable.test.tsx`): a 0-GP player's `pts` value is `null`; a player with `fga: 0` has `fg` `null`; with `fgm: 4, fga: 10` `fg` is `40`; `mode:'tot'` `pts` equals `StatLine.pts`, `'pg'` equals `perGame` pts. `groupRoster` on a real team: group row-counts sum to roster size, no id appears twice, first group is `Starters` with 5. With a rotation containing a bogus id and one roster player removed from the rotation: no throw, bogus id absent, the removed player is in `Bench`. With `starters: []`: top-5 OVR are Starters.
- [ ] **Step 2:** Run `npx vitest run tests/ui/rosterColumns.test.ts` — FAIL.
- [ ] **Step 3:** Implement. Reuse `seasonLine`; build one `lineOf(p)` per call, not per column.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat(ui): roster columns and starters/bench grouping`.

### Task 3: `DataTable` component

**Files:**
- Create: `src/ui/components/DataTable.tsx`
- Modify: `src/ui/theme.css` (sortable header, sticky first column, group header row, filter bar; reuse `.seg`/`.chip`/`.table-wrap`/`table.stats`)
- Test: `tests/ui/dataTable.test.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, `StatCol` from Task 2.
- Produces: `export interface Column<T> extends StatCol<T> { cell?: (r: T) => React.ReactNode }` and
  `export function DataTable<T>(props: { rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; groups?: { label: string; rows: T[] }[]; filters?: { pos?: (r: T) => string; name?: (r: T) => string; range?: boolean }; defaultSort?: SortState; rowClass?: (r: T) => string | undefined; emptyText?: string; ariaLabel: string }): JSX.Element`
  Behavior: header cells are `<button>`s inside `<th aria-sort=…>` with ▲/▼; clicking cycles via `nextSort`. With `groups` and no sort and no active filter → one header row per group (`<tr class="group-row"><th colSpan>`); otherwise flat list over `rows` plus a "Back to Starters/Bench" chip that clears sort/filters. Filter bar (only if `filters`): position chips (All/PG/SG/SF/PF/C via `POSITIONS` from `src/ui/playerFilter.ts`) when `filters.pos`, name search when `filters.name`, and when `range`: column `<select>` (numeric columns only) + min/max number inputs. Empty result → `emptyText ?? 'No players match.'`. Cell text: `col.cell?.(r) ?? col.text?.(r) ?? (value ?? '—')`.

- [ ] **Step 1: Write failing tests** with `renderToStaticMarkup` for a 3-row fixture: initial markup has `aria-sort="none"` on sortable headers; `defaultSort {key:'pts',dir:'desc'}` renders rows highest-first with `aria-sort="descending"` on PTS; `null` values render "—" and appear last under asc and desc; with `groups` and no sort the markup contains the group labels; with a `defaultSort` it does not and contains the "Back to" chip; `rows: []` renders the empty text. (Click behavior is covered by `nextSort` tests; state transitions are exercised manually in Task 7.)
- [ ] **Step 2:** Run `npx vitest run tests/ui/dataTable.test.tsx` — FAIL.
- [ ] **Step 3:** Implement with local `useState` for sort/pos/q/range; memoize the sorted/filtered list. Group label rows are not sortable.
- [ ] **Step 4:** Run — PASS; run `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(ui): sortable, filterable DataTable`.

### Task 4: Roster tables use it (team page + My Team)

**Files:**
- Modify: `src/ui/components/RosterTable.tsx` (becomes a wrapper; signature gains `team: Team`), `src/ui/screens/TeamPage.tsx:22,55`
- Test: `tests/ui/rosterTable.test.tsx`

**Interfaces:**
- Consumes: `rosterColumns`, `groupRoster`, `DataTable`.
- Produces: `RosterTable({ league, team, players, mode? }: { league: League; team: Team; players: Player[]; mode?: StatMode })` — owns a "Per game / Totals" `.seg` toggle (default `pg`), passes `groups={groupRoster(team, players)}`, `filters={{ pos: p => p.pos, name: fullName, range: true }}`, `PlayerCell` with `archetypeFor` subtitle in the Player column (`cell`), `OvrPill` in the OVR column.

- [ ] **Step 1: Write failing test:** render `RosterTable` for the user's team of a fresh league; markup contains headers `STL`, `BLK`, `FG%`, `3P%`, `FT%`, `+/-`, the group labels `Starters` and `Bench`, and has 5 rows under Starters.
- [ ] **Step 2:** Run `npx vitest run tests/ui/rosterTable.test.tsx` — FAIL.
- [ ] **Step 3:** Rewrite `RosterTable`; update `TeamPage` call (`team={team}`) and drop its now-redundant `.sort` by OVR only if grouping covers it (keep the sort — flat fallback uses it).
- [ ] **Step 4:** `npx vitest run && npm run typecheck` — PASS.
- [ ] **Step 5:** Commit `feat(ui): full stat lines and starters/bench on roster tables`.

### Task 5: Roster peek sheet (Trade + app bar)

**Files:**
- Create: `src/ui/components/RosterPeek.tsx`
- Modify: `src/ui/screens/Trade.tsx` (buttons beside the partner `<select>`, ~line 142-148), `src/ui/layout/Shell.tsx` (📊 `icon-btn` in `.mbar` and the desktop `.topbar`; reuse `Icon` or an emoji label "Roster stats")
- Test: `tests/ui/rosterPeek.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`src/ui/components/Sheet.tsx`), `RosterTable`.
- Produces: `RosterPeek({ open, onClose, teamId }: { open: boolean; onClose: () => void; teamId: string })` — title is the team's full name; reads `league` from `useStore`; renders `RosterTable` inside `Sheet`. `Trade` keeps `peek: 'me' | 'them' | null` state and renders two buttons "My team" and "Their team" (the latter uses current `partner`); `Shell` keeps its own open state for my team. Opening/closing touches no `give/get/partner` state.

- [ ] **Step 1: Write failing test:** `RosterPeek` with `open` for the user's team renders (store seeded via `useStore.setState({ league })`, see `tests/ui/store.test.ts`) a `<dialog>` whose label is the team name and which contains `Starters`.
- [ ] **Step 2:** Run `npx vitest run tests/ui/rosterPeek.test.tsx` — FAIL.
- [ ] **Step 3:** Implement component and wire buttons; the Trade "Their team" button follows the partner `<select>`.
- [ ] **Step 4:** `npx vitest run && npm run typecheck` — PASS.
- [ ] **Step 5:** Commit `feat(ui): roster peek sheet for trades and app bar`.

### Task 6: Roll out — My Team contracts, Free Agents, Leaders

**Files:**
- Modify: `src/ui/screens/MyTeam.tsx:245-266` (contracts table; keep the Release button via a `cell` column), `src/ui/screens/FreeAgents.tsx`, `src/ui/screens/Leaders.tsx`
- Test: extend `tests/ui/rosterTable.test.tsx` or add `tests/ui/leaders.test.tsx` only where a screen gains testable pure logic.

**Interfaces:**
- Consumes: `DataTable`, `Column`.
- Produces: no new exports; each screen defines its own `Column[]` (OVR, POT, Age, Salary, relevant stats) with `filters` as the screen warrants (FA: pos + name + range; Leaders: keep its existing category selector, make the board sortable).

- [ ] **Step 1:** Read each screen first; keep existing behavior (Release button + confirm, FA sign/offer actions, Leaders category switch) unchanged.
- [ ] **Step 2:** Convert the three tables; contracts default-sorted by salary desc (as today).
- [ ] **Step 3:** `npx vitest run && npm run typecheck` — PASS.
- [ ] **Step 4:** Commit `feat(ui): sortable contracts, free agents and leaders`.

### Task 7: Roll out — remaining list tables, then manual check

**Files:**
- Modify: `src/ui/screens/Standings.tsx`, `Draft.tsx`, `FrontOffice.tsx`, `AllStar.tsx`, `Offseason.tsx`, `History.tsx` — only tables that are a flat list of rows (skip `BoxScore`, `Schedule`, `Home`, `PlayerPage` game logs: their order is chronological/meaningful — my call, flagged to the owner).

- [ ] **Step 1:** Convert each flat-list table to `DataTable`, keeping default order and any highlight classes (`me`, `cut`) via `rowClass`.
- [ ] **Step 2:** `npx vitest run && npm run typecheck && npm run build` — all pass.
- [ ] **Step 3:** Manual check with `npm run dev` at 360px width: team page (stats scroll, Player column sticky, header taps sort asc/desc/off, group chip returns to Starters/Bench); open Trade, stage a deal, open "My team" and "Their team" sheets, close — the staged deal is untouched; a range filter like OVR ≥ 75 and FG% ≥ 45 works; a 0-GP rookie shows "—".
- [ ] **Step 4:** Commit `feat(ui): sortable tables across list screens`.

### Task 8: Ship

- [ ] **Step 1:** `npm test && npm run typecheck` green.
- [ ] **Step 2:** Push `claude/funny-tesla-kxggd8`; fast-forward/merge into `main`; `git push origin main`.
- [ ] **Step 3:** Check the "Deploy to GitHub Pages" run finished green (`mcp__github__actions_list`); fix first if red.
- [ ] **Step 4:** Tell the owner the site is updated.
