# Find a Player (Trade Finder mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user describe a player they need (position, min OVR, optional max age / max salary) and get ready-to-accept trade offers for matching players, paid for only with assets the user ticked as available.

**Architecture:** Pure-TS engine gains `findTargets` (built on `suggestPackage`, which gets an optional asset `pool`) and a `neediestPosition` helper. The Trade finder screen gets a mode toggle; the new mode lives in its own `FindPlayer.tsx`, sharing offer-card asset rows with the existing mode via a small extracted component.

**Tech Stack:** React + TypeScript + Vite, Vitest. Engine in `src/engine/` stays free of React/DOM/Math.random.

**Spec:** `docs/superpowers/specs/2026-11-23-find-a-player-design.md`

## Global Constraints

- Engine code in `src/engine/` uses no React, DOM or `Math.random`.
- No save-format change: `League` stays version 8, no migration.
- Every returned deal must pass `tradeProblem` and `aiVerdict(...).ok` (same rules as every other trade).
- Only assets the user ticked as available may ever appear in `gives` from the user's side.
- `npm test` and `npm run typecheck` pass before committing; ship to `main` and confirm the "Deploy to GitHub Pages" run is green (CLAUDE.md).

## Review Focus

- Empty `available` list: returns `[]`, no crash; UI says to tick something.
- No player matches the filters (e.g. minOvr 99): returns `[]`; UI shows an empty-state message.
- Trades closed (deadline/playoffs): returns `[]`; UI shows the existing closed notice.
- Target is injured or on the user's own team: never offered from the user's own team.
- Ticked asset becomes unavailable after a trade/sim (stale selection): no crash, no deal using it.

---

### Task 1: Engine — `findTargets`, pooled `suggestPackage`, `neediestPosition`

**Files:**
- Modify: `src/engine/gm/trade.ts` (`suggestPackage` ~line 123; add `findTargets` after `findOffers`)
- Modify: `src/engine/gm/needs.ts` (add `neediestPosition`)
- Test: `tests/engine/gm.test.ts` (new `describe('find a player')`), `tests/engine/needs.test.ts`

**Interfaces:**
- Consumes: `tradeableAssets`, `aiVerdict`, `tradeProblem`, `tradesOpen`, `ovr` (from `cap.ts`), `teamNeeds`, `needRank`, `POSITIONS`.
- Produces:
  - `suggestPackage(l: League, fromTeam: string, toTeam: string, wanted: Asset[], pool?: Asset[]): Asset[] | null` — when `pool` is given it replaces `tradeableAssets(l, fromTeam)` as the spendable set.
  - `interface TargetCriteria { pos: Position; minOvr: number; maxAge?: number; maxSalary?: number }`
  - `interface TargetDeal { teamId: string; target: Asset; gives: Asset[] }`
  - `findTargets(l: League, me: string, criteria: TargetCriteria, available: Asset[]): TargetDeal[]`
  - `neediestPosition(l: League, teamId: string): Position` in `needs.ts`.

- [ ] **Step 1: Write failing tests** in `tests/engine/gm.test.ts` (fixtures `fresh`, `user`, `best`, `P` already exist):
  - `returns only matching players, sorted by target OVR desc`: `const l = fresh(); const mine = best(l, user(l)).slice(1, 5).map(p => P(p.id)); const deals = findTargets(l, user(l), { pos: 'SG', minOvr: 50 }, mine)`; expect every `l.players[d.target.id]` has `pos === 'SG'`, `ovr >= 50`, `teamId !== user(l)`, and OVRs non-increasing.
  - `never spends assets that were not ticked`: every `a` in every `d.gives` is in `mine` (compare by `kind:id`).
  - `every deal is legal and AI-acceptable`: for each deal `tradeProblem(l, { a: user(l), b: d.teamId, aGives: d.gives, bGives: [d.target] })` is `null` and `aiVerdict(l, d.teamId, d.gives, [d.target]).ok` is `true`; and `proposeTrade` on the first deal returns `ok` and moves the target to the user's team.
  - `respects maxAge and maxSalary`: with `maxAge: 24` all targets `age <= 24`; with `maxSalary: 3` (check unit in `contract.salary`) all targets `contract.salary <= 3`.
  - Review Focus: `empty available → []`; `{ pos: 'C', minOvr: 99 } → []`; `after simUntil past deadline (tradesOpen false) → []`; `a stale available entry (player no longer on my team) never appears in gives and does not throw`.
  - Perf: whole call under 1500 ms (same budget as `findOffers` test).
  In `tests/engine/needs.test.ts`: `neediestPosition returns a position whose need level is the lowest-ranked on that team` (compute via `teamNeeds` + `needRank`; ties broken by `POSITIONS` order).
