# Ball Ball Manager — Milestone 1: Core League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable browser game where you generate a 30-team parody league with procedurally drawn faces, pick a team, set its rotation, and sim a full 40-game season plus playoffs. You can browse box scores, standings, league leaders, team pages, and player pages. Saves persist, the app installs as a PWA, and it deploys to GitHub Pages.

**Architecture:** `src/engine/` is pure TypeScript with no React or DOM. It holds the league model, generators, the game sim, the season state machine, and stats. All randomness comes from one seeded RNG whose state lives in the save. The sim runs in a Web Worker. The React UI (`src/ui/`) reads one `League` object from a zustand store, which sends sim commands to the worker and autosaves to IndexedDB.

**Tech Stack:** Vite (react-ts template), React, TypeScript (strict), Vitest, react-router (HashRouter), zustand, idb, vite-plugin-pwa, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-22-ball-ball-manager-design.md`

**Roadmap:** This is milestone 1 of 3. Milestone 2 is the GM layer: trades, cap, contracts, waivers, FA, draft and lottery, coaches hiring, progression, retirement, and the offseason. Milestone 3 is stories: awards, records, history, HoF, highlights, social, and inbox. Each gets its own plan. Do **not** build milestone 2/3 features here. Data that later milestones need (contracts, coach style/dev, draft info, morale) is generated and stored now so saves stay forward-compatible.

## Global Constraints

- No AI/LLM or network calls in shipped code. The game must work fully offline after first load.
- `src/engine/**` must not import React, DOM APIs, `Math.random`, or `Date.now`. All randomness goes through `Rng` (Task 1).
- `League` must be plain JSON-serializable data: no Maps, Sets, classes, or functions.
- Money is stored as integer **thousands of dollars**. Constants: `SALARY_CAP = 150_000`, `MIN_SALARY = 1_000`, `MAX_SALARY = 45_000`.
- 30 teams in 2 conferences of 15 (East/West). There are no divisions.
- The regular season is 40 games per team, 20 home and 20 away.
- Roster is at most 15 and at least 10. 12 players are active per game. Rotation = 5 starters + ordered bench + inactives.
- Playoffs take the top 8 per conference. Rounds 1–3 are best-of-5 and the Finals are best-of-7. Tiebreakers in order: head-to-head, conference record, point differential, then seeded coin flip.
- Ratings are integers 1–99.
- Use only real-world city names. No real NBA team names, logos, or player names.
- Use HashRouter. The app is served from `/ball-ball-manager/`, so set Vite `base` to that.

## Review Focus

1. **A team has fewer than 5 healthy players.** The game must still sim. Fill the lineup with the injured players who have the fewest games remaining, and never crash. Test in Task 6.
2. **Tied games and multiple overtimes.** Each team's box minutes must sum to exactly `240 + 25 × OT`, and the scores must never stay tied. Test in Task 7.
3. **Three or more teams tied in standings.** The ordering must be deterministic and follow the tiebreak chain. Test in Task 9.
4. **Importing a corrupt or wrong-version save file.** Show a clear error and leave existing saves untouched. Test in Task 11.
5. **Pressing sim again while a sim is running, or navigating during a sim.** It must never double-sim or lose results. Sim controls are disabled while the worker is busy, and the store rejects overlapping commands. Test in Task 11.

---

## File Structure

```
src/engine/
  rng.ts                 seeded RNG (serializable state)
  types.ts               all League data types
  constants.ts           cap/roster/season constants
  data/teams.ts          30 parody teams
  data/names.ts          first/last names, hometowns, colleges, injury types
  player/ratings.ts      computeOvr, position weights
  player/generate.ts     generatePlayer
  contracts.ts           salaryForPlayer (basic; extended in M2)
  face/face.ts           FaceSpec + generateFace + ageFace
  coach/generate.ts      generateCoach
  league/create.ts       createLeague
  schedule/schedule.ts   generateSchedule
  sim/rotation.ts        gameLineup, minutesTargets
  sim/game.ts            simGame
  sim/injury.ts          rollInjuries, tickInjuries
  stats/stats.ts         addBoxToStatLines, playerSeasonStats, leaders
  standings.ts           computeStandings
  season/playoffs.ts     seedPlayoffs, advancePlayoffs
  season/advance.ts      simDays, simUntil
src/save/db.ts           IndexedDB slots, export/import
src/worker/simWorker.ts  worker entry
src/worker/client.ts     promise wrapper
src/ui/store.ts          zustand store
src/ui/face/Face.tsx     SVG renderer
src/ui/...               screens (Tasks 12–14)
tests/engine/*.test.ts   engine tests (mirror engine paths)
```

---

### Task 1: Scaffold + seeded RNG

**Files:**
- Create: the Vite react-ts scaffold (`package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`), `src/engine/rng.ts`, `tests/engine/rng.test.ts`, `.gitignore`

**Interfaces:**
- Produces:
  ```ts
  export interface RngState { s: number }            // uint32
  export class Rng {
    constructor(state: RngState)                     // mutates state.s in place
    static fromSeed(seed: number): Rng
    get state(): RngState
    next(): number                                   // [0,1)
    int(min: number, max: number): number            // inclusive
    float(min: number, max: number): number
    normal(mean: number, sd: number): number         // Box–Muller
    chance(p: number): boolean
    pick<T>(arr: readonly T[]): T
    weighted<T>(items: readonly T[], weight: (t: T) => number): T
    shuffle<T>(arr: T[]): T[]                        // in place, returns arr
    id(prefix: string): string                       // prefix + 8 base36 chars
  }
  ```
  The `Rng` *class* is never stored in `League`. Only `RngState` is stored. Engine functions take `rng: Rng` as a parameter.

- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template react-ts`. Add `vitest`, then `zustand react-router-dom idb` and `-D vite-plugin-pwa`. Add the scripts `"test": "vitest run"` and `"typecheck": "tsc -b --noEmit"`. Set `base: '/ball-ball-manager/'` in `vite.config.ts`. Enable `strict` in tsconfig.
- [ ] **Step 2: Write failing tests** in `tests/engine/rng.test.ts`:
  - `same seed → same sequence`: two `Rng.fromSeed(42)` produce identical 100 `next()` values.
  - `state round-trips`: take `const st = {...rng.state}` after 10 calls. `new Rng({...st})` continues identically to `rng`.
  - `int is inclusive and in range`: over 10k draws, `int(1,6)` hits both 1 and 6 and never goes outside.
  - `weighted respects weights`: weights [1, 9] give the second item 85–95% of the time over 10k draws.
  - `normal mean/sd`: 20k draws of `normal(50,10)` have a mean within 50±0.5 and an sd within 10±0.5.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (module missing).
- [ ] **Step 4:** Implement `Rng` with mulberry32 over `state.s`.
- [ ] **Step 5:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit `feat: scaffold app and seeded rng`.

---

### Task 2: Types, constants, data, players

**Files:**
- Create: `src/engine/types.ts`, `src/engine/constants.ts`, `src/engine/data/teams.ts`, `src/engine/data/names.ts`, `src/engine/player/ratings.ts`, `src/engine/player/generate.ts`, `src/engine/contracts.ts`
- Test: `tests/engine/player.test.ts`, `tests/engine/data.test.ts`

**Interfaces:**
- Produces in `types.ts` (exact names, which later tasks and milestones rely on):
  ```ts
  export type Position = 'PG'|'SG'|'SF'|'PF'|'C'
  export type Conference = 'East'|'West'
  export type CoachStyle = 'pace'|'three'|'defense'|'balanced'
  export type Phase = 'regular'|'playoffs'|'offseason'
  export interface Ratings { ins:number; mid:number; three:number; ft:number; pass:number; handle:number; oreb:number;
    perD:number; intD:number; stl:number; blk:number; dreb:number; ath:number; stam:number; iq:number }
  export interface Contract { salary:number; expires:number }          // expires = last season covered
  export interface Injury { type:string; gamesRemaining:number; severity:'dtd'|'short'|'long'|'season' }
  export interface DraftInfo { season:number; round:number; pick:number; teamId:string }
  export interface Player { id:string; firstName:string; lastName:string; age:number; heightIn:number; pos:Position;
    jersey:number; hometown:string; college:string; ratings:Ratings; pot:number; faceSeed:number;
    teamId:string|null; contract:Contract|null; injury:Injury|null; morale:number; draft:DraftInfo|null;
    ratingHistory:{season:number; ovr:number}[] }
  export interface Rotation { starters:string[]; bench:string[]; inactive:string[] }   // all player ids on roster appear exactly once
  export interface Team { id:string; city:string; name:string; abbrev:string; conf:Conference;
    colors:{primary:string; secondary:string}; coachId:string; rotation:Rotation }
  export interface Coach { id:string; firstName:string; lastName:string; faceSeed:number; age:number;
    style:CoachStyle; dev:number; teamId:string|null; wins:number; losses:number }
  export interface BoxLine { playerId:string; teamId:string; gs:boolean; min:number; pts:number; oreb:number; dreb:number;
    ast:number; stl:number; blk:number; tov:number; pf:number; fgm:number; fga:number; tpm:number; tpa:number;
    ftm:number; fta:number; pm:number }
  export interface GameResult { homeScore:number; awayScore:number; quarters:{home:number[]; away:number[]};
    ot:number; box:BoxLine[]; potg:string }
  export interface Game { id:string; season:number; day:number; homeId:string; awayId:string;
    playoff:{round:number; seriesId:string; gameNum:number}|null; result:GameResult|null }
  export interface StatLine extends Omit<BoxLine,'pm'|'gs'> { season:number; playoffs:boolean; gp:number; gs:number; pm:number }
  export interface Series { id:string; round:number; conf:Conference|null; highSeedId:string; lowSeedId:string;
    highSeed:number; lowSeed:number; highWins:number; lowWins:number; bestOf:5|7; winnerId:string|null }
  export interface PlayoffBracket { season:number; series:Series[]; championId:string|null }
  export interface League { version:1; name:string; seed:number; rng:{s:number}; season:number; phase:Phase; day:number;
    userTeamId:string; teams:Record<string,Team>; players:Record<string,Player>; coaches:Record<string,Coach>;
    games:Game[]; statLines:Record<string,StatLine>; playoffs:PlayoffBracket|null }
  ```
  `statLines` key: `${season}|${playoffs?'p':'r'}|${playerId}|${teamId}`.
- Produces:
  - `computeOvr(r: Ratings, pos: Position): number`
  - `generatePlayer(rng: Rng, opts: { season:number; age?:number; targetOvr?:number; pos?:Position }): Player` (teamId null, contract null)
  - `salaryForPlayer(p: Player): number`
  - `PARODY_TEAMS: {city:string; name:string; abbrev:string; conf:Conference; primary:string; secondary:string}[]`
  - `FIRST_NAMES, LAST_NAMES, HOMETOWNS, COLLEGES: string[]`, `INJURY_TYPES: {type:string; severity:Injury['severity']}[]`

**Team list (copy exactly; colours are the builder's choice, loosely evoking the originals):**
East: Atlanta Squawks, Boston Kelptics, Brooklyn Debts, Charlotte Hornots, Chicago Bullies, Cleveland Cavapoos, Detroit Pistachios, Indiana Placers, Miami Sweat, Milwaukee Ducks, New York Knickknacks, Orlando Tragic, Philadelphia 67ers, Toronto Rappers, Washington Lizards.
West: Dallas Maybericks, Denver Nuggies, Golden State Worriers, Houston Pockets, Los Angeles Flippers, Los Angeles Fakers, Memphis Drizzlies, Minnesota Timberwoofs, New Orleans Pelicants, Oklahoma City Blunder, Phoenix Buns, Portland Trail Grazers, Sacramento Things, San Antonio Slurps, Utah Jazzercise.

**OVR:** a weighted mean of ratings with position-specific weights (guards weight pass/handle/three/perD; bigs weight ins/oreb/dreb/intD/blk; `ath` and `iq` matter for everyone). Then apply a linear stretch so that the OVR equals the generation target within ±2.

**Generation:** if `targetOvr` is omitted, draw it from `normal(62, 9)` clamped to 40–92. Draw each rating from `normal(base, 8)`, where the base comes from position archetype offsets around the target. Clamp ratings to 1–99. Height comes from position (PG ~74in … C ~84in, sd 2). Age 19–36 unless given. `pot = max(ovr, ovr + rng.normal(max(0, 27-age)*1.6, 4))` clamped to 99. `faceSeed = rng.int(1, 2**31-1)`. `morale = 60`. Set `ratingHistory` to `[{season, ovr}]`.

**Salary:** increases monotonically with OVR, mapping OVR ≤ 50 → `MIN_SALARY` and OVR ≥ 88 → `MAX_SALARY` with a convex curve. Age > 32 reduces it by 10% per year past 32. Round to the nearest 100.

- [ ] **Step 1: Write failing tests:**
  - `data.test`: 30 teams; 15 per conf; abbrevs unique; names unique; no team name equals a real NBA nickname from a list of the 30 real ones in the test.
  - `generatePlayer is deterministic for a seed` (deep-equal from two fresh `Rng.fromSeed(7)`).
  - `all ratings are ints in 1..99`, `pot >= ovr`, over 500 players.
  - `targetOvr is honoured`: `computeOvr` is within ±2 of `targetOvr` for targets 45, 65, 85.
  - `default distribution`: of 2000 players, the share with OVR ≥ 85 is between 0.3% and 3%, and the median is 60–64.
  - `centers outrebound guards`: the mean `dreb` for C exceeds that for PG by ≥ 15.
  - `salaryForPlayer`: OVR 45 → 1000, OVR 90 → 45000, monotone non-decreasing across OVR 40..99 at age 27.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement the files listed above. Name lists: ≥ 300 first and ≥ 300 last names drawn from diverse origins. ≥ 60 hometowns, ≥ 60 fictional or generic colleges, and ≥ 15 injury types spread across the severities.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: league types, parody teams, player generation`.

---

### Task 3: Faces

**Files:**
- Create: `src/engine/face/face.ts`, `src/ui/face/Face.tsx`, `src/ui/face/parts.tsx`, `src/ui/FaceGallery.tsx` (dev-only route `#/dev/faces`)
- Test: `tests/engine/face.test.ts`

**Interfaces:**
- Consumes: `Rng`
- Produces:
  ```ts
  export interface FaceSpec { head:number; skin:number; ears:number; eyes:number; eyeColor:number; brows:number;
    nose:number; mouth:number; hair:number; hairColor:number; facialHair:number; accessory:number; grey:number /*0..1*/ ;
    recede:number /*0..1*/ }
  export const FACE_VARIANTS: { [K in keyof Omit<FaceSpec,'grey'|'recede'>]: number }   // counts per part
  export function generateFace(seed: number): FaceSpec            // uses its own Rng.fromSeed(seed); never touches league rng
  export function ageFace(spec: FaceSpec, seed: number, age: number): FaceSpec   // deterministic
  // UI:
  export function Face(props: { seed:number; age:number; colors:{primary:string; secondary:string}; size?:number }): JSX.Element
  ```

**Variant minimums:** head 5, skin 10 (a realistic range from very light to very dark), ears 3, eyes 8, eyeColor 5, brows 6, nose 8, mouth 8, hair 16 (index 0 = bald), hairColor 7, facialHair 10 (0 = none), accessory 10 (0 = none: headband, goggles, earring, glasses, sweatband, etc.). Accessories appear on about 30% of players and facial hair on about 50%.

**Aging:** `grey` stays 0 until age 30, then rises linearly toward a per-seed max (0.3–1.0) at 38. `recede` stays 0 until a per-seed onset (28–36, or never for about 50% of players), then rises. When `recede` > 0.8 and hair is not bald, hair renders as a receding variant. Render the jersey collar in the team colours.

- [ ] **Step 1: Write failing tests:** `generateFace deterministic`; `every field within FACE_VARIANTS bounds` over 5k seeds; `≥ 2000 distinct specs in 5k seeds`; `ageFace grey is 0 at age 25 and non-decreasing from 25→40`; `generateFace does not consume league rng` (calling it leaves a separate `Rng` untouched, which is trivially true if implemented right; assert the behaviour anyway).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `face.ts`. Then implement the SVG parts and `Face` as layered `<svg viewBox="0 0 100 120">` groups in this order: background, collar, neck, ears, head, mouth, nose, eyes, brows, facial hair, hair, accessory. Use simple shapes (paths, ellipses, rects) only. Use the frontend-design skill for the style. Aim for a cohesive, playful flat-cartoon look.
- [ ] **Step 4:** Run tests. Expected: PASS. Then run `npm run dev`, open `#/dev/faces` (a grid of 60 random faces at ages 22/30/38 in random team colours), and look at it: faces must look varied and correctly layered, with no part detached. Take a screenshot with Playwright and check it.
- [ ] **Step 5:** Commit `feat: procedural svg faces`.

