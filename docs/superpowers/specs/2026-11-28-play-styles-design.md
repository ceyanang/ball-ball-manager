# Play styles — design

Status: approved by owner (2026-11-28).

## Intent and why
Archetypes (`player/archetype.ts`) are a label worked out from ratings every game, so a Shaq-like center and a
rim-protector center end up with nearly the same habits ("grab boards, defend"). The owner wants a second,
fixed trait — a **play style** — that fundamentally changes *how* a player plays and gets slightly better at the
stats that style cares about. It is rolled once at player generation and never changes.

## Goals
- Five styles: **Smart, Offense, All-Around, Power, Defensive**.
- Rolled once at generation from position odds tilted by the player's ratings; stored on the player; never changes.
- Each style changes **habits** (what he does) and gives an **in-sim boost** (how well he does it).
- Centers (and every position) visibly diversify: a Power C posts up / dunks and runs a slower, physical game; a Defensive C anchors and rebounds.
- UI shows a player's style, and highlights the rating names the style boosts.

## Non-goals
- No change to ratings, OVR, potential, contracts or trade value. Boosts exist only inside `simGame`.
- No lineup-synergy changes (`gm/synergy.ts`) in this slice (possible later).
- No in-season style changes, training toward a style, or style-based progression.

## Anti-goals
- Do not shift existing seeded results for new leagues beyond the style effect itself: the style roll must not draw from the league `Rng` stream.
- Do not make a style so strong it beats rating gaps (boost is small; a 70 OVR Power player must not out-play an 80 OVR non-Power).
- No Math.random / DOM in the engine (project rule).

## Constraints
- Engine is pure TS in `src/engine/`; randomness through `Rng` or seed hashing only.
- Save format is `League` v15; adding `Player.playStyle` needs `version` 16 + a migration in `src/save/migrate.ts` and `CURRENT_VERSION`/`create.ts` bump.
- Career OVR rule: everything except the sim reads the followed player's OVR via `ovrOf`; boosts must not leak into OVR displays.
- Events buffs are `GameMods` into `simGame`, never rating edits — play-style boosts follow the same rule (applied when building the per-player `prof` in `sim/game.ts`).

## Approaches considered
1. **Habits only** — style multiplies shot zones, usage, passing, rebounding, steal/block through the existing `ArchetypeTendencies`. Smallest, but nobody gets better at anything.
2. **Habits + in-sim boosts (chosen by owner)** — option 1 plus small boosts to the style's stats inside the sim; Smart's boost scales with the smartest player on court. OVR unaffected; boosted stat names highlighted in UI.
3. Habits + boosts + lineup synergy tie-in — richest, most balancing work; deferred.

## Design

### Data
`type PlayStyle = 'smart' | 'offense' | 'allAround' | 'power' | 'defensive'`; `Player.playStyle: PlayStyle` (required after migration).
Module `src/engine/player/playStyle.ts` holds: the type, labels, the position odds table, the rating-fit tilt, `rollPlayStyle(pos, ratings, seed)`, habit multipliers, boost table.

### Roll (generation + migration)
`weight[style] = POS_ODDS[pos][style] * fit(style, ratings)`, then a seeded weighted pick using a hash of the player's `rawSeed` (like names/heritage, never the league `Rng`). `fit` is ~0.5–2.0 from how well the ratings match the style (shooting/speed → Offense; playmaking + shotIQ/passIQ/passVision/helpDefenseIQ/passPerception → Smart; athleticism + finishing/post → Power; defense + rebounding → Defensive; All-Around = balanced profile, mildly rewarded when no pillar dominates). Fit is a tilt, not a decision: every style keeps a real chance at every position.

