# Sound Front + FT in Watch Recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show free throws in the watch-mode recap/player sheet, and add synthesized music (menu / front office / match) plus sound effects with volume and mute controls.

**Architecture:** A new `src/audio/` module (pure data + pure helpers, plus a thin Web Audio engine) is driven by a route→area hook mounted in `Shell` and by SFX calls in `WatchGame`. Settings persist in localStorage, outside the `League` save. The engine layer (`src/engine/`) is untouched.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (`renderToStaticMarkup` for UI markup tests — no testing-library installed), Web Audio API.

**Spec:** `docs/superpowers/specs/2026-11-23-sound-and-ft-recap-design.md`

## Global Constraints

- No audio asset files, no new dependencies, works offline (PWA).
- Audio must never throw or block: every `AudioContext` access is guarded; failure degrades to silence.
- No sound before a user gesture; muted = silent (music and SFX).
- `src/engine/` stays pure (no audio imports). No `League` save change, no `version` bump.
- Storage reads/writes wrapped in try/catch (private mode, corrupt values → defaults).
- Gate before shipping: `npm test` and `npm run typecheck` green; then follow CLAUDE.md "Always ship to the live site".

## Review Focus

- `AudioContext` missing/blocked (jsdom, old browsers): every public audio call is a silent no-op, never throws.
- Corrupt/out-of-range stored settings (`"abc"`, `-3`, `9`, `null`): load clamps to 0–1 or falls back to defaults.
- Rapid route hopping / same area re-entered: exactly one music loop plays; switching to the current area does nothing.
- Muted or volume 0 stays silent across area changes and period/final buzzers.
- 4× speed floods SFX: per-sound throttle so overlapping identical sounds within ~40 ms are dropped.
- Tab hidden: music suspends and resumes on visibility (no battery drain on the installed phone app).
- Reduced-motion users skip ball animations but still get SFX (SFX fire from `onFired`, not `animate`).

---

### Task 1: FT in the watch recap and player sheet

**Files:**
- Modify: `src/ui/watch/QuarterBreak.tsx` (header list + row cells)
- Modify: `src/ui/watch/WatchPlayerSheet.tsx` (`cells` array)
- Modify: `src/ui/watch/watch.css` (`.w-lines > div` grid gets one more 36px column; check `.w-boxgrid` still lays out 12 cells evenly)
- Test: `tests/ui/recapTable.test.tsx`

**Interfaces:**
- Consumes: `LiveLine.ftm` / `LiveLine.fta` (`src/ui/watch/replay.ts`), `RecapRow`.
- Produces: nothing new.

