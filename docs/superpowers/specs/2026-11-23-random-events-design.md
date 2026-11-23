# Random Events ("pop-ups") — design

Date: 2026-11-23 · Status: draft for owner approval

## Intent and why

Right now the season is "press sim, read results". The owner wants moments that interrupt that: a pop-up with a short, usually funny prompt and (usually) three answers. Each answer nudges something the owner already cares about — fan love, a player's morale, a player's or the team's performance, team chemistry, ratings/OVR. Choices should be *gambles*, not "pick the green one": saying no to a day off is sometimes right, saying yes is sometimes a disaster. Some events are players asking for something, e.g. "I want to work on my three-pointer".

The owner wants **a lot** of events, mostly comedic, appearing both around games and across the season.

## Goals

- A pop-up that fires during the season on the user's team, shows an emoji, a headline, a funny paragraph, and 2–3 choices.
- Choices resolve through **weighted outcomes** (hidden until you choose), then a result card says what happened ("🎯 Nailed it" / "💥 Backfired") and exactly what changed.
- Effects cover: fans (player or team), morale, **team chemistry** (new stat), temporary performance buffs/debuffs (a number of games), small permanent rating changes (training requests, OVR nudges), resting a player for a game.
- A **catalog written as data** so 50+ events can be added without touching engine code. Ship a launch set of roughly 60 (≥ 15 of them "player asks for something", ≥ 10 pre-game, a few playoff-only).
- Events never shift the league's sim randomness (use `storyRng`); only their *effects* change results.

## Non-goals

- No events for AI teams (user team only; AI teams are unaffected).
- No **halftime** pop-ups in this round. `simGame` plays a whole game in one call; pausing mid-game means restructuring the sim. Pre-game and post-game events cover the "in-game feeling". Revisit later as its own project.
- No cosmetic mid-replay pop-ups in watch mode (the game is already decided).
- No branching event chains / multi-step stories (v1 events are one prompt, one answer).
- None of the other gauntlet ideas (coaching staff market, finances, scouting, etc.) — separate brainstorms.

## Anti-goals (failure even if it technically works)

- Obvious best answers ("+10 morale / +5 fans / +3 OVR" next to "lose a game"). Every choice should have an upside and a real risk; good outcomes shouldn't always be on the same slot.
- Events that spam so often that sim-to-deadline becomes a chore. Frequency is a setting and there's a per-event cooldown.
- Save-scumming: reloading and re-picking must not re-roll the outcome.
- Saves breaking: the League stays JSON-serializable and migrates from v7.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Data-driven catalog: each event is a record (trigger, text templates, choices → weighted outcomes → effect lists) interpreted by one resolver | Fastest way to a large catalog; weird one-offs are harder |
| B | One hand-coded function per event | Max freedom, but slow; we'd get ~15 events, not "a lot" |
| C | A plus a code escape hatch | Not needed now; can be added to A later (an optional `custom` field) |

The owner picked **A**.

## Design

### Event shape (TypeScript data in `src/engine/events/catalog/*.ts`)

```ts
interface EventDef {
  id: string
  when: 'preGame' | 'postGame' | 'day'     // day = between games / off day
  weight: number                            // relative frequency
  cooldownDays?: number                     // don't repeat too soon
  /** Picks the subject(s) or returns null if the event can't fire now. */
  pick(ctx: EventCtx): Subjects | null
  emoji: string
  title(s: Subjects): string                // templates use player/coach names
  text(s: Subjects): string
  choices: ChoiceDef[]                      // 2–3
}
interface ChoiceDef { label: string; emoji?: string; outcomes: OutcomeDef[] }
interface OutcomeDef { weight: number; tone: 'good' | 'bad' | 'neutral'; text(s: Subjects): string; effects: Effect[] }
```

`EventCtx` is read-only league state: standings/streak, the user's roster, who's hot or injured, game opponent, playoff status, etc. So "triggers" are things like *star on a 5-game heater*, *back-to-back day*, *loss streak*, *rookie benched*, *playoff game*.

### Effect building blocks

| Effect | Does |
|---|---|
| `morale` | ± to a player's `morale` (clamped 0–100) |
| `fans` | ± to a player's or the team's fan sentiment (−100..100) |
| `chemistry` | ± to team chemistry |
| `buff` | Temporary modifier (team or player; `shooting`, `defense`, `energy`, `all`) for N games. Stored as data; **never** edits ratings, so it can't leak or fail to revert |
| `rest` | Player sits out the next game (forced inactive, no injury risk that game) |
| `train` | Slow permanent boost to one named rating (e.g. `three +1…+2`), applied through the existing progression/training path |
| `ovrNudge` | Small permanent change across a player's ratings (small, rare, and visible in the result card) |
| `inbox` / `news` | Flavour line in the inbox/news so the moment shows up in the league story |

New effects are one small function each; events only reference them by name.

### New state (League v8)

