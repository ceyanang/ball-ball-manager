# Contract extensions, team/player options and rookie-scale option years — design

## Why
Contracts are a ticking clock today: a deal runs out, the player is re-signed in the offseason "Re-sign" step (or walks), and that's the only contract decision a GM ever makes. The owner wants **more GM decisions every season**: lock a player up *before* free agency, choose whether to buy another year of a rookie, and trade price against flexibility when writing a deal.

## Goals
- **Extensions:** extend a player who is in the last season of his deal, before he reaches free agency.
- **Team options:** the team decides whether to keep a player for one more season at a set salary.
- **Player options:** the player decides whether to stay or hit the market.
- **Rookie-scale deals with a 4th-year team option:** first-round picks keep the existing scale and 3 years, then get a team option year (the existing "rookie deals" become an actual decision).
- CPU teams use all of it so the league behaves consistently.

## Non-goals
- No raises/escalators, no year-by-year salary schedules (contract keeps one salary number).
- No Bird rights, no cap exceptions (the cap stays absolute, per the original spec), no no-trade clauses, buyouts, or sign-and-trade.
- No rewriting of existing saves' contracts: old deals simply have no option.

## Anti-goals
- Never let a contract move go over the cap.
- Never shift game-sim results: story/news randomness stays on `storyRng`; engine stays pure TS with `Rng`.
- Don't make the offseason a chore: no more than one extra step, and "auto" paths exist for the user who doesn't care.

## Approaches considered
- **A. Option slot on the contract (chosen).** Optional `option` field on `Contract`; a new offseason step; an `extend` GM move. Small migration, reuses re-sign logic and CPU code.
- **B. Year-by-year contract schedule.** Most realistic, but touches cap, trade, waivers, dead money, value and UI, with a risky migration. Rejected as too big.
- **C. Extensions first, options later.** Safe, but touches the contract shape twice. Rejected; A is already small.

The owner picked **A**.

## Design

### Data
```ts
interface Contract {
  salary: number
  expires: number                              // last guaranteed season
  option?: { type: 'team' | 'player'; salary: number }  // optional extra season = expires + 1
}
```
- The option year is **not part of the cap or dead money** until it is exercised. When exercised, the contract becomes `{ salary: option.salary, expires: expires + 1 }` (no option left). So the cap code keeps seeing one salary per contract.
- Contracts are copied as `{ ...contract }` on trade/waiver, so the option travels with the player.
- Save: `League` version 7 → 8. New league field `extendTries: Record<string, number>` (rejected extension offers this season; reset at season start). Migration: `if (raw.version === 7) raw = { ...raw, version: 8, extendTries: {} }`. Players need no migration (option is optional). Update `CURRENT_VERSION` and `create.ts`.

### Rookie scale
- R1: 3 guaranteed years at the existing `rookieSalary(slot)`, plus a **team option** for year 4 priced above the scale salary (my call: about 125%, capped at the max; builder tunes). R2: 2 years, no option (unchanged). Not negotiable (unchanged).
- Applies to rookies signed from now on, by both user and CPU (`signRights` in `draft.ts`).

### Options in the offseason
- New offseason step `'options'` between `'draft'` and `'resign'` (add to `OffseasonStep`, the step list/labels in `Offseason.tsx`, and `advanceOffseason`).
- At that step, every player whose contract has `expires === l.season` **and an `option`** gets a decision:
  - **Team option, user's team:** the user exercises or declines each one (screen with salary, OVR, value).
  - **Team option, CPU:** exercise if the player is worth the salary (use `playerValue`, same family as `aiWantsResign`).
  - **Player option:** decided automatically, with `rng`: he opts in if the option salary is close to his market ask (about ≥95% of `askSalary`) and his morale is OK; otherwise he opts out. Report the result to the user.
- Declined/opted-out players just keep their contract as expiring, so they land in the normal Re-sign step (user) or `aiResign`/free agency (CPU). Nothing new to build for that path.
- If the user takes no action, "Continue" with undecided team options **exercises them if the player is in the user's top 9 by OVR and declines the rest** (my call), so skipping the step never costs a rotation player. The Continue button warns when something is left undecided.

### Extensions
- **Who:** a player on the user's roster with a contract that ends this season (in-season or offseason), who has no extension attempts left (max 3 rejections per season, tracked in `extendTries`), whose morale is ≥ 25, and who is not already in the re-sign step's expiring list at the `'resign'` step (that step already handles him).
- **How:** new GM move `extendPlayer(l, rng, playerId, salary, years, optionType?)` in `src/engine/gm/roster.ts`, via `useStore().act`. Reuses `checkOffer` and `resignChance`. On success: `contract = { salary, expires: expires + years }` (the new salary applies immediately, since a contract has one salary number; the cap check uses the *increase* only), logged as a `resign`-type transaction.
- A rejected offer lowers morale by 4 and uses a try, like re-signing; at 3 he refuses to talk and walks at expiry as usual.
- **CPU:** in `aiResign` (and in the rookie-option logic), CPU teams extend their best expiring young players before they reach the market, never breaking the cap.

### Choosing option terms when you offer a deal
- Free-agent offers, re-signs and extensions get an optional "final-year option" choice: none / team option / player option.
- **Trade-off (builder tunes numbers):** a team option makes him ask more (about +8% on the ask), a player option makes him ask less (about -5%). The option salary defaults to the deal's salary.
- The existing 1 to 5 year cap on guaranteed years stays; the option year is on top of it.

### UI
- `MyTeam` contracts table: option badge (TO / PO) next to the expiry, and an **Extend** button for eligible players that opens the same kind of offer form as Re-sign (with the asking price, odds, and option choice).
- `Offseason`: the new "Options" step screen; `Draft` screen's "Continue" label updated to lead into it.
- `Trade`/roster tables show the option badge where contracts are shown.
- Inbox ('contract' kind): messages when an option is exercised/declined and when a player opts in or out, written with `storyRng`.

### Testing
- Engine unit tests (Vitest): option exercise/decline updates the contract and cap correctly; a player option decision is deterministic for a seed; extension price and cap-increase check; `extendTries` limit; rookie signing gives R1 a team option and R2 none; migration v7 → v8; the offseason step order; the option year never counts toward cap/dead money before it is exercised.
- Determinism: a regular-season sim with the same seed gives the same game results with and without these stories.

## Left to the builder
- Exact formulas and constants (option year salary, +/- ask adjustments, CPU thresholds).
- UI layout details, copy, and test fixtures.
- Where the `Extend` button lives besides `MyTeam` (e.g. the player page).

## Calls I made (flag any you disagree with)
1. Option year is **appended after** `expires`, so the cap code still sees one salary.
2. New salary after an extension applies **immediately** (one-salary-per-contract limitation).
3. Player options are decided **automatically**; only team options are the user's call.
4. Skipping the Options step exercises team options for your top 9 by OVR, declines the rest.
5. R1 4th-year option is about 125% of the scale salary.
6. Extension attempts follow the re-sign rule: 3 rejections and he stops talking.
