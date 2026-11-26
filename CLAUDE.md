# Ball Ball Manager — notes for Claude

## Always ship to the live site
The game is played from GitHub Pages: https://ceyanang.github.io/ball-ball-manager/
The owner has given standing permission to update `main` so the site stays current.

After finishing any piece of work (and once `npm test` and `npm run typecheck` pass):
1. Commit on the working branch and push it.
2. Fast-forward/merge that work into `main` and `git push origin main` — this triggers `.github/workflows/deploy.yml`, which tests, builds and deploys Pages.
3. Check the "Deploy to GitHub Pages" workflow run finished green; if it failed, fix it before calling the work done.
4. Tell the owner the site is updated (the installed phone app picks up the new version on its next launch with signal).

Never deploy a red build: the workflow runs the tests, but run them locally first.

## Project basics
- React + TypeScript + Vite app; pure-TS engine in `src/engine/` (no React/DOM/Math.random — use `Rng`).
- `npm test` (Vitest), `npm run typecheck`, `npm run dev`, `npm run build`.
- Spec: `docs/superpowers/specs/2026-11-22-ball-ball-manager-design.md`; plans in `docs/superpowers/plans/` (M1 core league, M2 GM layer, M3 stories done).
- Fans: `fans.players` is short-term game buzz, `fans.base` the long-term following (tenure, homegrown, team hopping, stardom, form, relative +/-, hardware) recomputed weekly in `stories/sentiment.ts`; use `fanOf` to read, write buzz only.
- Stories (awards, records, history, HoF, highlights, social, inbox, fans/morale) live in `src/engine/stories/`; the season engine only calls `stories/hooks.ts`, and story randomness uses `storyRng` so it never shifts game results.
- Rotations: `Rotation.minutes` is the GM minutes plan (sums to 240), `Rotation.auto` lets the coach re-pick before every game; in-game energy/fatigue tunables are `FATIGUE` in `sim/game.ts`.
- GM logic lives in `src/engine/gm/` (cap, trade, roster/FA/waivers, draft, offseason); UI GM moves go through `useStore().act`.
- Random pop-up events live in `src/engine/events/` (catalog of plain data in `catalog/*.ts`, `engine.ts` rolls/resolves, `effects.ts`, `mods.ts` for temporary sim modifiers). Events only roll when the sim is run with `pauseForEvents` (the worker does; tests/scripts don't); outcomes are seeded so reloads can't re-roll; temporary buffs are `GameMods` into `simGame`, never rating edits. Spec: `docs/superpowers/specs/2026-11-23-random-events-design.md`.
- People (players, coaches, fans) have a `Heritage` (american/african/asian/latino/european) rolled first (`face/heritage.ts`, 50/12.5×4) and stored in the low 3 bits of `faceSeed`; names come from `NAME_POOLS`/`pickName` (`data/names.ts`, ~12% mixed), faces from the weighted tables in `face/tables.ts`. Heritage is only inferred from a name in the save migration (`face/backfill.ts`). `/dev/faces` has a heritage filter for eyeballing new art.
- Save format is `League` (version 12) in IndexedDB; keep it JSON-serializable and bump `version` + add a migration if the shape changes.
