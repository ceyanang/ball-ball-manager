# Game Day Watch Mode + Playoff Hub — Design

Date: 2026-11-23 · Status: draft for owner approval
Mockup (throwaway, made-up players): https://claude.ai/artifact/QXs16a95SQHYHSECp34dKm

## Why

Hitting "Sim day" gives you a final score and nothing else. The owner wants game days to feel like events:

- **Suspense:** "ooh, will I win? will they not win?" as the score moves.
- **Surprises:** "are there gonna be any unexpected performances *during* the game?" — a role player catching fire in Q3 should be something you *see happen*, not something you find in a box score.
- **Attachment:** watching your guys play every night should make you care about them and end up with a favorite.

During the playoffs the owner also wants the bracket in front of them while they sim, instead of digging into the Playoffs screen.

## Goals

1. **Watch mode** for the user's own games: a quarter-by-quarter "replay" of the real game result, shown as two rows of player portraits that shoot at a central hoop.
2. **Playoff hub**: during the playoffs, Home becomes a screen built around the bracket, today's games and the sim buttons.
3. Simming stays exactly as fast and available as today. Watching is always opt-in.

## Non-goals

- No coaching during the game (subs, rotation changes between quarters). The owner likes this idea ("make moves") but parked it for later. This design must not block it (see Approaches).
- No watching other teams' games. Only the user's game gets watch mode.
- No real court animation, positions, or plays. "There's no actual playing happening": players stay in their cards and shoot balls at the hoop.
- No sound.

## Anti-goals (would make this a failure even if it works)

- **Watching changes results.** The same save + same sim must produce the same games whether or not you watch. Watch mode only reads what the game sim already decided.
- **What you see doesn't match the box score.** Every ball, point, rebound and assist shown must come from the real game; the final numbers on screen equal the saved box score exactly.
- **Spoilers.** While you're watching, nothing in the app tells you the final.
- **Sim gets slower or harder to reach.** People who just want to sim must not be slowed down.

## Constraints (from the project)

- Engine is pure TS in `src/engine/`, no React/DOM/`Math.random`; randomness through `Rng`. Game results come from `simGame` in `src/engine/sim/game.ts`; realism tests calibrate it.
- Sims run in a Web Worker (`src/worker/`) via `SimCommand` → `SimResponse`. The UI calls `useStore().sim(cmd)`.
- Save format is `League` v4 in IndexedDB. Any shape change = bump `version` + add a migration in `src/save/migrate.ts`.
- Player portraits already exist: `src/ui/face/Face.tsx` (`<Face seed age colors size jersey />`).
- Mobile-first: the game is played as an installed phone app from GitHub Pages.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | **Real play-by-play replay.** `simGame` optionally writes down every play into a log while it runs (shot made/missed, assist, rebound, etc., with quarter and timing). The watch screen replays that log. | Some engine work + tests that prove results don't change. Every ball shown is real; numbers always land on the box score. A play log is also what a future quarter-at-a-time sim would produce, so "make moves" can build on it. |
| B | Fake it from the box score: sprinkle each player's final stats randomly across quarters. | No engine changes, but the per-quarter numbers, "on pace" and "who got hot in Q3" would be made up. Kills the "unexpected performances" goal. |
| C | Make the engine pause after each quarter and resume. | This is building "make moves" now. Biggest build, riskiest for realism tests, for a parked feature. |

The owner picked **A**.

## What the owner decided

### Getting into watch mode
- On a day when the user's team plays, the main sim button becomes **"▶ Watch game"**, with **"Sim day"** still right beside it (desktop button row, mobile header, and the Game Day card on Home). Other sim options are unchanged.
- Hitting Watch sims the day exactly like "Sim day" (all games, all stories) and then opens watch mode on the user's game. All other games that day just sim like today.

### The watch screen (see mockup)
- **Layout (portrait phone first):** opponent name + record on top, then the opponent's row, the middle strip, the user's row, the user's name + record at the bottom, and a one-line play feed.
- **Rows:** each row is 6 cards: the five starters (actual portrait, last name) plus one **"Bench"** card that collects everything the non-starters do. Each card shows live **PTS · REB · AST**.
- **Middle strip:** quarter number + game clock on one side, the score (them over us) on the other, a backboard/rim/net in the center.
- **Shots:** each field-goal attempt launches a ball from the shooter's card. Makes arc into the rim, drop through the net (net swish, "+2/+3" pops). Misses clank off and bounce away. **Free throws get a ball too** (owner asked): one short, flatter shot per attempt, a beat apart, "+1" on makes, feed line "🎯 X at the line: 1/2". Rebounds, assists, steals, blocks update numbers and the feed without a flying ball (builder may add a small effect).
- **Speed:** 1× / 2× / 4× toggle, changeable mid-quarter. **Skip to final** jumps straight to the final recap.
- **Quarter breaks:** after each quarter the replay pauses. The court blurs behind a recap: score, who leads, the standout performer, and a compact line (PTS/REB/AST/FG/3P) for all ten starters plus the two bench totals. A button starts the next quarter.
- **Player sheet:** at a break, tapping any player (either team) opens a sheet with the full game line so far (PTS, REB, AST, STL, BLK, TOV, FG, 3P, FG%, MIN, +/-), points by quarter, and "on pace for X tonight, ±Y vs his average". The link to his player page appears only on the final recap, because that page already includes tonight's game (my call, to keep the no-spoilers rule).
- **End of game:** final recap (win/loss), then back to Home showing the result normally.
- **Overtime:** each OT period plays like a short quarter ("OT", "2OT"), with a break before it.
- Also works in the playoffs (header shows the series, e.g. "Game 5 · Series tied 2–2").