---

### Task 4: Coaches + league creation

**Files:**
- Create: `src/engine/coach/generate.ts`, `src/engine/league/create.ts`, `src/engine/constants.ts` (extend)
- Test: `tests/engine/league.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2, plus `generateSchedule` (Task 5). Create a stub returning `[]` now and wire in the real one in Task 5. Also uses `autoRotation` (Task 6). For now use a temporary inline "sort by OVR" rotation in `create.ts`. Task 6 replaces it.
- Produces:
  - `generateCoach(rng: Rng): Coach` with `style` uniform over the 4 styles, `dev` from `normal(60,12)` clamped 30–95, and age 38–68.
  - `createLeague(opts: { seed:number; userTeamIndex:number; name:string; season?:number /*default 1*/ }): League`

**Algorithm:** generate 30 × 14 = 420 players with default targets, plus 6 extra stars with `targetOvr` from `normal(86,3)`. Distribute them by **snake draft by OVR** across teams, with positional balance enforced: each team must end with ≥ 2 guards (PG/SG), ≥ 2 forwards, and ≥ 2 bigs (PF/C) counting PF as either. Keep 14 players per team. Generate 25 free agents (`teamId: null`) with targets from `normal(52,6)`. Contracts: `salary = salaryForPlayer`, `expires = season + rng.int(0,4)`. After distribution, if a team's payroll exceeds `SALARY_CAP`, trim salaries proportionally on that team so it fits (M2 enforces the cap properly). Jerseys are unique per team. Use one coach per team plus 8 unemployed coaches. `phase: 'regular'`, `day: 1`. Store `rng: {...rng.state}` at the end.

- [ ] **Step 1: Write failing tests:** `deterministic for seed`; `30 teams × 14 players, 25 FA`; `every team payroll ≤ SALARY_CAP`; `team OVR spread`: the mean of the top-8 OVR per team has a max−min of ≤ 12; `positional balance` rule holds; `rotation includes each rostered player exactly once with 5 starters and ≤ 12 active`; `JSON round-trip deep-equals` (`JSON.parse(JSON.stringify(l))`); `userTeamId matches userTeamIndex`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: coach generation and league creation`.

