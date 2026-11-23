# Milestone 3 — Stories

**Spec:** `docs/superpowers/specs/2026-11-22-ball-ball-manager-design.md` §7 (morale, fan sentiment), §17–20, §21 step 4, §22.
Plus the items M2 deferred: AI trade proposals to the user, trade-request pings, fan sentiment, awards ceremony, Hall of Fame.
The owner asked Claude to "make the best judgments", so every call below is Claude's.

## Scope

Awards (incl. Finals MVP, All-League/Defense/Rookie), records (single-game, season, career; league + franchise),
league history per season, Hall of Fame, highlights feed, fake social feed, assistant-GM inbox with AI trade offers,
fan sentiment, in-season morale with trade requests and a small performance effect.

## Calls

- **Save v4.** New `League` fields: `news`, `social`, `inbox`, `awards`, `history`, `records`, `hof`, `fans`,
  `careerHighs`, `storySeq`. `GameResult` gets optional `clutch` and `comeback`. Migration v3→v4 fills them and
  backfills season/career records from stat lines (and single-game records from the box scores still kept).
- **Story randomness never touches the sim stream.** Social/inbox flavour uses an `Rng` seeded from
  (league seed, season, day, salt), so adding stories does not change any game result.
- **Engine layout:** `src/engine/stories/` — `sentiment.ts`, `highlights.ts`, `records.ts`, `awards.ts`,
  `social.ts`, `inbox.ts`, `hooks.ts` (the only file `advance.ts` / `offseason.ts` call).
- **Clutch tracking in the sim** (no extra RNG draws): the last lead change and each side's largest deficit.
  A go-ahead score for the winner in the final minute of the last period is a game-winner; on the final possession
  it is a buzzer-beater. A win from 15+ down is a comeback.
- **Highlights:** 40+/50+ points, triple-doubles (and near-misses with 20+ pts), game-winners/buzzer-beaters,
  rookie debuts with 20+, career highs (30+, after 10 career games), records, 5/8/10/12/15+ win or losing streaks,
  15+ point comebacks, overtime games, long injuries to stars, series clinches and the title. Each has a weight;
  the current season is kept in full, the previous one only weight ≥ 5.
- **Fan sentiment** (−100..100): players move toward how their game score compares with what their OVR and
  minutes suggest; teams move with wins/losses, more for upsets. Drives social tone and feeds morale.
- **Morale in season,** every 7 days: target from minutes vs. role (OVR rank), team win%, fan sentiment and being
  underpaid; moves 25% toward it. Effect in games: ±1.6% shot make rate at the extremes. Below 35 the user gets a
  "unhappy" ping; below 20 the player requests a trade (ping + social post).
- **Awards** (regular-season, formula based): MVP = game score per game × availability + team win% bonus;
  DPOY from stocks, defensive boards and D ratings; ROY among players drafted the previous summer (season 1: age ≤ 21);
  Sixth Man among players starting < 30%; Most Improved = biggest gain in game score per game (needs last season);
  Coach of the Year = win% above roster expectation; Finals MVP = best game-score total for the champion in the
  Finals. All-League 3 teams and All-Defense 2 teams use 2 guards / 2 forwards / 1 center; All-Rookie top 5.
- **History** per season: champion, runner-up and Finals result, final standings, stat leaders, awards. Draft and
  trades are read from player draft info and the transaction log.
- **Records** for PTS/REB/AST/STL/BLK/3PM: single-game (regular season, after each game), season per-game
  average (≥70% of games, at the end of the regular season) and career totals (at season end). Each keeps the
  previous holder. League records are announced from season 2; franchise records only for the user's team.
- **Hall of Fame:** on retirement, score = Σ seasons max(0, value − 20)/4 × gp/40 where value = per-game
  PTS + 1.2 REB + 1.5 AST + 2 (STL+BLK), plus award points (MVP 6, FMVP 3, title 1.5, All-League 3/2/1,
  DPOY 2, All-Defense 0.5, ROY 1). Inducted at 65+ (tuned so a few players a season clear it).
- **Social feed:** Mad-Libs templates. Four recurring personalities (insider, stats account, hater, superfan),
  generated fan accounts with faces, and player accounts. Topics: user-team game reactions, highlight reactions,
  trades/signings, injuries, hot/cold takes, morale complaints, awards, draft, champion. Tone follows sentiment;
  likes scale with player popularity and event size. Last 400 posts kept.
- **Inbox** (dismissable, links to screens): AI trade offers (weekly before the deadline at 50%, every 5 free-agency days at 40%),
  coach underperforming (mid-season and offseason), declining big contract, unhappy/trade request, positional
  hole or glut, cheap notable free agent, expiring contracts at the deadline, injuries and returns, awards and
  Hall of Fame. Offers expire after 7 days or when invalid; accepting re-checks legality and the AI's verdict.
  Multi-day sims stop when a new trade offer arrives.
- **Offseason** gains an `awards` step before `recap`: the awards ceremony reveal.
- **UI:** Inbox, Highlights, Social and History (seasons, awards, records, Hall of Fame) screens; Home shows the
  inbox count and latest highlights; player pages show awards, HoF badge and transactions; team pages show
  franchise records and season history.
