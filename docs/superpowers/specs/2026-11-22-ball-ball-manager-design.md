# Ball Ball Manager — Design

A small basketball franchise-mode game, inspired by NBA 2K's MyLeague but
much simpler. It runs in the browser, is free to run forever, and works
offline.

Items marked **(call)** are decisions the designer (Claude) made. The user
can veto them. Everything else was decided by the user.

---

## 1. Intent: why this exists

The user loves **watching numbers happen**. That means following each
player's stats, seeing who is performing, watching players develop or
decline over a career, and building up **awards, record books, and league
history** over many seasons. GM decisions such as trades, signings, and the
draft matter, but they serve that main goal. AI teams must behave
sensibly, because a league with dumb AI produces stats and history that
mean nothing.

The game must be usable whenever the user wants at **zero cost**. That
rules out any AI/LLM service and any paid backend. Everything is plain
algorithms with randomness.

## 2. Goals, non-goals, anti-goals

**Goals**
- Rich, believable statistics: box scores, season and career stats, league leaders, team stats.
- Player careers that visibly grow and decline over many seasons.
- Awards, records, and league history that build up and are fun to browse.
- Light GM layer: trades, draft with lottery, free agency, re-signing, a simple cap, coach hiring and firing.
- Procedurally generated cartoon faces for every player.
- Flavour: fake social media feed, highlights feed, assistant-GM inbox.
- Installable as an app (PWA), offline-capable.

**Non-goals**
- Finances beyond a salary cap: no ticket prices, revenue, facilities, or budgets.
- Training camps, practice sliders, scouting budgets, or front-office staff other than the coach.
- Cap exceptions, luxury tax, bird rights, and similar mechanics.
- Live game visuals or a full play-by-play viewer.
- Creating a brand-new franchise or expansion teams. For now the user picks one of the 30 existing teams.
- Multiplayer, accounts, or servers.
- Real NBA team names, logos, or player names.

**Anti-goals** (the project fails if these happen, even if everything technically works)
- AI teams accept lopsided trades, hoard 15 centers, or otherwise act dumb.
- Stats look unrealistic, for example 80-point averages, 30% team FG%, or every game 150–148.
- The game needs internet, an API key, or a paid service.
- Menus balloon into MyLeague-level complexity.

## 3. Constraints

- Runs entirely client-side in a modern browser. Desktop and phone layouts must both be usable.
- No AI/LLM calls anywhere in the shipped game. All generation is algorithmic and seeded.
- Free hosting: GitHub Pages.
- Saves live on the user's device.

## 4. Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| **A. React + TypeScript (Vite)** with the sim engine as a separate pure-TS module | Needs Node to build. Scales well to dozens of screens and is testable. | **Chosen by user** |
| B. Plain JavaScript, no framework | Fewer dependencies, but many screens and a lot of state turn into spaghetti. | Rejected |
| C. Single HTML file | Very portable, but unmaintainable and untestable at this size. | Rejected |

App path: ship as a **PWA** from day one, so it is installable with its own
icon and works offline **(call)**. Wrapping with Capacitor for the app stores
is possible later and is out of scope for now.

## 5. Technical shape (call)

- **Vite + React + TypeScript**. **Vitest** for tests.
- **Engine** (`src/engine/`): pure TypeScript with no React and no DOM. It contains the league model, sim, progression, AI GM logic, generators, awards, and records. All engine randomness uses a **seeded RNG** stored in the save, so results are reproducible and tests are deterministic.
- Season simulation runs in a **Web Worker** so the UI never freezes. Target: a full 40-game season plus playoffs sims in a few seconds.
- **Persistence**: IndexedDB through a thin wrapper library such as `idb` or Dexie. Multiple save slots. **Export/import a save as a JSON file** for backups.
- **Data retention**: full box scores are kept for the current and previous season. Older seasons keep only per-player season stat lines, game results, and anything referenced by records or highlights. This stops saves from growing forever **(call)**.
- Deployed to GitHub Pages through GitHub Actions.
- Faces are rendered as **SVG** React components.