---

### Task 5: Schedule

**Files:**
- Create: `src/engine/schedule/schedule.ts`
- Modify: `src/engine/league/create.ts` (call it)
- Test: `tests/engine/schedule.test.ts`

**Interfaces:**
- Produces: `generateSchedule(teams: Team[], season: number, rng: Rng): Game[]` sorted by day, `playoff: null`, `result: null`.

**Algorithm:** the spec's "29 + 11 conference" can't be built (15×11 is odd), so the spec defines a different split:
1. One game for every pair of teams: 435 games.
2. For each conference, shuffle its 15 teams into a cycle and add a game for each team pair at cycle distance 1–5 (a 10-regular circulant graph). That adds 75 games per conference.
3. Pair the conferences with a random perfect matching (15 games).

Each team now has 40 games. **Home/away:** every vertex has even degree (40), so orient the edges along an Euler circuit of the multigraph. That gives exactly 20 home and 20 away. **Days:** greedily pack the games into days. Each day, take unscheduled games in order of the most-remaining-games-first teams, and add a game if neither team plays that day or played on both of the previous two days. Target ≤ 85 days.

- [ ] **Step 1: Write failing tests:** total 600 games; each team 40 games, 20 home, 20 away; every pair meets ≥ 1×; each team has 24 or more conference games (14 + 10) and 16 cross-conference (15 + 1); no team plays twice on a day; no team plays 3 days in a row; max day ≤ 85; deterministic for seed.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and wire into `createLeague`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: 40-game schedule generator`.

---

### Task 6: Rotation and minutes

**Files:**
- Create: `src/engine/sim/rotation.ts`
- Modify: `src/engine/league/create.ts` (use `autoRotation`)
- Test: `tests/engine/rotation.test.ts`

**Interfaces:**
- Produces:
  - `autoRotation(players: Player[]): Rotation`: the top 5 by OVR become starters, but with positional balance (at least 1 guard and 1 big among the starters when available). The next 7 by OVR form the bench in order. The rest are inactive.
  - `validateRotation(rot: Rotation, rosterIds: string[]): string[]`: returns human-readable problems (empty = OK). Problems: not exactly 5 starters, more than 12 active, duplicates, an id missing from the roster, a roster player missing.
  - `gameLineup(team: Team, players: Record<string,Player>): { starters: string[]; bench: string[] }`: the game-day 12. Injured starters are replaced by the first healthy bench player, and the rest shift up. Healthy inactives fill in when active healthy players number fewer than 12. **If there are fewer than 5 healthy players in total, fill the starters with the injured players who have the fewest `gamesRemaining`** (Review Focus 1).
  - `minutesTargets(lineup: {starters:string[]; bench:string[]}, players: Record<string,Player>, otPeriods: number): Record<string, number>` sums to `240 + 25*otPeriods`. Starters get ~30–36 and bench slots 1–4 get ~24, 20, 16, 12. Later slots get small minutes or 0. Scale each by stamina (±10%) and renormalise to the exact total. No player exceeds 48 + 5·OT.

- [ ] **Step 1: Write failing tests:** `autoRotation valid for every created team`; `validateRotation catches each listed problem` (one case each); `injured starter replaced by first healthy bench`; `only 3 healthy players → lineup still has 5 starters, including the 2 least-injured`; `minutesTargets sum exactly 240 / 265 with 1 OT`; `starters avg > bench avg`; `no one > 48`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement and wire `autoRotation` into `createLeague`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: rotations and minutes allocation`.

