# Trade finder: "Find a player" mode — design

Approved in conversation 2026-11-23.

## Intent
The user's team is thin at a position (e.g. no shooting guard). They describe the player they need
(position, minimum OVR, optionally max age / max salary) and the game finds matching players around the
league plus a trade package for each that the other team would accept.

## Goals
- Describe a target → get ready-to-accept trade offers for matching players.
- The user controls what can be spent: only assets they tick as "available to trade" are ever offered.
- Feels like part of the existing Trade finder (same picker, same offer cards, Tweak / Accept).

## Non-goals / anti-goals
- No archetype or individual-rating filters in v1 (easy follow-up).
- No save-format change (League stays version 8), no new randomness.
- Never offer an asset the user did not tick; never return a deal the AI would reject.

## Approaches considered
- **A) New mode inside `TradeFinder` (chosen):** reuses `AssetList`, offer cards and `suggestPackage`; least new code.
- B) Separate screen: duplicates the picker and cards, splits the workflow.
- C) Auto-detect needs with no filters: skips the "describe a player" part of the request.

## Design
**Engine (`src/engine/gm/trade.ts`)**
- `suggestPackage(l, from, to, wanted, pool?)` — optional `pool` restricts the assets it may spend (default: all tradeable).
- `findTargets(l, me, criteria, available)` where `criteria = { pos, minOvr, maxAge?, maxSalary? }`:
  scans other teams' tradeable players matching criteria, best OVR first, caps at ~12 candidates, builds a package per
  target via `suggestPackage` with `pool = available`, keeps only deals passing `tradeProblem` + `aiVerdict`.
  Returns `{ teamId, target: Asset, gives: Asset[] }[]`. Returns `[]` when trades are closed.

**UI (`src/ui/screens/TradeFinder.tsx`)**
- Mode toggle: "Shop my guys" (existing) / "Find a player".
- Filter row: position (pre-filled with the user's reddest need from `needs.ts`), min OVR, optional max age, optional max salary.
- "Available to trade" list reuses `AssetList` with the existing tick state.
- Results: offer cards (target on top, what you send below, salary in/out, Tweak → `/trade?...`, Accept → `proposeTrade`).

**Tests (Vitest)**: only matching players returned; only ticked assets used; every deal is AI-acceptable and passes `tradeProblem`; empty when trades closed.

**Ship**: `npm test` + `npm run typecheck`, commit, push, merge to `main`, confirm Deploy workflow is green (per CLAUDE.md).

## Left to the builder
Exact candidate cap, sorting of results (best target OVR, then cheapest package), empty-state copy.