## 6. League structure

- **30 teams in 2 conferences** (East/West, 15 each). Every team parodies a real NBA team, keeping the city and making a pun of the nickname (e.g. "Los Angeles Fakers", "Boston Kelptics"). Simple generated monogram logos and team colours loosely evoking the original. No real logos **(call: exact names left to builder, but all 30 must be clearly recognisable parodies)**.
- **40-game regular season**, 20 home and 20 away. Each team plays every other team once (29 games), plus 10 extra games against its own conference and 1 extra game against the other conference. That adds up to 40. A plain "11 extra conference games" doesn't work: 15 teams × 11 is odd, and every game needs two teams **(call)**.
- **Calendar (call):** the season runs about 80 numbered days. A team plays roughly every other day, so not every team plays every day. "Sim 1 week" = 7 days, which is about 3–4 games per team.
- **Playoffs (call):** the top 8 per conference by record, seeded 1–8. Rounds 1–3 are best-of-5. The Finals are best-of-7. Tiebreakers in order: head-to-head, then conference record, then point differential, then a coin flip.
- No divisions **(call)**.

## 7. Players

**Identity:** first and last name drawn from built-in name lists, age, height, position (PG/SG/SF/PF/C), jersey number, hometown/college (flavour), draft info ("Year 3, Round 1, Pick 4" or "Undrafted"), and a seeded face.

**Ratings (call):** each rating is 1–99.
- Offense: inside scoring, mid-range, three-point, free throw, passing, ball handling, offensive rebounding.
- Defense: perimeter defense, interior defense, steals, blocks, defensive rebounding.
- Physical/mental: athleticism, stamina, basketball IQ.
- **Overall (OVR)** is a position-weighted combination. **Potential (POT)** is a hidden ceiling. The UI shows only a fuzzy estimate for young players.
- League shape target: about 3–5 players above 85, most rotation players 60–78, and end-of-bench players 45–60.

**Progression (call):** runs once per offseason.
- Young players trend up toward their potential, peaking around 26–29.
- Decline usually starts around 31, and steepens after 34.
- Every change gets random variance, so breakouts and busts happen.
- The coach's development rating boosts growth for players aged 25 and under. Playing time gives a small boost.
- Per-season rating history is stored so a player page can chart OVR over a career.

**Retirement (call):** happens after the playoffs. The probability rises with age and falls with OVR. It is rare under 33 and certain by 42. Unsigned free agents who sit through a whole offseason can also retire.

**Morale (call):** 0–100.
- Inputs: minutes vs the minutes he expects (expectation scales with his OVR rank on the team), team winning, fan sentiment toward him, and whether he is underpaid relative to his asking value.
- Effects: willingness to re-sign, trade-request pings in the inbox and social feed, and a small (±2–3%) performance modifier.

**Fan sentiment (call):** a per-player and per-team score built from recent performance vs expectation and from team results. It drives the tone of social posts and feeds into morale.

## 8. Faces

- Layered SVG: head shape, skin tone, ears, eyes (shape and colour), eyebrows, nose, mouth, hair (style and colour, including bald), facial hair, and accessories (headband, goggles, earrings, arm sleeve visible at the collar, glasses, etc.). A jersey collar uses team colours.
- Built from simple shapes, with several variants per feature, enough to give thousands of distinct combinations.
- Fully determined by a seed stored on the player, so a face never changes between renders.
- **(call)** The face ages over a career: hair greys or recedes, and facial hair can change at intervals. The changes follow seeded rules, so they are deterministic.
- When a player is traded, the jersey colour updates to his new team.

## 9. Game simulation