- `chemistry: Record<teamId, number>` (0–100, start 50). Drifts a little toward 50, moves from events and roster churn (my call: keep drift/roster effects minimal for v1; events are the main mover). Sim effect: a small make-probability bonus like morale's `K.morale` (a `K.chemistry` tunable in `sim/game.ts`).
- `events: { pending: PendingEvent | null; active: ActiveEffect[]; history: EventLogEntry[]; cooldowns: Record<eventId, number> }`.
  - `PendingEvent` stores only the `eventId`, the subject ids, and the day/season it fired — enough to rebuild the text — so the app can be closed mid-prompt without losing it.
  - `ActiveEffect`: `{ id, target, kind, amount, gamesLeft }`.
- Migration `7 → 8` fills empty defaults. Bump `version` and `CURRENT_VERSION`.

### Flow

1. In `stepDay`, **before** the user's game is played, `events/hooks.ts` rolls (via `storyRng`, a fixed salt) whether a pre-game/day event fires, then picks a weighted eligible event. If so, `stepDay` returns early to pause the sim — same mechanism as `stopOnOffer`/the trade-offer pause, so "Sim to deadline" etc. stop and wait.
2. The UI shows the pop-up (modal over the current screen). The player picks a choice; the engine resolves the **outcome with `storyRng` seeded by league seed + day + event id**, so reloading gives the same result (no save-scum). Effects apply; a result card shows what changed.
3. The sim resumes. Active `buff`/`rest` effects are passed into `simGame` as an optional `mods` argument (per-player shot/defense/energy offsets, team chemistry bonus, forced-inactive list), then `gamesLeft` is decremented after the game.
4. After the day, a `postGame` event can fire (e.g. after a big win/loss, a blowout, a record).
5. Not answering (e.g. the user presses sim again) is not an option: the event waits as `pending` until answered, except `day` events which have a "Skip" that expires them with no effect. (My call.)

### Sim to next event (added at approval)

A new sim button, **"Sim to next event"**, plays days until the next pop-up fires and stops there (or at the end of the phase if none fires). Because every event is a pause, it stops at the *next event of any kind* (a player request, a prank, whatever comes first). A "requests only" version would need auto-skipping the others, so it is out of scope for v1. It is `simUntil` with `target: 'event'`.

### Frequency

Setting on the League/settings: **Off / Some / Lots** (default **Lots**), roughly one event per 3–5 team game days at "Lots" (~15–25 a season), fewer at "Some". Cooldown per event; global max one pending at a time.

### UI

- New `EventModal` component: emoji, title, text, 2–3 big choice buttons, then a result card ("🎯 Nailed it!" + bullet list of what changed, e.g. "Marcus Webb morale +8 😎, team chemistry −3 😬").
- A small **Events log** on the Inbox or Home screen so past ones can be re-read.
- Result toasts reuse existing patterns.

### Sample events (for flavour and to size the catalog)

- 🛌 *"Webb wants a night off"* — Give it (rested: +energy buff; or he parties and shows up late: morale −, fans −) / Say no (grumpy: morale −; or "revenge game": +shooting buff) / "Play 18 minutes" (compromise).
- 📱 *"Rookie got caught streaming at 3am"* — Fine him / Laugh it off / Join the stream (fans ↑↑ or ↓↓).
- 🏋️ *"I want to work on my three"* — Approve (train three, but −minutes morale elsewhere or tiny injury risk) / Decline (morale −) / Make him earn it (chemistry mixed).
- 🍕 *Pizza after a loss streak*, 🐶 *a mascot incident*, 🎤 *a post-game rant to the press*, 🧦 *superstitious lucky socks gone missing*, 🧑‍🏫 *assistant coach vs. star argue about plays* …

## Constraints

- `src/engine/` stays pure TS: no React/DOM, no `Math.random` (use `Rng`/`storyRng`).
- Event code is called only from a new `events/hooks.ts` entry point plus the minimal call sites in `season/advance.ts` and `simGame`'s `mods` parameter, mirroring `stories/hooks.ts`.
- Events must not change results for AI-vs-AI games, and with no active effects `simGame` must behave exactly as today (existing tests unchanged).
- Sim runs in the worker on `structuredClone`d leagues; pending/active state lives in the `League` and must be serializable.
- Ship workflow per `CLAUDE.md` (tests + typecheck green, merge to `main`, check the Pages deploy).

## Calls I made (flagged for your review)

1. User-team events only.
2. Pre-game + post-game + between-day timing; **halftime deferred**.
3. Default frequency "Lots" (~15–25 per season) with an Off/Some/Lots setting.
4. Outcomes are re-derivable from the seed (no save-scumming).
5. Temporary buffs are `mods` passed into the sim, never edits to ratings.
6. Team chemistry starts at 50, is mostly moved by events, with a small sim effect.
7. `day` events can be skipped; pre/post-game events must be answered.
8. Launch catalog ≈ 60 events across the categories above.

## Left to the builder

- Exact numbers: effect sizes, buff caps, chemistry's `K.chemistry`, event weights/cooldowns.
- Exactly where in `simGame` the `mods` hook in (shot probability / energy / rotation).
- How `rest` interacts with `rotation.auto` and the user's saved lineup.
- The Events log's placement and the visual style of the modal.
- The test plan (determinism of outcomes, effect expiry, migration, "no mods = unchanged sim").
