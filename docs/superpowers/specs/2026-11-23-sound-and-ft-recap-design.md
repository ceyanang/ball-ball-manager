# Sound front + FT in the watch recap — design

Status: approved in conversation (owner: "all of those").

## Intent
1. The quarter/final recap in watch mode shows PTS, REB, AST, FG, 3P but not free throws, so FT trips look like they
   vanish from the stat line. Free throws already animate and appear in the feed; the stats just never show them.
2. The game has no audio. Add a basic sound front: music that changes by area, plus sound effects.

## Goals
- Recap table gets an `FT` column (made/attempted) after `3P`, from the already-tracked `ftm`/`fta` on `LiveLine`.
  Check the watch player sheet too and add FT there if its line omits it.
- Three music beds: **match** (watch-game screen), **front office** (`/office`, `/trade`, `/trade-finder`,
  `/free-agents`, `/draft`, `/offseason`), **menu** (every other route).
- Match music gains intensity late (4th quarter / OT) — nice to have, only if cheap.
- Sound effects: made basket (swish), rim miss (clank), free-throw tick, block, buzzer at period end/final,
  crowd pop on big plays, plus small UI taps/confirmations where trivial.
- Music volume, SFX volume and a mute toggle, persisted (localStorage), in an easy-to-find place (Saves/settings area or shell).

## Non-goals / anti-goals
- No audio asset files, no new dependencies, no network. Must work offline as an installed PWA.
- Audio must never block, throw, or slow the sim; failure to init audio degrades silently.
- No sound before a user gesture (browser autoplay rules). No sound when muted; respect `prefers-reduced-motion`
  is NOT a sound rule — only the mute/volume controls decide.
- Engine (`src/engine/`) stays pure: no audio imports there. No save-format change (settings live outside `League`).

## Approaches considered
1. **Synthesized Web Audio loops + synthesized SFX (chosen).** Free, offline, tiny, can react to game state.
   Sounds retro/chiptune.
2. Generated real tracks bundled as files. Better sound; costs credits, adds MB to the PWA precache, can't react to play.
3. Hybrid (real music, synthesized SFX). Middle ground.
The audio module is built so a track is a swappable unit, leaving a path to upgrade to real files later.

## Design
- `src/audio/` module: a singleton `AudioEngine` (lazy `AudioContext`, master/music/sfx gain nodes, resume on first
  gesture), a small step-sequencer that schedules notes ahead of time (lookahead scheduler) for looping tracks, and
  `sfx.ts` with one-shot synth functions. Track definitions are data (tempo, scale, patterns) in `tracks.ts`.
- A `useMusicArea()` hook / small component mounted in the app shell maps the current route to
  `menu | office | match` and crossfades to that bed.
- `WatchGame.tsx` calls SFX at the points it already animates shots (made/miss/blocked/FT, period end, final).
- Settings (music vol, sfx vol, muted) in a tiny zustand slice or module with localStorage persistence (try/catch).
- Tests: unit-test route→area mapping and settings persistence/clamping; the recap FT column via existing watch tests
  pattern. Synthesis itself is not unit-tested (no audio in jsdom); `AudioContext` access is guarded.

## Left to the builder
Exact musical content (keys, patterns, instrument timbres), SFX shaping, where the volume UI sits, crossfade length.