- [ ] **Step 2: Run** `npx vitest run tests/engine/gm.test.ts tests/engine/needs.test.ts` — Expected: FAIL (`findTargets` / `neediestPosition` not exported).
- [ ] **Step 3: Implement** `suggestPackage` optional `pool` (one-line change: `const base = pool ?? tradeableAssets(l, fromTeam)`).
- [ ] **Step 4: Implement `findTargets`** in `trade.ts`: return `[]` if `!available.length || !tradesOpen(l)`. Candidates = for each other team, `tradeableAssets` players matching `pos`, `ovr >= minOvr`, `age <= maxAge`, `contract.salary <= maxSalary`; sort by OVR desc, keep the top 12 league-wide; for each, `suggestPackage(l, me, teamId, [target], available)`; keep non-null results (suggestPackage already enforces `tradeProblem` + `aiVerdict`). Result order = target OVR desc.
- [ ] **Step 5: Implement `neediestPosition`** in `needs.ts` using `teamNeeds` and `needRank` (lowest rank wins, ties by `POSITIONS` order).
- [ ] **Step 6: Run** the same vitest command — Expected: PASS. Then `npm run typecheck` — Expected: no errors.
- [ ] **Step 7: Commit**

```bash
git add src/engine/gm/trade.ts src/engine/gm/needs.ts tests/engine/gm.test.ts tests/engine/needs.test.ts
git commit -m "feat(trade): findTargets - find a player and package it from available assets"
```

---

### Task 2: UI — "Find a player" mode in the Trade finder

**Files:**
- Create: `src/ui/components/OfferAssets.tsx` (extract the `o.gives.map(...)` asset rows from `TradeFinder.tsx` ~lines 105-135 into `export function OfferAssets({ league, assets, colors })`; no behavior change)
- Create: `src/ui/screens/FindPlayer.tsx` (`export function FindPlayer()`)
- Modify: `src/ui/screens/TradeFinder.tsx` (use `OfferAssets`; add the mode toggle `Shop my guys` / `Find a player`, rendering `<FindPlayer />` for the second mode; keep existing trades-closed notice above both)

**Interfaces:**
- Consumes: `findTargets`, `TargetCriteria`, `TargetDeal`, `proposeTrade`, `tradeableAssets` (trade.ts); `neediestPosition`, `POSITIONS` (needs.ts); `AssetList` (Trade.tsx); `OfferAssets`; `rejectionText`, `tradeLabel` (tradeText.ts); store `act`.
- Produces: nothing used elsewhere.

- [ ] **Step 1: Extract `OfferAssets`** from `TradeFinder.tsx` and use it there; `npm run typecheck` — Expected: no errors, Shop mode renders as before (check in `npm run dev`).
- [ ] **Step 2: Build `FindPlayer.tsx`**:
  - Filter row: position `<select>` (default `neediestPosition(league, me)`), min OVR number input (default 60), optional max age, optional max salary (blank = no limit).
  - Available list: `AssetList` over `tradeableAssets(league, me)` with a `Set<string>` of `kind:id` keys, header "Available to trade" and a note "Only these will be offered".
  - "Find players" button (disabled with no ticked assets; busy label "Searching the league…", same `setTimeout` pattern as TradeFinder) calling `findTargets`.
  - Results: one card per `TargetDeal` — team badge + name, target shown first via `OfferAssets` with label "You get", then what you send via `OfferAssets` with label "You send", salary in/out, `Tweak` link to `/trade?team=${teamId}&gives=${gives keys}&gets=${target key}`, `Accept` calling `act` with `proposeTrade` (same success/rejection text as TradeFinder).
  - Empty states: nothing ticked → "Tick what you're willing to trade."; no results → "No one matching that would take what you ticked. Loosen the filters or tick more."
  - Reset results (`setOffers(null)`) when filters, ticks or `league` change (stale-offer rule from TradeFinder).
- [ ] **Step 3: Wire the toggle** in `TradeFinder.tsx` (`useState<'shop' | 'find'>`, `seg` buttons with `aria-pressed`, same style as the existing `Want` picker).
- [ ] **Step 4: Verify** `npm run typecheck` and `npm test` — Expected: all pass. Run `npm run dev` and in a browser: open Trade finder → Find a player, confirm the position defaults to your thinnest spot, tick a few assets, find players, Accept one and see the roster change; confirm the phone-width layout doesn't scroll sideways.
- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat(ui): Find a player mode in the Trade finder"
```

---

### Task 3: Ship

- [ ] **Step 1:** `npm test && npm run typecheck && npm run build` — Expected: all green.
- [ ] **Step 2:** Push `claude/relaxed-carson-p8xtfu`, fast-forward/merge into `main`, `git push origin main` (standing permission in CLAUDE.md).
- [ ] **Step 3:** Confirm the "Deploy to GitHub Pages" workflow run finished green (`mcp__github__actions_list`); fix before calling it done.
- [ ] **Step 4:** Tell the owner the site is updated.
