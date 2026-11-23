# In-game bench swaps — design

Date: 2026-11-23 · Status: awaiting owner approval

## Intent and why
Today the game sim silently re-picks the five on the floor every game-minute, but nothing is logged and positions are ignored. Watched games show "bench" as one lump of everyone who didn't start. The owner wants subs to be real, visible, and coach-like: a bench player *swaps in for a specific player*, and the bench card means "everyone currently sitting".

## Goals
- Sim makes real substitutions each game-minute, logged as events, driven by coach logic:
  - prefers the same or an adjacent position (PG↔SG↔SF↔PF↔C) as the player coming out;
  - rests a player who has been on the floor a long stretch for his stamina, or who is ahead of his minutes target (stand-in for "slowing down");
  - in a clear blowout, starters sit and the bench plays; starters come back if the game tightens;
  - in a close late game, the best five stay in.
- Watch mode shows five court cards (a swap animates the new player into that slot, with a feed line) and a bench card = totals (pts/reb/ast) of everyone currently sitting on that team, which changes with every sub.
- End-of-quarter screen: tapping a team's bench row expands the individual lines of **all non-starters** (gs = false), including a bench player who is on the floor right then. Starters always stay in the starters rows, even if sitting.

## Non-goals / anti-goals
- **No fatigue effect on performance** (owner shelved it). "Slowing down" is only a proxy for subbing; nobody plays worse for being tired.
- No user-controlled in-game subs, foul-trouble subs, or mid-game injuries.
- Must not make games unrealistic: final minutes should stay close to the existing `minutesTargets` plan, team scoring/league realism tests keep passing after re-tuning.

## Constraints
- Engine stays pure TS, no `Math.random`; sub decisions use **no RNG** (deterministic from game state, ties broken by roster order). Lineups change who is on the floor, so game results shift versus before; realism tests need re-calibration (expected, not a bug).
- Save format unchanged: the play log lives only in the in-memory `WatchSession`, `BoxLine`/`League` are untouched, so no version bump/migration.
- Old/legacy logs with no lineup events must still render with today's look (starters + one lump bench).
- Ship per CLAUDE.md (tests + typecheck green, merge to `main`, check deploy).

## Approaches considered
- **A. Real coach logic in the sim (chosen).** Replace `chooseFive` with a per-minute sub step that emits `sub` events. Most work; accurate and explainable.
- B. Diff the old lineups and label them as subs. Cheap, but pairings look random and the "coach logic" would be fake.
- C. UI-only fakery from box minutes. Can't be accurate.

Owner picked **A**.

## Design

### Engine (`src/engine/sim/`)
- `Ctx.onCourt` becomes **slot-ordered** (index 0..4 = PG, SG, SF, PF, C), always pinned to its slot. `courtPenalties(..., slotted = true)` is used throughout, so out-of-position cost follows the slot the player is actually filling (a C at PF costs 2.5, as today's table says).
- Q1 and Q3 start with the starters (as today), unless the Q3 start is a blowout (then bench-heavy lineup). Q2/Q4 continue from the previous period's end lineup; no reshuffle at period breaks.
- New sub step at the start of each game-minute (not before the first minute of a period that the starters open), per side, max 2 swaps a minute:
  - *Out score* for each on-court player: how far his current stint exceeds an allowance that scales with his `stam` rating, plus how far his minutes played is ahead of his plan (`target × elapsed share`).
  - *In score* for each sitting player: minutes owed vs plan, plus fit for the slot being vacated (`slotFit`, so adjacent positions win naturally).
  - Swap the best (out, in) pair when the combined score clears a threshold; never leave fewer than 5 on court; players already at the 48(+5·OT) minute cap are never kept in.
  - Blowout rule: margin ≥ ~20 in Q4 (≥ ~25 in Q3) lowers starters' allowance and raises bench "owed" so starters sit; if margin falls back under ~12 the best five return.
  - Clutch rule: last ~4 minutes of Q4/OT with margin ≤ 8 suspends resting; only forced position/cap swaps allowed.
  - Exact thresholds are the builder's to tune against the realism tests; the minutes plan (`minutesTargets`) remains the soft target (see tests).
- Play log (`playlog.ts`): two new event kinds:
  - `{ k: 'lineup', side, players: string[] }` — the five at the start of period 1 (slot order), one per side.
  - `{ k: 'sub', side, out: string, in: string, slot: number }` — at `t` = fraction of the period (existing `pending`/`possInPeriod` mechanism).
  - `boxFromLog` and `describePlays` must ignore both (they currently read `e.player`).

### UI (`src/ui/watch/`)
- `ReplayState` gains `court: Record<Side, string[]>` (slot-ordered). `advanceTo` applies `lineup`/`sub` events; `apply` treats them as no-ops for lines.
- Legacy fallback: log with no `lineup` event ⇒ court = starters (gs) and bench = non-gs, exactly today's behavior.
- `WatchGame` row: five cards keyed by **slot**, each showing the current occupant's live pts/reb/ast/hot status; bench card shows `benchLine(rs, sitting)` where `sitting` = side's box players not on court, label "N guys". A `sub` event triggers a short swap animation on that slot card and a feed line like `🔁 Garcia in for Lee`.
- Card lookup for shot/fx anchoring (`cardOf`) becomes dynamic: resolved from the court state at the time of each event (events in one fired batch must be resolved in order so a player who subs out mid-batch isn't mis-anchored).
- `QuarterBreak` / recap rows are role-based, not court-based: starters (gs) rows as today; the bench row per team is **tappable** and expands to one row per non-starter with name (tap opens the player sheet), PTS, REB, AST, FG, 3P. A non-starter currently on the floor still appears there.
- Starters who are sitting at the break still show in their starter row (not in the bench).

### Tests
- Engine: every `sub` swaps exactly one on-court player for one sitting; replaying lineup+sub events always yields 5 distinct players per side; ≥ ~70% of swaps are same/adjacent position; blowout games produce starter minutes below target; blowout reversal case; minutes stay near plan (e.g. every player within a few minutes of target, total exactly 240+); no RNG draws added by the sub step.
- Replay: court state after the full log equals the end-of-game lineup; legacy log fallback; `boxFromLog` unchanged.
- UI: bench card sums sitting players only; QuarterBreak bench expansion lists all gs=false players including one on the floor.
- Re-tune existing realism tests; `npm test` and `npm run typecheck` green before shipping.

## Left to the builder
Exact stint allowance, thresholds, and swap score weights; the swap animation styling; whether the bench-expansion is accordion or sheet (must stay one tap from the recap).
