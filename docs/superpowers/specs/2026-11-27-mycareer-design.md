# MyCareer — design

Status: implemented (slice A, 2026-11-27). Plan: `docs/superpowers/plans/2026-11-27-mycareer.md`. Supersedes the handoff notes in
`2026-11-27-mycareer-brainstorm-notes.md` (kept for history). Depends on rivalries (shipped):
`2026-11-27-rivalries-design.md`.

## Intent
A BitLife-style mode where you follow **one player** from draft night to retirement. No team
management. You shape him with a 2K-style build at the start and with the choices you make
afterwards. Playing the games yourself is the fun and the main source of growth. The mode ends with
a templated epilogue chosen by his career.

## Slice A (this design)
Build a player → draft night → play seasons with in-game "you're open" moments and a few growth
events → contract and trade/cut events → retirement prompts → epilogue. Everything else in the pitch
(money/life layer, relationship bars, spending currency on specific stats, a large event catalog) is
**later slices**; slice A must leave clean seams for them.

## Goals
- A character builder that feels like 2K MyCareer: you set each attribute's **max**. The player has his
  own **Career OVR** (progress toward his max build), which is exactly **99 when the build is fully
  maxed**, whatever archetype you chase.
- Start from archetype templates, then move points around.
- You start well below your max (about 65–70% of the way from 25 to each max at 19), so a 99 three-point
  max is a solid shooter, not Steph yet. Growth closes the gap, but stardom is not guaranteed.
- Draft night with 3 ominous, mildly random prompts that quietly decide your pick and your team.
- In-game decision moments with colour-coded descriptors and **no shown odds**.
- Playing games earns full rewards; simming earns half. Simming is always allowed.
- Contracts are player-driven; trades and cuts happen to you out of the blue.
- Retirement prompts (accept, refuse, force-retire) and a data-driven epilogue.
- The rest of the league plays on normally. You can browse other teams, history, rotations and
  your own team. Any control that alters a team is hidden or read-only.

## Non-goals (slice A)
Spending money on stats, relationship bars, family/house/investments, a big event catalog, GM menus,
draft-night scouting screens, multi-player careers, a separate league per career.

## Anti-goals
- Moments must never make box scores dishonest: the final box always equals what was simmed.
- Non-MyCareer games must stay **bit-identical** to today.
- No odds shown anywhere in the UI.
- Simming must never punish: less reward only.
- No hidden rating edits from temporary effects; growth is explicit and permanent (see below).

## Constraints from the code
- Engine is pure TS: no React/DOM/`Math.random`; use `Rng`; story randomness uses `storyRng`.
- `simGame` is synchronous and runs a whole game; `Rng` state is a single integer.
- Season is `GAMES_PER_SEASON = 40`; `stepDay` already has a "pause before/after the user's game"
  pattern used by pop-up events (`pauseForEvents`).
- Save is `League` version 13 in IndexedDB; the shape change needs a bump and migration.
- Events today give temporary `GameMods`; MyCareer growth needs a new **permanent** effect type.
- Ship workflow per `CLAUDE.md` (tests + typecheck, push, merge to `main`, check the deploy).

## Approaches

### How the in-game pause works
1. **Replay-pause (chosen).** Sim the game; when your moment triggers with no stored answer, stop and
   ask; re-run the same seed with the answers so far locked in. Prefix is identical; only the future
   branches.
2. Make `simGame` a pausable generator. Cleanest pause, but a risky refactor of a huge shared function.
3. Pre-ask all moments before the sim. Simplest, but moments lose their game context.

**Spike result (2026-11-27, throwaway, not kept):** a hash-triggered moment on one player's shot
selection (independent of the main `Rng`) over 30 real games gave: all-"shoot" games identical to the
plain sim (30/30); box points equal the final score with mixed answers (30/30); first pause point
identical across replays (30/30); at a 35% trigger about **6 moments and about 7 re-sims per game at
about 1 ms each**.

### Where MyCareer data lives
Chosen: one optional `League.career` field (version 14 + migration) on the normal league, with the
GM screens hidden/read-only. Alternatives (a separate save type, a separate engine) would duplicate
the league and were rejected.

## Design

### Mode and save
A new "MyCareer" option at new-game. It creates a normal league plus `career` state. A career has one
followed player id; everyone else is normal. `career` holds: player id, the **max build** (a ratings
object), build points record, growth log, event log, status (`building | draftNight | active |
retired`), draft-night answers/hidden tags, play-vs-sim counters, and the ending once retired.

