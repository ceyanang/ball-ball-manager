# MyCareer mode — brainstorm notes (handoff)

Status: brainstorm in progress, **no design doc approved yet, nothing built**. Owner: ceyanang. Next step is to
finish brainstorming (see "Open questions"), write the design doc, get approval, then plan and build.
Rivalries (a prerequisite) already shipped: see `docs/superpowers/specs/2026-11-27-rivalries-design.md`.

## The pitch (owner's words, condensed)
A BitLife-style "MyCareer" mode on top of the existing league sim. You follow ONE player with lots of
day-to-day choices, no team management (no cap/trades/draft), you always have 99 POT (until age 30), and the game
ends when you "die", i.e. retire.

## Decided so far
- **Events ARE growth.** Many more pop-up events than today; the choices permanently shape the player. No separate
  training menu.
- **Build at the start, 2K style.** Spend a pile of points on a potential build (archetype/attributes). POT is 99
  until age 30, but stardom is not guaranteed: how close you get depends on choices, health and luck.
  (Owner: "you won't 100% become a star".)
- **Story arcs:** a rival team you stress over; big moments like an **emergency start** where your choices decide
  whether it is your breakout.
- **In-game prompts:** the game sims normally, then pauses on a moment involving you ("You're open! Shoot the 3 or
  pass to <teammate>?"). Resolution is chance-based using your ratings, teammates' and the defender's. **Do not show
  odds; show a colour-coded descriptor** (e.g. green "Wide open", yellow "Decent look", red "Contested").
  Proposed (not yet confirmed): ~3–6 moments per game weighted to clutch time; the sim must land on the rolled
  outcome so box scores stay honest. Needs a way to pause `simGame` mid-game (today it runs in one shot): check
  `src/engine/sim/game.ts` and `src/engine/season/advance.ts` before designing.
- **Off days are skippable.** One interaction per day if you want it: talk to teammates/coaches. **Relationship
  bars** (teammates, coach, rival, maybe family). Higher relationship gives hidden boosts (better pass success
  with that teammate, coach trust → minutes and clutch plays). Skipping days still builds relationships at about
  half the rate.
- **Salary is a "life" layer** (owner asked for help fleshing out; these are proposals he liked): spend money on
  trainer/skills coach (boosts event growth), chef/physio (injuries, recovery), agent (contracts, endorsements),
  house/cars/family (morale and fan buzz, but drains cash), investments (life after the league), charity (legacy,
  fan love). Tension: spend now to improve vs save for retirement.
- **Morale and fan love become main stats** for this mode. Reuse `fans.base` / `fans.players` and the weekly
  sentiment pass in `src/engine/stories/sentiment.ts`.
- **Retirement:** as the player declines or gets hurt the game asks "should you retire?" prompts. The player can
  accept, refuse, or **force-retire early** for different outcomes. The ending is a **template-generated epilogue**
  chosen by career numbers, e.g. "A Legend", "A Forgotten Legend", "A Well-Loved Bench Guy", "Broke Superstar",
  "Walked Away at the Top". Proposed: endings are an ordered list of conditions (first match wins) with several
  templated lines each, as plain data so more can be added later.
- Rivalries (done) feed this: rival games are louder, vets vs new guys tilt, so an early-career MyCareer player is
  hit harder in rival games.

## Existing code to build on
- Pure-TS engine in `src/engine/` (no React/DOM/`Math.random`; use `Rng`; story randomness uses `storyRng`).
- Random events: `src/engine/events/` (catalog of plain data in `catalog/*.ts`, `engine.ts`, `effects.ts`,
  `mods.ts` for temporary `GameMods`). Events only roll with `pauseForEvents` (the worker does). Temporary buffs
  are `GameMods`, never rating edits; MyCareer growth events will need **permanent** rating/POT changes, which is
  a new effect type.
- Stories (awards, records, HoF, highlights, social, inbox, fans/morale): `src/engine/stories/`.
- Save is `League` version 13 in IndexedDB; keep JSON-serializable, bump `version` and add a migration if the shape
  changes. A MyCareer save probably needs its own state (the followed player id, relationships, money, life log).
- Heritage/faces (`face/`), player generation (`player/`, `league/create.ts`) for the build-a-player screen.
- Project rules and the "always ship to the live site" workflow are in `CLAUDE.md`.

## Open questions (ask the owner, one at a time)
1. **Smallest first slice** that still feels like MyCareer ("build a guy, play a season, get an ending" vs
   more). The owner has not answered this yet; he asked to do rivalries first.
2. How big is a "day" and a season in MyCareer; does the player start as a draft prospect, a rookie, or an
   already-drafted player on a random team?
3. Is it a separate mode from "league/GM" at game start, or a toggle on the same league (the sim is shared)?
4. Do teammates and the rest of the league progress like normal (yes, probably) and can you be traded/cut/
   re-signed (without a GM screen: automatic)?
5. How the in-game pause works technically (see above). Likely needs a short brainstorm/spike.
6. Number of event categories and how events gate on relationships/money (data-driven, like the catalog).
7. Visual look of the build screen, the day card and the in-game prompt (offer the visual companion).

## Workflow chosen for this project
Brainstorming → short design doc → plan → **native** execution (the assistant builds it in-session, then one fresh
whole-branch review) → ship to `main` per `CLAUDE.md`.
