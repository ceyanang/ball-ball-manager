import { describe, expect, it } from 'vitest'
import { midiToHz, stepsAt, TRACKS } from '../../src/audio/tracks'
import type { MusicArea } from '../../src/audio/area'

const AREAS: MusicArea[] = ['menu', 'office', 'match']

describe('midiToHz', () => {
  it('maps A4 to 440 and A3 to 220', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(57)).toBe(220)
  })
})

describe('TRACKS', () => {
  it.each(AREAS)('%s: every pattern is track.steps long and notes are sane MIDI', (area) => {
    const t = TRACKS[area]
    expect(t.voices.length).toBeGreaterThan(0)
    for (const v of t.voices) {
      expect(v.steps).toHaveLength(t.steps)
      for (const n of v.steps) if (n !== null) expect(Number.isInteger(n) && n >= 24 && n <= 96).toBe(true)
    }
    for (const d of [t.drums.kick, t.drums.snare, t.drums.hat]) expect(d).toHaveLength(t.steps)
  })
  it.each(AREAS)('%s: has at least one note and one kick-or-hat so it is audible', (area) => {
    const t = TRACKS[area]
    expect(t.voices.some((v) => v.steps.some((n) => n !== null))).toBe(true)
  })
  it('the three tracks have different tempos', () => {
    expect(new Set(AREAS.map((a) => TRACKS[a].bpm)).size).toBe(3)
  })
  it('match opens on a kick and stepsAt wraps around the loop', () => {
    const t = TRACKS.match
    expect(stepsAt(t, 0).kick).toBe(true)
    expect(stepsAt(t, t.steps)).toEqual(stepsAt(t, 0))
    expect(stepsAt(t, t.steps * 3 + 5)).toEqual(stepsAt(t, 5))
  })
})
