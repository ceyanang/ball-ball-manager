# Milestone 2 — GM Layer

**Spec:** `docs/superpowers/specs/2026-11-22-ball-ball-manager-design.md` §7, §10, §12–16, §21.
The owner asked Claude to "make the best judgments", so every **(call)** below is Claude's.

## Scope

Trades (with picks, AI valuation, "what would it take?", AI↔AI trades), hard cap + reserve rule, contracts and
asking salaries, releases → 1-day waivers → dead money, free agency (in-season instant signings and an
offseason bidding period), draft lottery + 2-round draft, draft rights and rookie scale, re-signing, offseason
progression, retirement, coach firing/hiring, trade deadline, and starting the next season.

**Deferred to M3** (needs the inbox/social/history systems): AI trade proposals to the user, trade-request pings,
fan sentiment, awards ceremony, Hall of Fame. Morale gets a simple end-of-season update now.

## Calls

- **Save v3.** New `League` fields: `picks`, `draft`, `draftRights`, `transactions`, `deadMoney`, `waivers`,
  `faOffers`, `offseason`, `tradeDeadlineDay`; `Player.retired`. Migration v2→v3 fills them in.
- **Cap season.** During the offseason, payroll is measured against *next* season: contracts ending this season
  don't count, re-signings and signings do. In season it is the current season.
- **Reserve rule** exactly as spec §12: after a move, `room ≥ (10 − roster) × MIN_SALARY` and roster ≤ 15.
- **Asking salary** = market salary from OVR, plus youth/potential premium, ±10% for last season's
  performance vs similar-OVR players, −10% to +10% from morale. Asking years by age (young 4, prime 3, 31+ 2, 34+ 1).
- **In-season free agents** take any offer ≥ 90% of their ask on the spot.
- **Offseason free agency** lasts 30 days. Each day AI teams make at most one offer each, every free agent with
  offers picks the best (salary, team quality, role), and accepts if it clears his current ask, which drops 3%
  a day. The user's offers resolve on the same daily tick.
- **Waivers.** A released player sits on waivers until the next sim day/offseason tick. AI teams (worst record
  first) claim him if he's worth his contract to them and they can fit him. Unclaimed → remaining salary becomes
  dead money through the original expiry; he becomes a free agent.
- **Trade value** blends OVR (steep curve), age, potential, contract surplus and injury. Contenders weight now,
  rebuilders weight youth and picks. AI accepts only when value in ≥ value out × 1.1 + 2, with a positional-need
  bonus and a stacked-position penalty. Fully deterministic, so asking again never flips the answer.
- **Trade deadline** is the day after every team has played 20 games.
- **AI↔AI trades:** a handful of attempts each week before the deadline and during free agency; both sides must
  gain by their own valuation.
- **Draft.** Lottery: 14 non-playoff teams, odds 14/14/14/12.5/10.5/9/7.5/6/4.5/3/2/1.5/1/0.5%, top 4 drawn.
  Picks for the next 2 drafts exist and are tradeable. 70 prospects (19–22) with fuzzy OVR ranges and potential
  grades. AI picks best 50/50 blend of OVR and POT with a mild positional tiebreak. Drafted players are held as
  draft rights; rookie scale R1 $10M→$1.5M for 3 years, R2 minimum for 2. AI signs picks it can fit; unsigned
  rights are released when the new season starts.
- **Progression** once per offseason: under-27s move toward potential (coach development helps ≤25),
  27–30 hold, decline from 31 and steeper from 34, all with variance. Ages +1.
- **Retirement** chance rises with age and falls with OVR: rare under 33, certain at 42. Unsigned free agents
  are likelier to retire. 20 new veteran free agents arrive each offseason.
- **Coaches.** AI fires a coach whose win% trails his roster's expectation by 15+ points; hires the best
  development coach available. The user can fire/hire during the offseason. 4 new coaches join the pool yearly.
- **Box-score retention:** when a new season starts, box scores older than last season are dropped; stat lines stay.
- **Offseason flow** (Offseason screen): Recap (progression, retirements, coach changes) → Lottery reveal →
  Draft → Re-sign → Free agency → Start next season. Each step is one "Continue" button; nothing is skipped.
- **UI:** new Front Office (cap sheet, coach, transactions), Trade, Free Agents (incl. waivers), Draft and
  Offseason screens. My Team gets a contracts table with Release. Mobile nav scrolls horizontally.