---

### Task 7: Game simulation

**Files:**
- Create: `src/engine/sim/game.ts`
- Test: `tests/engine/game.test.ts`

**Interfaces:**
- Consumes: `gameLineup`, `minutesTargets`, `Rng`, types
- Produces: `simGame(home: Team, away: Team, players: Record<string,Player>, coaches: Record<string,Coach>, rng: Rng): GameResult`. This function is pure and does not mutate its inputs.

**Algorithm (possession-based; constants are tuned by the realism test):**
- **Pace:** each team gets `pace = 99 + style adjustment` (`pace` +4, `defense` −2). The game uses possessions per team = the average of the two paces ± `normal(0,3)`.
- **Stints:** the game is split into 3-minute stints (16 for regulation, plus 5/3 per OT, with the last OT stint rounded). For each stint, each team fields the 5 players with the most remaining target minutes, preferring players already on the floor to limit churn. The stint's minutes are credited to those 5. Possessions in the stint are proportional to its length.
- **Possession steps:**
  1. **Turnover:** p ≈ 0.13 for the ball handler, adjusted by handler `handle`/`iq` vs the defence's mean `stl`. 55% of turnovers are steals credited to a defender weighted by `stl`.
  2. **Shooter:** pick among the 5 on court, weighted by a usage score from `ins`, `mid`, `three`, `handle`, and OVR, with an exponent of about 2.5 so stars dominate usage.
  3. **Shot type:** weighted rim/mid/three from the shooter's `ins`/`mid`/`three`. A `three` coach style adds +25% three weight.
  4. **Make probability:** base rim 0.60 / mid 0.41 / three 0.355. Add `(shooter rating − 60) × k`. Subtract `(defender-mean of perD or intD − 60) × k2`. A `defense` style lowers the opponent's makes by 1.5 points. Home team gets +0.8 points. Rim and mid shots can be blocked, weighted by the defenders' `blk`.
  5. **Shooting foul:** ~9% of shots, giving 2 or 3 FTs. 20% of made shots that draw a foul become and-ones. FT% = `0.50 + ft × 0.0045`. The foul is credited to a defender.
  6. **Miss:** rebound. Offensive rebound chance ≈ 0.24, adjusted by team `oreb` vs `dreb`. The rebounder is weighted by `oreb`/`dreb`. An offensive rebound restarts at step 2 in the same possession.
  7. **Made field goal:** an assist with p ≈ 0.62 (rim 0.5, three 0.8), credited to a teammate weighted by `pass`.