- **Possession-based sim (call):** each possession picks a ball handler and shot type weighted by ratings, the coach's style, and fatigue. The result is a make, a miss leading to a rebound, a turnover, a foul or free throws, and so on. Minutes are allocated from the rotation, and stamina affects substitutions.
- Output per game: a **full box score** (MIN, PTS, OREB, DREB, REB, AST, STL, BLK, TO, PF, FGM/A, 3PM/A, FTM/A, +/-), **quarter-by-quarter scores**, a **player of the game**, and candidate **highlight moments**. Overtime is supported.
- No play-by-play is shown to the user. The engine may produce events internally for highlights.
- Realism targets that tests must check across many simulated games: team scores of roughly 95–125 (average ~110), team FG% of ~44–49%, 3PA rate and other team stats in NBA-like ranges, and a scoring leader at roughly 27–34 PPG.
- **Coach style** (fast pace / three-point heavy / defense first / balanced) shifts pace, shot mix, and defensive efficiency by small amounts.
- **Home-court** advantage is small.

**Sim controls:** sim 1 game (1 day), 1 week (7 days), to the trade deadline, to the end of the regular season, and through the playoffs. Simming stops early when something needs the user, such as the roster dropping below the minimum because of injuries, or a trade offer to the user **(call)**.

## 10. Rotation and roster rules

- Roster: **15 max, 10 min**. On game day **12 are active**, and the rest are inactive.
- The rotation screen lets the user set **5 starters, bench order, and inactives**. Minutes come from that order, so there are no minute sliders.
- AI teams set their rotations by OVR and position balance, and handle injuries automatically.
- The user cannot sim if their roster breaks the rules. The game shows what to fix. AI teams fix their own rosters by signing from the free agent pool.

## 11. Injuries

- **Injuries are rare (user decision):** a typical team sees only a couple of multi-game injuries a season. Day-to-day knocks are the most common, long injuries are uncommon, and season-ending ones are very rare (a handful league-wide per season).
- Each player-game has a small injury chance, slightly higher with heavy minutes and low athleticism, and with age.
- Severity is counted in **games missed (call)**: day-to-day (1–3 games), short (4–10), long (11–25), and season-ending (rest of the season, including playoffs). An injury is shown with a body part and the number of games out. Injuries carry over into the offseason, and any that aren't healed by then continue into the next season.
- Injured players cannot play. They still count toward the 15-man roster.
- Long injuries can cost a small amount of athleticism, especially for older players **(call)**.

## 12. Salary cap and contracts

- **Hard cap only (call):** a single number, e.g. $150M. A signing or trade that would put a team over the cap is blocked. The cap is fixed and there is no salary floor.
- **The cap is absolute.** Nothing ever goes over it: no min-contract or rookie exceptions (user decision).
- **Roster-fill reserve rule (call, user-approved direction):** a signing, re-signing or trade is legal only if, after it, the team's cap room is at least `(10 − roster size) × minimum salary`. That way a team can always reach 10 players, and no team can ever get stuck. When a move is blocked, the UI explains it, e.g. "This leaves $2M, but you need $3M to fill out 10 players."
- **The season can't start** if the user's team breaks a roster or cap rule. The user must fix it first, by trading, releasing, or signing, and a fix-it screen shows what's wrong.
- **Drafted rookies are not auto-signed (call).** After the draft, each pick can be signed at its rookie-scale salary only if the reserve rule allows it. Otherwise the team can trade or release him, and a released rookie goes to the free agent pool.
- **AI GMs manage money smartly:** they plan cap room ahead for re-signing their core and signing draft picks, avoid long deals for declining veterans, and keep cheap depth. They never need an exception because they obey the same reserve rule.
- Contracts have a salary per year and a length of 1–5 years. The minimum salary is about $1M and the maximum about $45M **(call: exact numbers tuned by builder so most teams sit near but under the cap)**.
- **Asking salary** depends on OVR, age, potential, last season's performance (stats vs expectation), and morale. Good seasons raise the ask and bad seasons lower it.
- **Rookie contracts (call):** fixed by draft slot on a sliding scale. First-round picks get 3 years and second-round picks get 2. They are not negotiable.