### Playoff hub
- When `league.phase === 'playoffs'`, Home becomes the playoff hub (Playoffs screen stays as it is).
- **Bracket on screen:** the existing bracket, with the user's series highlighted. On phones, show one conference at a time with a West/East toggle (defaulting to the user's conference) and the columns scrolling sideways inside the panel; on desktop show both like the Playoffs screen.
- **Today's games:** every playoff game today, with game number and series state, and stakes tags: "elimination game", "sweep watch 🧹", "series-clincher".
- **Buttons:** Watch game (on the user's game, when they play today), Sim day, **Sim series** (new: sim until the user's current series is decided; hidden once the user is eliminated), Sim playoffs.
- The champion banner shows when the playoffs end (as today).

## My calls (owner can override)

- **Favorite player ⭐** (my idea, owner didn't object): in the player sheet and on the player page you can star players. Starred players get a ⭐ on their watch card and in roster lists. Needs a save field: `League.favoritePlayerIds: string[]`, `version` 5, migration fills `[]`. Starring is unlimited.
- **Hot-streak glow 🔥** (my idea): a card glows and the feed calls it out when a player's points are well above his season average for this point in the game. Rule: `pts ≥ seasonPPG × (elapsedFraction) + 8` and at least 10 pts; a one-time feed line "🔥 X already has N. He averages M." the moment he passes his season average. Rookies/no-games-yet use their OVR-expected average or skip.
- **No spoilers by design:** watch mode is a full-screen view with no navigation. The only ways out are finishing the game or **Skip to final** / **Exit** (both go to the final recap). So nothing else in the app can be seen while watching.
- **The result is final before you watch.** The day is simmed and saved when you hit Watch. If the app closes mid-game, the game already counted; watch mode does not resume (it just isn't shown). Acceptable trade-off for approach A.
- **The play log is not saved.** It lives in memory only for the game being watched, so saves don't grow. No other screen uses it in this version.
- **Quarter length:** about 15 seconds of real time at 1× for a 12-minute quarter (≈ 4 s at 4×). OT proportionally shorter.
- **Numbers from before the game:** records, series state and season averages on the watch screen come from the league as it was before the sim (the store still holds it). This matters when a Finals clincher moves the league into the offseason. Hot-streak and "on pace" use the averages for the current part of the season (regular season, or playoffs once he has playoff games).
- **Blocks and and-ones:** a blocked shot is a ball that gets swatted away, with "BLK" in the feed. An and-one is a make followed by its free throw.
- **Reduced motion:** with `prefers-reduced-motion`, no flying balls or pops; numbers and feed still update.
- **Stat ticks:** a stat bumps the moment its play is reached (rebound on the rebound event, assist with the make).

## Engine shape (decided)

- `simGame(home, away, players, coaches, rng, log?)`: optional `log: PlayEvent[]`. When given, `simGame` pushes one event per countable action. It must consume **exactly the same RNG calls** with or without a log, so results are identical.
- `PlayEvent` needs at least: `period` (1–4, 5+ = OT), `t` (0–1 position inside the period, from the possession counter), `side`, the kind (`fg` made/missed with 2/3, `ft` made/missed, `reb` off/def, `ast`, `stl`, `blk`, `tov`), the player id(s), and the running score after it. Enough to rebuild every box-score number shown in watch mode.
- Minutes and +/- per quarter aren't needed live: the sheet's MIN and +/- can be computed from a per-period snapshot of `played`/`pm` written at each period end (`{ type: 'periodEnd', period, min, pm }`), or shown only as of the last break.
- Worker: a new `SimCommand` `{ type: 'watchDay' }` (sim one day, record the user's game) returning `{ league, watch: { gameId, log } | null }`. If the user's team doesn't play that day it behaves like Sim day and `watch` is `null`.
- Playoffs: `simUntil` gets a new target `'seriesEnd'` (stop when the user's current series has a winner, or when the playoffs end).

## Tests that must exist

- Same league + seed: `simGame` with and without a log gives identical `GameResult`s (many seeds).
- Rebuilding a box score from the log equals the game's box score for every player (pts, reb, ast, stl, blk, tov, fgm/fga, tpm/tpa, ftm/fta) and the quarter scores.
- `watchDay` and `simDays(1)` produce the same league.
- `seriesEnd` stops when the user's series is decided.
- Save migration v4 → v5.

## Left to the builder

- Component structure, CSS, how the replay clock is driven (requestAnimationFrame or timers), animation details.
- Exact feed wording and recap "standout" pick (biggest gap over expected is a fine default).
- Exact desktop layout (the mockup is phone-sized; a centered max-width column is fine).
- Where exactly ⭐ shows in roster lists.