- Track `pm` per player from points scored while they're on court. Record quarter scores. If the game is tied after regulation, play another OT until it isn't.
- `potg` = the highest game score in the box (`pts + 0.4fgm − 0.7fga − 0.4(fta−ftm) + 0.7oreb + 0.3dreb + stl + 0.7ast + 0.7blk − 0.4pf − tov`).
- Every player in the game-day 12 gets a `BoxLine` (min may be 0). `gs` is true for starters.

- [ ] **Step 1: Write failing tests** (use a created league and sim 600 random pairings with `Rng.fromSeed(1)`):
  - `box integrity`: for each game and team, Σpts = team score, Σmin = 240 + 25·ot (allowing ±0 after rounding to 1 decimal, and store min with 1 decimal), fgm ≤ fga, tpm ≤ tpa ≤ fga, ftm ≤ fta, and team Σpm = score diff × 5.
  - `no ties`: homeScore ≠ awayScore always.
  - `forced OT`: across 600 games, at least 1% go to OT. Separately, build a test where both teams are copies of the same roster and loop up to 2000 sims until a multi-OT game occurs, then assert the minutes sum.
  - `realism`: mean team score 105–115; 95% of team scores within 85–140; league FG% 0.44–0.49; 3PA/FGA 0.33–0.45; 3P% 0.34–0.38; FT% 0.74–0.80; FTA/FGA 0.20–0.30; AST/FGM 0.55–0.68; TOV per team 11–16; OREB share 0.20–0.28.
  - `talent matters`: a team of OVR-80 clones beats a team of OVR-55 clones ≥ 90% of 200 games.
  - `home court small`: on equal teams, home win rate is 0.52–0.60.
  - `deterministic`: same rng seed gives deep-equal results.
  - `pure`: inputs deep-equal their pre-call snapshot.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Tune the constants until the realism tests pass.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: possession-based game sim`.

---

### Task 8: Injuries

**Files:**
- Create: `src/engine/sim/injury.ts`
- Test: `tests/engine/injury.test.ts`

**Interfaces:**
- Produces:
  - `rollInjuries(result: GameResult, players: Record<string,Player>, rng: Rng): { playerId:string; injury:Injury }[]`. This rolls only for players with min > 0. The per-player chance scales with minutes/36, older age (+3%/yr over 30), and low `ath`.
  - `tickInjuries(teamIds: string[], players: Record<string,Player>): void`. Call it once per game a team plays. It decrements `gamesRemaining` for that team's injured players and clears an injury at 0. Mutating the passed league copy is fine.
- Severity on injury: dtd 70% (1–3 games), short 22% (4–10), long 7% (11–25), season 1% (`gamesRemaining = 999`, cleared at season end in M2).

**Target rates** (the user wants injuries rare), measured over a full simmed season of 600 games: injuries of any kind 80–200 league-wide; long + season-ending ≤ 25; season-ending between 0 and 8.

- [ ] **Step 1: Write failing tests:** `rates within targets` (loop over a created league's schedule calling `gameLineup`→`simGame`→`rollInjuries`→`tickInjuries`; `simUntil` does not exist yet); `severity ranges respected`; `0-minute players never injured`; `tickInjuries clears at 0`; `injured players don't appear in box` (use `gameLineup`).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: rare injuries`.

