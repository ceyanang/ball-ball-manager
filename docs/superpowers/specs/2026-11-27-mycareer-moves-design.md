# MyCareer: loud moves, real trades, portrait, "next time I play" (short design)

Approved in conversation 2026-11-27 (lands before slice B).

## Intent
Big career moments (trade, cut) should be impossible to miss, trades should look like real trades, Home should show the player's face, and the live replay should let him skip to the next time he is on the floor.

## Goals
- Pop-up modal for a sudden trade or cut (face, old team -> new team, what came back). Dismissed with "Got it".
- Every sudden trade returns assets to the old team: a round-1 pick for a high-OVR player, a round-2 pick otherwise; a roster-full team still sends its weakest player instead. If the new team has no pick left it sends a player.
- The inbox ping names what came back.
- Home `DayCard` shows his portrait in team colours with jersey number.
- Watch replay gets "Next time I play" beside the speed buttons: jumps to his next check-in; if he never plays again, jumps to the final.

## Non-goals
Negotiated/CPU-initiated trades, trade AI changes, calendar-level skipping, new save version.

## Approaches
1. **Chosen:** optional `career.alert` (JSON, no migration) set by the engine, shown by a store-driven modal, cleared via `act(..., { career: true })`. Replay helper is a pure function in `watch/replay.ts`.
2. Derive the modal from the inbox (no new state) - rejected: can't tell "new" from "old" reliably.
3. Hold the sim with a worker-level pause - rejected: `simDays` already stops on a move (`stopOnOffer`).

## Calls I made
- "High OVR" = in the league's top 90 players by OVR.
- Replay: if he is on the floor now, "next" means his next check-in after he sits.