**Re-signing**
- In the offseason, players with expiring contracts state an ask (salary + years).
- The user offers salary and years. Acceptance is probabilistic, based on how the offer compares to the ask, plus morale and the team's recent winning.
- Players with very low morale may refuse to negotiate at all.
- Anyone not re-signed becomes a free agent.

## 13. Free agency

- **The pool always has players in it.** It holds expired contracts nobody re-signed, undrafted rookies, and a batch of newly generated random players added each offseason, including some leftover veterans.
- The offseason free agency period runs in "days". Each day the user can make offers, and AI teams make their own signings. Players choose among offers based on money, team quality, and expected role.
- **Free agents who wait get cheaper** as the days pass **(call)**. At the end of the offseason some unsigned players retire, which keeps the pool from bloating.
- During the season, any team can sign free agents at any time. These signings are single-day decisions with no bidding war **(call)**.
- To release a player, his remaining salary stays on the cap until the contract would have expired **(call: simplest honest rule, and it stops abuse)**.

## 14. Trades

- **Trade window:** closes at the **trade deadline**, which falls on the first day after every team has played its 20th game. It stays closed through the playoffs. It reopens right after the Finals and stays open for the **whole offseason, including draft day** **(call)**. The draft room has a Trade button, so current-draft picks can be traded while a team is on the clock.
- **Trade builder:** pick a partner team, add any players from both sides (multi-player packages), and propose. The AI answers **instantly**. An accepted trade executes immediately. A rejected trade gets a short reason ("They want more value", "This would put them over the cap", "Roster would exceed 15").
- **Draft picks are tradeable (call):** first- and second-round picks for the next 2 drafts.
- **AI trade logic must not be dumb:**
  - Player value is a function of OVR, age, potential, contract, and injury status. Young high-potential players and good-value contracts are worth more.
  - Teams evaluate trades from their own situation: contenders favour current OVR, rebuilding teams favour youth and picks.
  - A positional need adds a modest bonus.
  - AI accepts only if the value it receives is at least the value it gives times a margin above 1, so the user can't fleece them.
  - Repeatedly asking for the same lopsided deal never works.
- **AI makes its own moves:** AI teams trade with each other occasionally, and sometimes propose trades to the user. These go to the inbox, and the user accepts or declines.
- **"What would it take?" (call):** the user can ask an AI team to suggest what they would want for a player. The AI builds a counter-package. This keeps trade building easy.
- All trades are logged in league history.

## 15. Draft and lottery

- 2 rounds of 30 picks.
- **Lottery:** the 14 non-playoff teams are entered with weighted odds, worst record highest. The top 4 picks are drawn, and the rest of the lottery teams follow in reverse record order. Playoff teams pick 15–30 in reverse record order. A **lottery reveal screen** shows the picks revealed one at a time.
- **Draft class:** about 70 generated prospects, ages 19–22. Each shows a fuzzy OVR range and a fuzzy POT grade. Real ratings are hidden until they enter the league.
- **AI draft logic:** best available by expected value (a blend of OVR and potential), with a mild positional-need tiebreak.
- The user picks when they are on the clock. They can also auto-pick.
- Undrafted prospects go to the free agent pool.

## 16. Coaches

- Each team has one head coach with a name, a face (same generator), a **style** (fast pace / three-point heavy / defense first / balanced), a **development rating**, and a career win/loss record and history.
- There is a pool of unemployed coaches, refreshed each offseason.
- During the offseason the user can **fire and hire**. AI teams fire coaches after poor seasons, measured against expectations.
- Coach of the Year is one of the awards.

## 17. Assistant GM inbox

Algorithmic suggestions only. **The user always makes the final call.** Example pings:
- The coach is underperforming expectations, so consider firing him.
- A player's production is falling while his contract is large, so consider trading him.
- A player is unhappy about his minutes, or has requested a trade.
- The roster has a positional hole or too many players at one position.
- A notable free agent is still unsigned and cheap.
- AI trade offers received.
- Contract expiries coming up, with injury and return-from-injury notices.

