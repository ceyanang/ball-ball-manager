# Position needs indicator + Auto Sign / Auto Re-sign (short design)

Approved by owner 2026-11-23.

## Intent
Owner wants (a) a red/yellow/green position-need indicator wherever they make a roster decision (FA, trades, draft, re-signs) and (b) an Auto Sign / Auto Re-sign button so the game's own algorithm builds the roster (age, past performance, prospects, team needs, contract value, reach 10 players).

## Approach
One sensible way: reuse existing AI logic in `src/engine/gm/roster.ts` (`needFactor`, `fillRoster`, `aiResign`, `currentAsk`, `resignChance`) behind a new pure-TS module, wired into the UI through `useStore().act`. Alternatives (instant one-tap, season-long toggle, multiple modes) were offered; owner chose **one smart mode with a preview/confirm screen**.

## Goals
- `src/engine/gm/needs.ts`: per-position need rating (PG/SG/SF/PF/C) for a team: green / yellow / red.
  - Green: excellent starter + really solid backup.
  - Yellow: excellent starter with no backup (or only adjacent-position cover), or good starter with weak backup.
  - Red: non-excellent starter with no backup, or position that genuinely needs attention.
  - Adjacent positions give partial cover. Thresholds derive from the league's OVR distribution (my call), age/trend considered.
- Before -> after preview: dot for a hypothetical move (sign, trade in/out, draft pick), shown as e.g. RED -> YELLOW.
- Indicators on FA list, trade screen, draft board, re-sign list, plus a needs strip (5 dots) atop those screens.
- Auto Sign / Re-sign: re-sign expiring players worth keeping (young, rising, good value), let old/declining/overpaid walk; then sign FAs red positions first, then best value under the cap; minimum 10 players (floor, not goal); min-contract fill if cap is tight. Preview screen lists each move with reason tag and before/after dots; owner can uncheck rows, then Confirm. Moves execute via `useStore().act`.

## Non-goals
Multiple auto modes, season-long auto toggle, cap slider, save-format change.

## Constraints
Engine stays pure TS (no React/DOM/Math.random; use `Rng` only for tie-breaks). No `League` shape change, so no version bump. `npm test` + `npm run typecheck` green; then ship per CLAUDE.md (merge to `main`, verify Pages deploy).

## Left to the builder
Exact thresholds, scoring weights, UI layout/styling of dots and preview, test fixtures.