---

### Task 9: Stats, standings, leaders

**Files:**
- Create: `src/engine/stats/stats.ts`, `src/engine/standings.ts`
- Test: `tests/engine/stats.test.ts`, `tests/engine/standings.test.ts`

**Interfaces:**
- Produces:
  - `addBoxToStatLines(statLines: Record<string,StatLine>, game: Game): void`. Only box lines with min > 0 count as gp. `gs` increments when starting.
  - `playerSeasonStats(league: League, playerId: string, season: number, playoffs: boolean): StatLine | null`. Merges across teams if the player was traded (teamId = latest).
  - `perGame(s: StatLine): Record<'min'|'pts'|'reb'|'ast'|'stl'|'blk'|'tov'|'fgPct'|'tpPct'|'ftPct', number>`. Percentages are 0 when there are no attempts.
  - `leaders(league: League, season: number, stat: 'pts'|'reb'|'ast'|'stl'|'blk'|'tpm'|'fgPct'|'tpPct'|'ftPct', n: number): {playerId:string; value:number}[]`. Per-game values. Qualification: gp ≥ 70% of the max team games played so far. Percentages also need minimum attempts (FG 5/g, 3P 1.5/g, FT 1.5/g).
  - `computeStandings(league: League, season: number): Record<Conference, StandingRow[]>` where `StandingRow = {teamId; w; l; pct; gb; confW; confL; home:[number,number]; away:[number,number]; pf; pa; streak:string; last10:string}`. Sorted by pct, with ties broken in order: head-to-head win% among *all* tied teams, conference win%, point differential, then a coin flip seeded by `league.seed + season`. Do **not** use `league.rng` here, so the result stays a pure function.

- [ ] **Step 1: Write failing tests:** `statLines totals equal sum of boxes` (sim 50 games); `traded-player merge` (fabricate two lines for one player on two teams); `perGame zero attempts → 0`; `leaders qualification excludes 2-game player`; standings `basic order`; `2-team h2h tiebreak`; **`3-team tie uses group h2h then conf record, deterministic across calls`** (Review Focus 3, hand-built game results); `gb computed vs leader`; `streak "W3"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: stat aggregation, leaders, standings`.

---

### Task 10: Season advance + playoffs

**Files:**
- Create: `src/engine/season/advance.ts`, `src/engine/season/playoffs.ts`
- Test: `tests/engine/season.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces:
  - `simDays(league: League, days: number): League`. Returns a **new** league (deep-cloned with `structuredClone`; the input stays untouched). For each day: sim every unplayed game on `league.day`, then for each played game apply `addBoxToStatLines`, `rollInjuries` (set `player.injury`), `tickInjuries` for both teams, and update coach W/L. Then `day++`. Stop early at a phase transition. Restore and persist `league.rng` from the `Rng` used.
  - `simUntil(league: League, target: 'regularEnd' | 'playoffsEnd'): League`
  - `seedPlayoffs(league: League): PlayoffBracket`: top 8 per conference via `computeStandings`. Round 1 is 1v8, 4v5, 3v6, 2v7. The bracket is fixed (no reseeding). Round 3 is the conference finals. Round 4 is the Finals (`conf: null`, home court goes to the better regular-season record, decided by the standings tiebreaker chain across both conferences).
  - `advancePlayoffs(league: League): void`: called daily during the playoffs. It schedules the next game of each active series (2-2-1 for best-of-5, 2-2-1-1-1 for best-of-7, higher seed home first), records wins, and creates the next round's series once both feeder series finish. When the Finals end it sets `championId` and `phase = 'offseason'`.
- Phase transitions: once the last regular-season day is played, set `phase='playoffs'`, `playoffs = seedPlayoffs(...)`, and `day` continues. Playoff box scores go to statLines with `playoffs: true`.
- **Out of scope here (M2):** the trade deadline, starting the next season, and auto-signing when rosters are short. In `offseason`, `simDays` is a no-op.

- [ ] **Step 1: Write failing tests:**
  - `simDays does not mutate input` (snapshot equality).
  - `simUntil regularEnd → all 600 games have results, phase playoffs, bracket has 8 round-1 series with correct seeds`.
  - `simUntil playoffsEnd → championId set, phase offseason`, every series has `winnerId` and the winner's wins = 3 or 4, and no series has more than bestOf games.
  - `deterministic`: two runs from the same created league give deep-equal results.
  - `full season perf`: `createLeague` + `simUntil('playoffsEnd')` finishes in < 8 s in Vitest (set the test timeout to 20 s).
  - `season scoring leader 25–36 PPG`, `league leader in ast 7–12`, `reb leader 10–15`.
  - `coach W/L sums equal team records`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: season loop and playoffs`.