- [ ] **Step 1: Write failing test** `renders an FT column with made/attempted`: build a `RecapRow` (team via `makeTeam`-style fixture already used in `tests/ui/recap.test.ts`, line with `ftm: 2, fta: 3`), `renderToStaticMarkup(<QuarterBreak …/>)`, assert the markup contains a `columnheader` with text `FT` and a cell `2/3`; assert the headers appear in order `PTS REB AST FG 3P FT`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/recapTable.test.tsx` — expect FAIL (no FT header).
- [ ] **Step 3:** Add `'FT'` after `'3P'` in the header array; add `<span role="cell">{r.line.ftm}/{r.line.fta}</span>` after the 3P cell; add `['FT', \`${line.ftm}/${line.fta}\`]` after `['3P', …]` in `WatchPlayerSheet` `cells`; extend the `.w-lines > div` grid template with one more `36px`.
- [ ] **Step 4: Run** the test — expect PASS. Run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(watch): show free throws in the recap and player sheet`.

### Task 2: Audio settings (persisted volumes + mute)

**Files:**
- Create: `src/audio/settings.ts`
- Test: `tests/ui/audioSettings.test.ts`

**Interfaces:**
- Produces:
  - `interface AudioSettings { music: number; sfx: number; muted: boolean }` (volumes 0–1; defaults `{ music: 0.5, sfx: 0.7, muted: false }`)
  - `parseSettings(raw: string | null): AudioSettings` — pure; invalid JSON/fields → defaults per field; numbers clamped to 0–1.
  - `getSettings(): AudioSettings`, `setSettings(patch: Partial<AudioSettings>): void` (clamps, persists under key `bbm.audio`, notifies subscribers), `subscribeSettings(fn: () => void): () => void`, `useAudioSettings(): AudioSettings` (via `useSyncExternalStore`).

- [ ] **Step 1: Write failing tests:** `parseSettings(null)` equals defaults; `parseSettings('{"music":9,"sfx":-3,"muted":"yes"}')` → `{ music: 1, sfx: 0, muted: false }`; `parseSettings('not json')` equals defaults; `setSettings({ music: 0.2 })` then `getSettings().music === 0.2`, subscriber called once, and a throwing `localStorage.setItem` (stub) does not throw.
- [ ] **Step 2: Run** `npx vitest run tests/ui/audioSettings.test.ts` — FAIL.
- [ ] **Step 3: Implement** as specified; module-level cached settings, storage access in try/catch.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(audio): persisted volume and mute settings`.

### Task 3: Route → music area

**Files:**
- Create: `src/audio/area.ts`
- Test: `tests/ui/audioArea.test.ts`

**Interfaces:**
- Produces: `type MusicArea = 'menu' | 'office' | 'match'`; `areaFor(pathname: string, watching: boolean): MusicArea` — `watching` → `'match'`; `/office`, `/trade`, `/trade-finder`, `/free-agents`, `/draft`, `/offseason` (and sub-paths) → `'office'`; everything else → `'menu'`.

- [ ] **Step 1: Write failing tests** for each listed path, `/` → menu, `/player/abc` → menu, `/trade-finder` → office (not confused with `/trade` prefix handling), `/office/anything` → office, and `areaFor('/office', true) === 'match'`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(audio): map routes to music areas`.

### Task 4: Track data and note scheduling

**Files:**
- Create: `src/audio/tracks.ts`
- Test: `tests/ui/audioTracks.test.ts`

**Interfaces:**
- Produces:
  - `interface Voice { wave: OscillatorType; gain: number; steps: (number | null)[] }` — one entry per 16th step; a number is a MIDI note, `null` a rest.
  - `interface Track { bpm: number; steps: number; voices: Voice[]; drums: { kick: boolean[]; snare: boolean[]; hat: boolean[] } }` where every array has length `steps` (loop length, e.g. 32 or 64).
  - `TRACKS: Record<MusicArea, Track>` — menu: chill, ~92 bpm, soft triangle/sine pad+bass, light hats; office: tense groove, ~104 bpm, minor key, square-ish pluck + bass; match: driving, ~128 bpm, kick on every beat, snare on 2/4, busy hats.
  - `stepsAt(track: Track, step: number): { notes: { wave: OscillatorType; gain: number; midi: number }[]; kick: boolean; snare: boolean; hat: boolean }` — wraps `step` modulo `track.steps`.
  - `midiToHz(m: number): number` (A4 = 69 = 440 Hz).

- [ ] **Step 1: Write failing tests:** `midiToHz(69) === 440`, `midiToHz(57) === 220`; for each area every voice and drum array has length `track.steps` and every note is an integer 24–96; `stepsAt(TRACKS.match, 0).kick === true`; `stepsAt(t, t.steps)` equals `stepsAt(t, 0)` (wraps); the three tracks differ in `bpm`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (musical content is the builder's call; keep each track a few bars so it loops without being annoying). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(audio): music track data for menu, office and match`.

### Task 5: Audio engine and SFX

**Files:**
- Create: `src/audio/engine.ts`, `src/audio/sfx.ts`
- Test: `tests/ui/audioEngine.test.ts`

**Interfaces:**
- Consumes: `getSettings`/`subscribeSettings` (Task 2), `TRACKS`/`stepsAt`/`midiToHz` (Task 4), `MusicArea` (Task 3).
- Produces (`engine.ts`):
  - `unlockAudio(): void` — create/resume the `AudioContext` (call from a user gesture); no-op if unsupported.
  - `playArea(area: MusicArea): void` — start that loop with a ~1 s crossfade; no-op if it is already the current area; never stacks loops.
  - `setIntensity(level: 0 | 1): void` — match track only: level 1 adds extra hat/voice energy (e.g. gain boost / double-time hats) for Q4/OT.
  - `stopMusic(): void`.
  - Music gain follows `settings.music` and is 0 when `settings.muted`; reacts live to settings changes; context is suspended while `document.hidden` and resumed on `visibilitychange`.
  - Lookahead scheduler: a ~25 ms timer schedules steps ~100 ms ahead using `stepsAt`.
- Produces (`sfx.ts`): `sfx.swish()`, `sfx.clank()`, `sfx.ftTick()`, `sfx.block()`, `sfx.buzzer()`, `sfx.crowd()`, `sfx.tap()` — each a short synth (noise burst / filtered oscillator envelope) through an SFX gain bound to `settings.sfx` (0 when muted); each throttled (same sound within 40 ms dropped); all no-ops without a context.

- [ ] **Step 1: Write failing tests (jsdom, no `AudioContext`):** `unlockAudio()`, `playArea('menu')`, `setIntensity(1)`, `stopMusic()` and every `sfx.*()` call do not throw when `globalThis.AudioContext` is undefined; with a minimal stub `AudioContext` (counting `createOscillator` calls), `playArea('menu')` twice does not start two schedulers (assert via an exported `__debug.loops()` returning the active-loop count = 1) and `playArea('office')` swaps to the new area (count stays 1); with `muted: true` set via `setSettings`, no oscillator is created by `sfx.swish()`.
- [ ] **Step 2: Run** `npx vitest run tests/ui/audioEngine.test.ts` — FAIL.
- [ ] **Step 3: Implement** the engine (lazy context, master → music/sfx gains, scheduler, crossfade by ramping the outgoing/incoming loop gains) and `sfx.ts`. Keep the stub-friendly API surface small (`createOscillator`, `createGain`, `createBuffer`/`createBufferSource`, `createBiquadFilter`, `currentTime`, `resume`, `suspend`).
- [ ] **Step 4: Run** — PASS; run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(audio): web audio engine, crossfading loops and synthesized sfx`.

### Task 6: Wire music into the shell and SFX into the watch screen

**Files:**
- Create: `src/audio/useMusic.ts` (`useMusic(pathname: string, watching: boolean): void` — effect calling `playArea(areaFor(...))`; also installs one-time `pointerdown`/`keydown` listeners that call `unlockAudio()`)
- Modify: `src/ui/layout/Shell.tsx` — call `useMusic(pathname, watching)` **above** the early `if (watching) return …` so hook order is stable.
- Modify: `src/ui/watch/WatchGame.tsx` — in `onFired` (runs regardless of reduced motion): made fg → `sfx.swish()` (+ `sfx.crowd()` when `e.three` or on a `hot` callout), missed fg → `sfx.clank()` (a following `blk` event → `sfx.block()`), `ft` → `sfx.ftTick()` then swish/clank by `e.made`; at period end (where `setPhase('break'|'final')` is called) and in `skipToFinal` → `sfx.buzzer()`; when a period ≥ 4 starts (`nextPeriod`) call `setIntensity(1)`, and `setIntensity(0)` + restore on unmount (`stopMusic` is not needed — Shell switches area on exit).
- Test: `tests/ui/useMusic.test.ts` (pure part only — see below)

**Interfaces:**
- Consumes: Tasks 3 and 5.

- [ ] **Step 1: Write failing test** that `areaFor` is what `useMusic` uses: export `pickArea` as a re-export check is unnecessary — instead test an exported pure helper `sfxFor(e: PlayEvent, next?: PlayEvent): 'swish' | 'clank' | 'block' | 'ftSwish' | 'ftClank' | null` in `src/audio/watchSfx.ts`: made fg → `swish`; missed fg followed by `blk` → `block`; missed fg → `clank`; made ft → `ftSwish`; missed ft → `ftClank`; `reb`/`sub`/`lineup` → `null`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `watchSfx.ts`, `useMusic.ts`, and the `Shell`/`WatchGame` wiring (map `sfxFor` results to `sfx.*` calls; ft results also call `sfx.ftTick()`). **Step 4: Run** `npm test` — all PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(audio): per-area music and watch-mode sound effects`.

### Task 7: Sound controls

**Files:**
- Modify: `src/ui/screens/Saves.tsx` — add a "Sound" panel (music slider, SFX slider, mute toggle) using `useAudioSettings` / `setSettings`; labelled inputs (`<input type="range" min=0 max=1 step=0.05>`), mute as `aria-pressed` button.
- Modify: `src/ui/watch/WatchGame.tsx` — a small 🔊/🔇 button in the `.w-top` row toggling `muted` (the sidebar is hidden while watching).
- Test: `tests/ui/soundPanel.test.tsx`

**Interfaces:**
- Consumes: `useAudioSettings`, `setSettings` (Task 2).
- Produces: `SoundPanel` component exported from `src/ui/components/SoundPanel.tsx` (used by Saves; the watch mute button is separate).

- [ ] **Step 1: Write failing test:** `renderToStaticMarkup(<SoundPanel />)` contains two `type="range"` inputs labelled "Music" and "Sound effects" and a mute button with `aria-pressed="false"` by default.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `SoundPanel`, mount it in `Saves`, add the watch mute button. **Step 4: Run** `npm test` and `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(audio): volume sliders and mute in Saves and watch mode`.

### Task 8: Ship

- [ ] **Step 1:** `npm test`, `npm run typecheck`, `npm run build` all green.
- [ ] **Step 2:** Manually run `npm run dev` (or `run` skill) and confirm: FT column appears in a recap, menu→office→match music switches, SFX fire in a watched game, mute silences everything.
- [ ] **Step 3:** Push the working branch, fast-forward `main`, `git push origin main`, confirm the "Deploy to GitHub Pages" run is green (CLAUDE.md steps 1–4); tell the owner the site is updated.

---

## Self-review notes
- Spec coverage: FT recap + sheet (T1), three areas (T3/T4/T6), intensity late (T5/T6), SFX list (T5/T6), settings + UI (T2/T7), offline/no deps/no-throw (T5), shipping (T8).
- Names consistent: `areaFor`, `MusicArea`, `playArea`, `unlockAudio`, `setIntensity`, `getSettings/setSettings/useAudioSettings`, `sfxFor`.
