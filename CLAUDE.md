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
- Stories (awards, records, history, HoF, highlights, social, inbox, fans/morale) live in `src/engine/stories/`; the season engine only calls `stories/hooks.ts`, and story randomness uses `storyRng` so it never shifts game results.
- Rotations: `Rotation.minutes` is the GM minutes plan (sums to 240), `Rotation.auto` lets the coach re-pick before every game; in-game energy/fatigue tunables are `FATIGUE` in `sim/game.ts`.
- GM logic lives in `src/engine/gm/` (cap, trade, roster/FA/waivers, draft, offseason); UI GM moves go through `useStore().act`.
- Save format is `League` (version 7) in IndexedDB; keep it JSON-serializable and bump `version` + add a migration if the shape changes.