Position odds (% before the tilt; owner's chart, adjustable):

| | Smart | Offense | All-Around | Power | Defensive |
|---|---|---|---|---|---|
| PG | 35 | 30 | 18 | 5 | 12 |
| SG | 15 | 38 | 20 | 7 | 20 |
| SF | 18 | 18 | 28 | 18 | 18 |
| PF | 8 | 12 | 14 | 38 | 28 |
| C | 8 | 8 | 10 | 36 | 38 |

Used in: `generatePlayer` (all generation paths incl. draft prospects) and the v15→v16 migration (each existing player rolled once from his current ratings + id-derived seed). MyCareer: the followed player picks his style at creation (rolled default shown first); his style is then fixed like everyone's.

### Habits (sim)
The style multiplies the archetype tendencies already used by `sim/game.ts` `makeSide` (zone multipliers, usage, handler/passer, foul draw, turnover, steal/block) and adds rebound weights and pace skill:
- **Smart**: more passing/handler weight, fewer turnovers, more assists, tricky plays (extra assist share), steals/passes read well.
- **Offense**: deep-shot and fast-slash bias (three, drive/layup up; post/stand-dunk down), higher pace skill, higher usage.
- **All-Around**: mild multipliers across the board, leaning on the archetype's own tendencies.
- **Power**: close/post/dunk/layup bias, more foul drawing, offensive-rebound weight, *lower* pace contribution (slower, physical), fewer threes.
- **Defensive**: normal offensive tendencies, higher steal/block, defensive and offensive rebound weight.
Exact numbers are for the plan; start in the same range as the existing role multipliers (±10–35%).

### Boosts (sim only)
Per-style rating bumps added to the player's effective ratings **when building `prof` in `makeSide`** (so the sim sees boosted values; the stored ratings and OVR are untouched):
- Offense: threePointShot, midRangeShot, closeShot, speed, speedWithBall.
- Power: strength, vertical, standingDunk, drivingDunk, layup, postControl/postHook/postFade.
- Defensive: perimeterDefense, interiorDefense, steal, block, defensiveRebound, offensiveRebound, helpDefenseIQ.
- Smart: passVision, passIQ, passAccuracy, ballHandle, shotIQ, helpDefenseIQ, passPerception; the bump scales with the smartest Smart player in his team's top-8 rotation, fixed per game (a Smart player also lifts teammates' passIQ/shotIQ by +1). Fixed per game, not per lineup change, so the sim builds boosted ratings once.
- All-Around: a smaller bump across every group.
Starting sizes ≈ +4–6 on a style's core stats (+2–3 All-Around), capped so no rating exceeds 99. Final values tuned with a sim test (see below).

### UI
- **Portrait badge (owner's call):** wherever a player portrait shows an OVR, a small style emoji sits in the opposite corner: 🧠 Smart, ⚔️ Offense, 🏀 All-Around, 💪 Power, 🛡 Defensive. Hover/tap title gives the style name. Portraits without an OVR overlay get no badge unless the builder finds a natural spot.
- Player page and roster: show the style (label/badge next to the archetype).
- Player page rating list: highlight the names of the stats that style boosts (small marker + tooltip "Power boost: plays +N in games"); the displayed numbers and OVR stay the real ones.
- Find-a-player / roster filters: optional style filter (builder's call).

## Testing
- Roll: position distributions over many seeded rolls match the chart (± tolerance); fit tilt makes a Shaq-profile C ≥ ~60% Power; never changes after generation; deterministic for a seed; league `Rng` stream unchanged by the roll.
- Sim: league-wide style mix sanity; Power C attempts more close/post shots and fewer threes than a Defensive C with the same ratings; Defensive C records more blocks/steals/boards; Offense runs faster pace; boosts never push a rating above 99; OVR functions unaffected (existing scan test for `ovrOf` stays green).
- Balance: a 70-OVR boosted player must not beat an 80-OVR unboosted player on average (sim comparison).
- Migration: v15 save loads, every player gets a valid `playStyle`, stable across reloads.

## Left to the builder
Exact multiplier/boost numbers and the `fit` formula (tune against the tests above); where the style badge sits; filter UI; how the MyCareer creation screen presents the choice.

## Open calls (mine, flag if wrong)
- Existing players get a one-time ratings-based roll (not a clean 50/50), so old saves look like new ones.
- Smart's "smartest on court" effect is own-bump scaling plus a small teammate lift, not a full lineup synergy.
