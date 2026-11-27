# Rivalries — design

Status: implemented (2026-11-27)

## Intent
Make the league feel personal. Every team has rivals; games against them are
louder and wilder, and rivalries grow or fade from what happens in the playoffs.
Works in the normal GM mode now and is the foundation for the planned
"MyCareer" mode (rival-stress storylines), which is a separate, later project.

## Goals
- Every team has 2 **starting rivals** (geography/lore) that never go away.
- Up to 2 **dynamic rivals** that form from playoff "heat" and can change.
- Rival games: players are more volatile (bursts and bricks), and fan buzz and
  morale swing harder.
- Long-tenured vets tend to burst in rival games; rookies/new arrivals tend to
  struggle, and those who play well can earn a slight POT bump.
- Rivalries visible in the UI (team page, schedule, game banner, news).

## Non-goals
- No stored playoff history (only a heat number per team pair).
- Regular-season games do not add heat (possible later).
- No MyCareer work here.

## Anti-goals
- Rival volatility must never become a rating edit or shift non-rival results.
- Dynamic rivals must not flip mid-season.

## Approaches considered
1. Heat only, derived on the fly. Simplest, but rivals could flip mid-playoffs.
2. **Heat + stored dynamic rivals, locked each offseason (chosen).** Stable all
   season, matches "randomly form, might change".
3. Heat from regular-season games too. Most organic, far more tuning; deferred.

## Design

### Data
- Starting rivals: plain data in `src/engine/data/rivals.ts`, each team lists 2
  abbrevs. Geography-based, e.g. LAF↔LAK, NYK↔BKN, BOS↔PHI, CHI↔DET, MIA↔ORL,
  plus the joke CLE↔GSW (Cavapoos ↔ Worriers). Rivalry is symmetric when
  possible; a team may end up with extra incoming rivals, which is fine
  (builder fills the remaining pairs sensibly).
- League gains `rivalry: { heat: Record<pairKey, number>, dynamic: Record<teamId, string[]> }`
  where `pairKey` is the two team ids sorted and joined. Save version 12 → 13
  with a migration that sets `heat: {}` and `dynamic: {}`.

### Heat
- Added when a series is decided, hooked from `onSeriesDecided` in
  `stories/hooks.ts` (round 4 = Finals, 3 = conference finals, otherwise
  earlier rounds). My starting numbers (tunable): Finals +40, conference
  finals +20, other series loss +6 (to the winner's pair).
- Cools every offseason: ×0.7, and ×0.5 for pairs that did not meet that year.
  Values below ~1 are dropped.

### Dynamic rivals
- At season rollover, each team picks up to 2 dynamic rivals by a weighted
  random draw (`storyRng`, so game results never shift) from the hottest pairs
  above a minimum heat (my call: 15). Quiet years can give none.
- Starting rivals are excluded from the dynamic draw; dynamic slots are stored.
- A team's rivals = starting rivals + stored dynamic rivals. A pair is a rival
  game if either team lists the other.

### Rival-game effects
- `GameMods` gets a `volatility` field (percentage of extra random swing on
  make-probability, my call ±; capped like the other mods). `buildMods` today
  only runs for the user's games; rival games between AI teams also get it, so
  the builder extends it to apply to any rival game.
- Fan buzz (`fans.players`) and team fans (`fans.teams`) swing ~1.5× on rival
  results in the weekly/after-game sentiment pass; player morale likewise.
- Rival games get a banner, news line, and the team's rivals listed on its page.

### Vets vs. new guys in rival games (owner idea, 2026-11-27)
- Volatility is **not equal for everyone**. Players with long tenure on their
  team lean toward *bursting* (wider swings skewed to the upside); rookies and
  recent arrivals lean toward *struggling* (swings skewed to the downside).
  Implemented as a per-player tilt on the same temporary `GameMods` volatility,
  so still no rating edits. Tenure comes from the same data the fan-base
  calculation in `stories/sentiment.ts` already uses. Cutoffs (my calls):
  vet ≈ 3+ seasons on the team, "new" = rookie or under 1 season.
- **Earning POT:** a rookie or new guy who performs well in rival games
  (tracked as a small per-season "rival showing" tally, reset each offseason)
  gets a slight chance at a potential bump in the offseason, rolled through
  the existing breakout path (`breakoutBump` → `onBreakout`, so it already
  produces news). A bad showing gives no penalty; the downside is just the
  struggle in the games themselves.
- The tally is a new small save field (rolled into the v13 migration).
- In MyCareer, POT is locked at 99 until 30, so the POT bump simply does not
  apply there; the vet/rookie tilt still does (it is how rival games hit *your*
  guy early in his career).

### Testing
Engine is pure, so unit-test: heat added per round, cooling, dynamic pick
(deterministic by seed, respects minimum heat and exclusion of starting
rivals), migration 12→13, and that non-rival games are bit-identical to before.

## Left to the builder
Exact heat/volatility/swing numbers (above are starting guesses), the full
starting-rival table, UI placement, and news wording.