### Builder
- Attributes are the existing ~30 on the 25–99 scale.
- A fixed points budget is spent across the maxes (templates and free allocation both use it all).
- **Career OVR** (owner's idea): the player's displayed OVR is not the league's OVR formula. It is his
  progress toward his own max build, scaled so a fully maxed build reads **99** and a new rookie
  reads about 68. Progress is a weighted average of (current − floor) / (max − floor), with weights
  leaning on the stats that define his archetype. The sim never reads it: games use his real
  attribute ratings. **Everywhere else the league treats his OVR as the Career OVR** (owner's call):
  draft position, AI contract offers, trade value, roster tables and tiers. His "true" league OVR is
  **never shown or used**, so players can freely experiment with builds. Implementation seam: wherever
  the game computes or reads a player's overall, the followed player returns his Career OVR.
- Templates come from the existing archetype data (`player/archetype.ts`); the screen shows the live
  archetype (`archetypeFor`), max OVR, and starting OVR at 19.
- Starting ratings = floor + a start fraction (≈ 0.65–0.70; tunable) of the way to each max.
- Heritage/face/name/hometown/height/position from the existing generators (`face/`, `names`).
- POT is **99 until 30**, then follows the existing age logic (MyCareer players are exempt from rivalry
  "POT bump").

### Draft night
- Three prompts, ominous and lightly random, each choice adding hidden tags (e.g. `secret-workout`,
  `loud`, `hometown-buzz`) that shift (a) your pick range and (b) per-team interest. Randomness uses
  `storyRng`. The draft then resolves normally for everyone else; you land in a slot on a team with
  the standard rookie contract. No scouting or GM screen.
- Prompts are plain data (text + choice effects) so more can be added.

### Season flow
- Rookie season starts after draft night. Your player is excluded from the normal `progressTick`; his
  growth runs through the career growth system.
- Each game day the user chooses **Play** or **Sim**. Play = in-game moments, full rewards. Sim = moments
  auto-resolve at the coach's default read and average luck (never worse than a casual player), half
  rewards (growth progress and later relationship gains).
- Contract decisions always pause, even when simming.

### In-game moments
- `GameMods` gains an optional career block (followed player, answers so far, trigger settings).
- Trigger: a deterministic hash of (game seed, possession, attempt) against a rate, so the main `Rng`
  is untouched. Rate boosted in clutch time, rival games, playoffs and "big nights"; tuned so a played
  game has roughly 3–6 moments (builder to tune from the spike's ~6 at 35%).
- Options for a moment: shoot, pass to a named teammate, drive. The sim resolves the chosen action with
  the normal shot/turnover math using your ratings, teammates' and the defender's. The UI shows only a
  colour-coded descriptor derived from the same math (green/yellow/red), never numbers.
- Driver: advance the day, catching the "moment" signal, ask the user, store the answer, re-run. Answers
  are kept on the game record only until the result is final.

### Growth
- Events are the growth. An event choice grants progress to **named attributes** (the choice decides
  which; slice A has a small catalog: gym nights, coach moments, injury scares, media, rivalry nights).
- Growth is permanent, capped by your max build, scaled by age curve, played-vs-simmed (half), health,
  and luck. It is a **new effect type** that edits ratings explicitly (logged), unlike temporary mods.
- Slice A has no currency to buy stat growth.

### Contracts, trades, cuts
- Contract expiry is a **choice event**: re-sign, test free agency (AI offers), or take a discount. The
  player decides where he plays. In slice A offers use a simple fit (team strength, role, pay).
- Trades and cuts are out-of-the-blue league events weighted by performance, contract, and roster
  situation; they surface as events/news, never as menus.

### Retirement and ending
- As he ages, declines, or gets injured, retirement prompts appear: accept, refuse, or force-retire
  early. Different choices lead to different endings.
- Endings are an ordered list of conditions (first match wins), each with several templated epilogue
  lines filled from career numbers (titles, awards, rank, fans, rivals). Plain data, easy to extend
  (e.g. "A Legend", "A Forgotten Legend", "A Well-Loved Bench Guy", "Walked Away at the Top"). Slice A
  ships a modest set; money-based endings ("Broke Superstar") arrive with the money slice.

### UI
Builder, draft-night prompts, day card (Play/Sim), the moment card and the ending screen are new.
Layout and polish are left to the builder; the rough mockups are a starting point only (not part of
this repo). GM controls are hidden/disabled in MyCareer; viewing screens stay.

### Testing
Unit tests for: Career OVR (a fully maxed build is exactly 99 for every template and random allocations; a fresh rookie is about 68; it is monotonic in growth), start-fraction ratings, draft-night
tag → pick mapping (deterministic by seed), moment determinism, **non-MyCareer games bit-identical**,
all-"shoot" equals plain sim, box-equals-score with answers, half-reward on sim, growth caps,
contract-event pause, ending selection, and the v13 → v14 migration.

### Seams the builder must handle (found on a self-read)
- **`league.userTeamId` follows the player.** Much of `stepDay`/events keys off it. In MyCareer it is set
  to the player's team at the draft and updated on trade/cut/re-sign. While he is unsigned there are no
  user games (days still advance; contract events pause as usual). My call: if no AI team offers, a
  minimum deal is always available so a career can't dead-end.
- **Career OVR is what the league sees, but never what the sim reads.** A lopsided build can read 99 and
  play differently from a balanced 99 on the court, because games run on attributes; that is the
  intended trade-off. The builder must find every place a player's overall is computed or cached (roster
  tables, tiers, valuation, draft logic, contracts) and route the followed player through the one
  Career OVR seam, so nothing leaks his true OVR. Teams' own strength and auto-rotations also read OVR
  today, so check that his coach and minutes behave sensibly with it.
- **Injuries** use the existing injury system; they feed growth (health) and retirement prompts. A
  played game's moments are skipped if he is out, with that game auto-simmed.

## Slicing and size
Large. Suggested milestones, each shippable: (1) builder + 99-OVR budget + new-game option;
(2) draft night; (3) moment pause + play/sim day; (4) growth events + contracts/trades/cuts;
(5) retirement + epilogue.

## Left to the builder
Exact numbers (point costs, start fraction, trigger rates, growth scaling, heat of draft prompts),
screen layouts and copy, template set, event and ending wording, how AI free-agent offers are
scored, and the migration details.

## Decided by the owner
Build = max per stat; the player has his own Career OVR that is 99 when the build is maxed (not the league's OVR rules); templates then adjust; start at draft night with 3 ominous
prompts; play games (full) vs sim (half); contracts player-driven, trades/cuts out of the blue; event
choices pick the growth stat; replay-pause approach; spend-for-stats is later; GM menus removed or
read-only; the UI is the builder's call.
