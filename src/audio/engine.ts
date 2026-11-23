import type { MusicArea } from './area'
import { getSettings, subscribeSettings } from './settings'
import { drumHit, tone } from './synth'
import { midiToHz, stepsAt, TRACKS } from './tracks'

type Ctor = typeof AudioContext
interface Loop { area: MusicArea; gain: GainNode; timer: ReturnType<typeof setInterval>; next: number; step: number }

const FADE = 1
const LOOKAHEAD = 0.1

let ctx: AudioContext | null = null
let musicBus: GainNode | null = null
let sfxBus: GainNode | null = null
let loop: Loop | null = null
let wanted: MusicArea | null = null
let intensity: 0 | 1 = 0
let hooked = false
const lastFired = new Map<string, number>()

const makeCtx = (): AudioContext | null => {
  try {
    const g = globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    const C = g.AudioContext ?? g.webkitAudioContext
    return C ? new C() : null
  } catch { return null }
}

function applyVolumes() {
  const s = getSettings()
  if (musicBus) musicBus.gain.value = s.muted ? 0 : s.music * 0.6
  if (sfxBus) sfxBus.gain.value = s.muted ? 0 : s.sfx
}

/** Call from a user gesture: creates/resumes the context and starts the wanted music. Safe to call repeatedly. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      ctx = makeCtx()
      if (!ctx) return
      musicBus = ctx.createGain(); musicBus.connect(ctx.destination)
      sfxBus = ctx.createGain(); sfxBus.connect(ctx.destination)
      applyVolumes()
      subscribeSettings(applyVolumes)
    }
    void ctx.resume()?.catch?.(() => {})
    if (!hooked && typeof document !== 'undefined') {
      hooked = true
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return
        void (document.hidden ? ctx.suspend() : ctx.resume())?.catch?.(() => {})
      })
    }
    if (wanted && !loop) startLoop(wanted)
  } catch { /* audio unavailable: stay silent */ }
}

function fadeOut(l: Loop) {
  clearInterval(l.timer)
  try {
    const t = ctx!.currentTime
    l.gain.gain.setValueAtTime(l.gain.gain.value, t)
    l.gain.gain.linearRampToValueAtTime(0, t + FADE)
  } catch { /* ignore */ }
  setTimeout(() => { try { l.gain.disconnect() } catch { /* ignore */ } }, FADE * 1000 + 100)
}

function startLoop(area: MusicArea) {
  if (!ctx || !musicBus) return
  if (loop) fadeOut(loop)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE)
  gain.connect(musicBus)
  const l: Loop = { area, gain, next: ctx.currentTime + 0.05, step: 0, timer: setInterval(() => tick(l), 25) }
  loop = l
}

function tick(l: Loop) {
  try {
    if (!ctx) return
    if (l.next < ctx.currentTime - 0.5) l.next = ctx.currentTime
    const track = TRACKS[l.area]
    const stepDur = 60 / track.bpm / 4
    const audible = !getSettings().muted && getSettings().music > 0
    while (l.next < ctx.currentTime + LOOKAHEAD) {
      if (audible) {
        const s = stepsAt(track, l.step)
        const boost = intensity && l.area === 'match' ? 1.15 : 1
        for (const n of s.notes) tone(ctx, l.gain, n.wave, midiToHz(n.midi), l.next, n.len * stepDur * 0.95, n.gain * boost)
        if (s.kick) drumHit(ctx, l.gain, 'kick', l.next)
        if (s.snare) drumHit(ctx, l.gain, 'snare', l.next)
        if (s.hat || (intensity && l.area === 'match' && l.step % 2 === 1)) drumHit(ctx, l.gain, 'hat', l.next)
      }
      l.next += stepDur
      l.step++
    }
  } catch { /* never let audio break the app */ }
}

/** Switch the music bed (crossfades). Remembers the request until audio is unlocked. */
export function playArea(area: MusicArea): void {
  wanted = area
  if (!ctx || loop?.area === area) return
  startLoop(area)
}

/** Match music only: 1 adds late-game energy (Q4/OT). */
export function setIntensity(level: 0 | 1): void { intensity = level }

export function stopMusic(): void {
  wanted = null
  if (loop) { fadeOut(loop); loop = null }
}

/** For SFX: the context and output bus, or null when audio is unavailable, muted or at volume 0. A repeat of `name` within 40 ms is dropped. */
export function sfxOut(name: string): { ctx: AudioContext; out: AudioNode } | null {
  if (!ctx || !sfxBus) return null
  const s = getSettings()
  if (s.muted || s.sfx <= 0) return null
  const now = ctx.currentTime
  const last = lastFired.get(name)
  if (last !== undefined && now - last < 0.04) return null
  lastFired.set(name, now)
  return { ctx, out: sfxBus }
}

export const __debug = {
  loops: () => (loop ? 1 : 0),
  area: () => loop?.area ?? null,
  reset() {
    if (loop) clearInterval(loop.timer)
    loop = null; wanted = null; ctx = null; musicBus = null; sfxBus = null; intensity = 0
    lastFired.clear()
  },
}