---

### Task 11: Persistence, worker, store

**Files:**
- Create: `src/save/db.ts`, `src/worker/simWorker.ts`, `src/worker/client.ts`, `src/ui/store.ts`
- Test: `tests/save/db.test.ts` (use `fake-indexeddb` as a dev dep), `tests/ui/store.test.ts`

**Interfaces:**
- Produces:
  - `db.ts`: `listSaves(): Promise<{id:string; name:string; teamName:string; season:number; updatedAt:number}[]>`, `loadSave(id): Promise<League>`, `writeSave(id: string, league: League): Promise<void>`, `deleteSave(id): Promise<void>`, `exportSave(league: League): Blob` (JSON), `parseImport(text: string): League`. `parseImport` throws `SaveImportError` with a user-facing message when the JSON is invalid, `version !== 1`, or required top-level keys are missing.
  - Worker protocol: request `{ id:number; cmd: {type:'simDays'; days:number} | {type:'simUntil'; target:'regularEnd'|'playoffsEnd'}; league: League }`, response `{ id:number; league: League } | { id:number; error:string }`. `client.ts` exports `runSim(league, cmd): Promise<League>`.
  - `store.ts` (zustand): state `{ saveId:string|null; league:League|null; busy:boolean; error:string|null }` and actions `newLeague(opts)`, `load(id)`, `sim(cmd)`, `setRotation(teamId, rot)`, `importFile(file)`. `sim` returns immediately (no-op) if `busy` (Review Focus 5). On success it replaces the league and calls `writeSave`. `setRotation` validates with `validateRotation` and refuses invalid input with an error message.

- [ ] **Step 1: Write failing tests:** `write → list → load round-trips a created league`; `delete removes`; **`parseImport rejects garbage, wrong version, missing keys with SaveImportError` and existing saves unchanged after a failed import** (Review Focus 4); `exportSave → parseImport round-trip`; store: **`second sim while busy is ignored`** (mock `runSim` with a deferred promise, call `sim` twice, assert called once); `setRotation rejects invalid rotation and keeps old one`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The worker imports engine functions directly. In tests, mock `client.ts`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: saves, sim worker, app store`.

---

### Task 12: App shell, new league, home, saves

**Files:**
- Create: `src/ui/App.tsx`, `src/ui/layout/Shell.tsx` (nav: Home, My Team, Schedule, Standings, Leaders, Teams, Saves; collapses to a bottom tab bar under 720px), `src/ui/screens/NewLeague.tsx`, `src/ui/screens/Home.tsx`, `src/ui/screens/Saves.tsx`, `src/ui/components/SimControls.tsx`, `src/ui/components/TeamBadge.tsx` (monogram of the abbrev in team colours), `src/ui/theme.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: store (Task 11), `Face`, `computeStandings`
- Produces: the routes `#/`, `#/new`, `#/saves`, `#/team/:id`, `#/player/:id`, `#/schedule`, `#/game/:id`, `#/standings`, `#/playoffs`, `#/leaders`, `#/teams`, `#/my-team`, `#/dev/faces`. Routes that later tasks own render a placeholder until those tasks are done.

