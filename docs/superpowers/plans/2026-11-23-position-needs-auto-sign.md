# Position Needs + Auto Sign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Executed inline by the author (owner said "run it").

**Goal:** Red/yellow/green position-need dots with before→after preview on FA/trade/draft/re-sign screens, plus a preview-and-confirm Auto Sign / Re-sign button.

**Architecture:** Pure engine modules `needs.ts` (levels from roster slots + league OVR percentiles) and `autosign.ts` (plans moves without mutating, applies via existing `offerResign`/`offerFreeAgent`). UI: `NeedDot`, `NeedsStrip`, `AutoSignPanel` components.

**Tech Stack:** React + TS + Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-position-needs-auto-sign-design.md`

## Global Constraints
- Engine has no React/DOM/Math.random. No `League` shape change (no version bump). `npm test` and `npm run typecheck` green before shipping.

## Review Focus
- Empty position (no player) -> red. Roster of 0..9 -> auto reaches 10 even if only min-contract guys fit. Cap can't fit anyone -> plan is empty, no crash. Expiring player already out of re-sign tries/morale<25 -> skipped. Position with only adjacent cover -> never green.

### Task 1: needs.ts (TDD)
**Files:** Create `src/engine/gm/needs.ts`, `tests/engine/needs.test.ts`
**Produces:**
- `type NeedLevel = 'green'|'yellow'|'red'`; `interface Slot { id?: string; pos: Position; ovr: number }`
- `needThresholds(l: League): { excellent: number; good: number; solid: number }` (80th/55th/45th percentile of rostered OVR)
- `needLevels(slots: Slot[], th): Record<Position, NeedLevel>` (adjacent cover = ovr-6, never counts as same-pos backup)
- `teamNeeds(l, teamId, ch?: { add?: Slot[]; removeIds?: string[] }, th?): Record<Position, NeedLevel>`
- [ ] Tests: excellent+solid backup=green; excellent alone=yellow; excellent+adjacent only=yellow; good+weak backup=yellow; weak starter=red; empty position=red; good alone no adjacent=red.
- [ ] Implement, run `npx vitest run tests/engine/needs.test.ts`, commit.

### Task 2: autosign.ts (TDD)
**Files:** Create `src/engine/gm/autosign.ts`, `tests/engine/autosign.test.ts`
**Produces:** `interface AutoMove { kind:'resign'|'sign'; playerId:string; salary:number; years:number; reason:string; before:NeedLevel; after:NeedLevel }`; `planAuto(l: League): AutoMove[]` (pure); `applyAutoMoves(l, rng, moves): string[]` (failure messages).
- [ ] Tests: planAuto doesn't mutate league; short roster reaches >=10 and stays under cap; all red positions improve when a FA can fix; apply signs players.
- [ ] Implement, test, commit.

### Task 3: UI
**Files:** Create `src/ui/components/NeedDot.tsx`, `AutoSignPanel.tsx`; modify `FreeAgents.tsx`, `Offseason.tsx`, `Trade.tsx`, `Draft.tsx`, `theme.css`.
- [ ] Wire dots (+arrow) into each screen, strip at top, panel with checkboxes + Confirm via `act`.
- [ ] `npm test && npm run typecheck && npm run build`, commit.

### Task 4: Ship
- [ ] Push branch, merge to `main`, push, verify Deploy workflow green.
