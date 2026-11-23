import type { MusicArea } from './area'

/** One monophonic line. `steps` has one entry per 16th step: a MIDI note starts a note, null is a rest. */
export interface Voice { wave: OscillatorType; gain: number; /** Note length in steps (default 1). */ len?: number; steps: (number | null)[] }
export interface Track {
  bpm: number
  /** Loop length in 16th steps. */
  steps: number
  voices: Voice[]
  drums: { kick: boolean[]; snare: boolean[]; hat: boolean[] }
}
export interface StepNote { wave: OscillatorType; gain: number; midi: number; len: number }

export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12)

const N = 64
/** A line of `N` steps with notes placed at the given step→note entries. */
const line = (entries: Record<number, number>): (number | null)[] => Array.from({ length: N }, (_, i) => entries[i] ?? null)
/** Repeat a `period`-step motif across the loop; `motif` maps step-in-period → note. */
const loop = (period: number, motif: Record<number, number>): (number | null)[] =>
  Array.from({ length: N }, (_, i) => motif[i % period] ?? null)
const hits = (period: number, at: number[]): boolean[] => Array.from({ length: N }, (_, i) => at.includes(i % period))
/** One chord per bar (16 steps): notes[bar]. */
const bars = (notes: number[]): (number | null)[] => line(Object.fromEntries(notes.map((n, b) => [b * 16, n])))

// Menu: laid back, C major · Am · F · G, sine/triangle.
const menu: Track = {
  bpm: 92, steps: N,
  voices: [
    { wave: 'sine', gain: 0.2, len: 14, steps: bars([48, 45, 41, 43]) },
    { wave: 'triangle', gain: 0.07, len: 14, steps: bars([64, 60, 65, 62]) },
    { wave: 'triangle', gain: 0.06, len: 14, steps: bars([71, 67, 69, 67]) },
    { wave: 'triangle', gain: 0.1, len: 3, steps: line({ 0: 76, 6: 74, 8: 72, 16: 72, 22: 69, 24: 72, 32: 69, 38: 72, 40: 74, 48: 71, 52: 74, 56: 79 }) },
  ],
  drums: { kick: hits(32, [0, 20]), snare: hits(32, [16]), hat: hits(16, [4, 12]) },
}

// Front office: tense minor groove, Am · F · C · G, plucky square arpeggios over a pulsing bass.
const office: Track = {
  bpm: 104, steps: N,
  voices: [
    { wave: 'sawtooth', gain: 0.1, len: 2, steps: line(Object.fromEntries([0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30, 32, 35, 38, 40, 43, 46, 48, 51, 54, 56, 59, 62].map((s) => [s, [45, 41, 48, 43][Math.floor(s / 16)]]))) },
    { wave: 'square', gain: 0.05, len: 2, steps: loop(16, { 2: 69, 5: 72, 8: 76, 10: 72, 13: 69 }) },
    { wave: 'triangle', gain: 0.08, len: 6, steps: line({ 0: 72, 16: 69, 32: 76, 48: 74 }) },
  ],
  drums: { kick: hits(16, [0, 6, 10]), snare: hits(16, [4, 12]), hat: hits(16, [2, 6, 10, 14]) },
}

// Match: driving, E minor · C · D · B, 16th arps over a four-on-the-floor kick.
const match: Track = {
  bpm: 128, steps: N,
  voices: [
    { wave: 'sawtooth', gain: 0.11, len: 2, steps: line(Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i * 2, [40, 36, 38, 35][Math.floor(i / 8)]]))) },
    { wave: 'square', gain: 0.05, len: 1, steps: Array.from({ length: N }, (_, i) => [64, 67, 71, 67][i % 4] + [0, -4, -2, -5][Math.floor(i / 16)]) },
    { wave: 'square', gain: 0.07, len: 4, steps: line({ 0: 83, 8: 79, 16: 76, 24: 79, 32: 78, 40: 81, 48: 83, 56: 86 }) },
  ],
  drums: { kick: hits(4, [0]), snare: hits(8, [4]), hat: hits(4, [2]) },
}

export const TRACKS: Record<MusicArea, Track> = { menu, office, match }

/** Everything that starts on a given step; `step` wraps around the loop. */
export function stepsAt(track: Track, step: number): { notes: StepNote[]; kick: boolean; snare: boolean; hat: boolean } {
  const i = ((step % track.steps) + track.steps) % track.steps
  const notes: StepNote[] = []
  for (const v of track.voices) {
    const midi = v.steps[i]
    if (midi !== null) notes.push({ wave: v.wave, gain: v.gain, midi, len: v.len ?? 1 })
  }
  return { notes, kick: track.drums.kick[i], snare: track.drums.snare[i], hat: track.drums.hat[i] }
}