Behaviour:
- No saves → `#/new`. New League: a grid of the 30 teams grouped by conference, showing each team's top-3 players (face, name, OVR) and its team OVR. The user picks a team, a league name, and an optional seed. Create → save → Home.
- Home: record and conference rank, the next game (opponent badge, home/away, day), the last 5 results, a standings snippet (top of the user's conference), the user team's top performers (PPG), and a champion banner when the phase is offseason.
- SimControls (shown on Home and in the header): "Sim day", "Sim week" (7), "Sim to end of season", and "Sim playoffs". Show only the ones the phase allows. All are disabled with a spinner while `busy`. In `offseason`, show "Season complete — offseason arrives in the next update" instead.
- Saves: list, load, delete (with a confirm), export (download), and import (file input showing the import error text).
- Use the frontend-design skill for the visual direction: bold sports-broadcast energy with good table readability, and light and dark themes.

- [ ] **Step 1:** Implement the screens.
- [ ] **Step 2: Verify:** `npm run typecheck && npm test`. Then `npm run dev` and use a Playwright script: create a league as the Fakers, check Home shows the record 0-0 and a next game, click "Sim week", and check the record changes and the buttons were disabled during the sim. Reload the page and check the league persists. Export, delete, import, and check it's back. Take desktop and 390px-wide screenshots and confirm there's no horizontal scroll.
- [ ] **Step 3:** Commit `feat: app shell, new league, home, saves`.

---

### Task 13: My Team, team pages, player pages

**Files:**
- Create: `src/ui/screens/MyTeam.tsx` (roster + rotation editor), `src/ui/screens/TeamPage.tsx`, `src/ui/screens/TeamsBrowser.tsx`, `src/ui/screens/PlayerPage.tsx`, `src/ui/components/PlayerRow.tsx`, `src/ui/components/StatTable.tsx`
- Test: `tests/ui/rotationEditor.test.ts` (pure helper `moveInRotation(rot, playerId, to: {section:'starters'|'bench'|'inactive'; index:number}): Rotation` in `src/ui/rotationEdit.ts`)

Behaviour:
- **Rotation editor:** three sections (Starters 5, Bench up to 7, Inactive). Each row has up/down buttons and a "move to" menu (no drag-and-drop needed). It shows a live validation message from `validateRotation`, and Save is disabled while it's invalid. Injured players are marked 🤕 with games remaining. "Auto" applies `autoRotation`. Only the user's team is editable. Rows show the face, name, pos, age, OVR, PPG/RPG/APG, and salary and years left.
- **Team page:** a header with the badge, record, conference rank, and coach (face, name, style, W-L). Below that, the roster table and team per-game stats vs league rank.
- **Teams browser:** cards for all 30 teams grouped by conference, showing the record and team OVR.
- **Player page:** a large face, bio (age, height ft-in, pos, hometown, college, team link, jersey, contract, draft info or "Original roster"), the injury status, the rating breakdown (grouped Offense, Defense, Physical; OVR shown; POT shown as a fuzzy letter grade A–D), a season-by-season table (regular and playoffs, per-game, with a career row), and an OVR history line chart (use the dataviz skill; a single point is fine in M1).

- [ ] **Step 1: Write failing tests** for `moveInRotation`: moving a starter to the bench swaps in the bench player at that index; moving to inactive when the bench is full is allowed (so the result has fewer active players); the result always contains each id exactly once.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement the helper and screens. **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5: Verify in browser:** edit the rotation, save, sim a day, open the box score data via the store, and confirm the new starters have `gs: true`. Open 3 player pages and 2 team pages at desktop width and at 390px.
- [ ] **Step 6:** Commit `feat: roster, rotation editor, team and player pages`.

---

### Task 14: Schedule, box scores, standings, bracket, leaders

**Files:**
- Create: `src/ui/screens/Schedule.tsx`, `src/ui/screens/BoxScore.tsx`, `src/ui/screens/Standings.tsx`, `src/ui/screens/Playoffs.tsx`, `src/ui/screens/Leaders.tsx`

Behaviour:
- **Schedule:** the user's team by default, with a team picker. Each row shows the day, opponent, home/away, and the result W/L with the score linking to the box score, or "—" if unplayed. Playoff games are labelled by series.
- **Box score:** quarter-by-quarter line score (with OT columns), a Player of the Game card with face and statline, and two team tables with MIN PTS REB(O/D) AST STL BLK TO PF FG 3P FT +/-. DNPs are listed as "DNP – Coach's decision" or "DNP – Injured". Team totals and percentages appear at the bottom.
- **Standings:** a table per conference with W L PCT GB CONF HOME AWAY PF/G PA/G DIFF STRK L10. A line separates the top 8. The user's team is highlighted.
- **Playoffs:** the bracket for both conferences plus the Finals, showing series scores and seeds, with the champion highlighted. Before the playoffs it shows "If the season ended today", seeded from the current standings.
- **Leaders:** a card per stat (PTS REB AST STL BLK 3PM FG% 3P% FT%) showing the top 5 with face, team, and value. Clicking a card opens the top 25 for that stat.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify:** `npm run typecheck && npm test`. With Playwright: sim to the end of the season, open the standings (16 teams above the cut lines, 8 per conference), open a box score and check the column sums by script against the shown totals, sim the playoffs and confirm the bracket shows a champion, and confirm Leaders has 9 cards. Take 390px screenshots of the box score and standings; tables may scroll horizontally inside their own container, but the page must not.
- [ ] **Step 3:** Commit `feat: schedule, box scores, standings, bracket, leaders`.

---

### Task 15: PWA + GitHub Pages deploy

**Files:**
- Modify: `vite.config.ts` (VitePWA: `registerType:'autoUpdate'`, manifest name "Ball Ball Manager", short_name "BallBall", theme colour from the theme, icons 192/512 + maskable generated as simple PNGs of a basketball monogram, and precache all build assets)
- Create: `public/icons/*`, `.github/workflows/deploy.yml` (on push to `main` and `workflow_dispatch`: `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` on `dist`, `actions/deploy-pages`), `README.md` (how to play locally, `npm i && npm run dev`, and how to enable Pages: Settings → Pages → Source: GitHub Actions)

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify:** `npm run build && npx vite preview`. With Playwright: load the preview, wait for the service worker, go offline (`context.setOffline(true)`), reload, and check the app still loads and an existing save opens. Run a Lighthouse-free sanity check: the manifest is served and the icons resolve.
- [ ] **Step 3:** Commit `feat: installable offline PWA and pages deploy`.

---

## Self-review notes

- Spec §§6–11 and 22, as listed for M1 → Tasks 2–14. Spec §5 → Tasks 1, 11, 15. Faces §8 → Task 3. Contracts, coaches, and morale data are stored but get no behaviour until M2/M3, as planned.
- The schedule follows the spec's 29 + 10 conference + 1 cross-conference split (Task 5).
- Data retention (spec §5) only matters across seasons, so it's deferred to M2, where seasons roll over.