Each ping can link to the relevant screen, and can be dismissed.

## 18. Highlights feed

After each sim, generate a feed of standout moments from the box scores
and game events. Examples:
- 40+ and 50+ point games
- Triple-doubles and near-misses
- Game-winners and buzzer-beaters
- Rookie debut big games
- Career highs
- New franchise and league records
- Win and losing streaks
- Comeback wins from a big deficit
- Overtime thrillers
- Injuries to stars

Highlights are stored per season, feed the social tab, and can link to the box score.

## 19. Social media tab

- A fake social feed generated from **templates filled with game data** (Mad-Libs style). There is no AI. Fan accounts get generated handles and avatars, plus some recurring "personalities" such as an insider reporter, a stats account, a hater, and a superfan.
- Post topics: game reactions, hot and cold streaks, trade reactions, signings, draft picks, injuries, awards, and player complaints.
- **Tone follows fan sentiment.** Struggling players get roasted 🔥, and players on a hot streak get praised.
- **Players post too:** they react to fan reception, celebrate wins, and complain about minutes when morale is low. Players' posts link to their pages.
- Like/repost counts are scaled by player popularity and the size of the event.

## 20. Awards, records, and history

- **Season awards (formula-based):** MVP, Rookie of the Year, Defensive Player of the Year, Sixth Man, Most Improved, Coach of the Year, Finals MVP, All-League 1st/2nd/3rd teams, All-Defensive 1st/2nd, All-Rookie, and the Champion.
- **Records:** single-game, single-season, and career records, for both the league and each franchise, across major stats (PTS, REB, AST, STL, BLK, 3PM, and so on). Records track the holder, the date or season, and the previous holder.
- **League history:** per season, the champion, Finals result, standings, award winners, stat leaders, the draft order and picks, all trades, and notable signings.
- **Hall of Fame (call):** when players retire, they are inducted automatically if their career score is high enough. The score blends stats, awards, and championships.
- **Player page:** bio, face, ratings (current and historical chart), season-by-season stats table, career totals, awards, transactions, and injury history.
- **Team page:** roster, coach, season record, team stats, franchise records, and the season-by-season history.
- **League pages:** standings, league leaders, the stat leader board, team stats comparison, and the playoff bracket.

## 21. Season cycle

1. **New league setup:** generate 30 teams, rosters, coaches, the free agent pool, and the schedule. The user picks a team.
2. **Regular season:** 40 games. Trades are allowed until the deadline after game day 20.
3. **Playoffs**
4. **Awards ceremony screen** and season summary
5. **Player progression and retirements.** Hall of Fame inductions happen here.
6. **Draft lottery**
7. **Draft**
8. **Re-signing phase**
9. **Free agency** (days). Trades are open.
10. **Coach changes.** These can happen any time during the offseason.
11. **New season:** generate the schedule, then back to step 2.

## 22. Main screens

- Home/dashboard: next game, record, standings snippet, inbox count, latest highlights.
- My Team: roster, rotation, coach.
- Schedule and results. The box score viewer is part of this.
- Standings and playoff bracket.
- League leaders and stats.
- Teams browser leading to team pages.
- Player pages.
- Trade builder.
- Free agents.
- Draft (lottery and draft room).
- Inbox.
- Highlights.
- Social.
- History, records, awards, and Hall of Fame.
- Save management (slots, export/import, new league).

## 23. Left to the builder

- Exact formulas and tuning constants for ratings, progression, sim, trade value, morale, and contracts. These must hit the realism targets above.
- The 30 parody team names and colours. Name lists, social post templates, and highlight templates.
- Visual design and layout. The `frontend-design` skill should guide this, and `dataviz` should guide charts.
- Folder structure and state management choice.
- Number of face shape variants, as long as the result looks varied.
