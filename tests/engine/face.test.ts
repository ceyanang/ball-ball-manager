import { describe, expect, it } from 'vitest'
import { FACE_VARIANTS, ageFace, generateFace } from '../../src/engine/face/face'
import { Rng } from '../../src/engine/rng'

describe('faces', () => {
  it('generateFace is deterministic', () => {
    expect(generateFace(123)).toEqual(generateFace(123))
  })
  it('every field within FACE_VARIANTS bounds', () => {
    for (let s = 1; s <= 5000; s++) {
      const f = generateFace(s)
      for (const [k, n] of Object.entries(FACE_VARIANTS)) {
        const v = f[k as keyof typeof FACE_VARIANTS]
        expect(Number.isInteger(v) && v >= 0 && v < n).toBe(true)
      }
      expect(f.grey).toBe(0)
      expect(f.recede).toBe(0)
    }
  })
  it('meets variant minimums', () => {
    const min = { head: 5, skin: 10, ears: 3, eyes: 8, eyeColor: 5, brows: 6, nose: 8, mouth: 8, hair: 16, hairColor: 7, facialHair: 10, accessory: 10 }
    for (const [k, n] of Object.entries(min)) expect(FACE_VARIANTS[k as keyof typeof FACE_VARIANTS]).toBeGreaterThanOrEqual(n)
  })
  it('produces >= 2000 distinct faces in 5000 seeds', () => {
    const seen = new Set<string>()
    for (let s = 1; s <= 5000; s++) seen.add(JSON.stringify(generateFace(s)))
    expect(seen.size).toBeGreaterThanOrEqual(2000)
  })
  it('accessory ~30% and facial hair ~50%', () => {
    let acc = 0, fh = 0
    for (let s = 1; s <= 4000; s++) {
      const f = generateFace(s)
      if (f.accessory > 0) acc++
      if (f.facialHair > 0) fh++
    }
    expect(acc / 4000).toBeGreaterThan(0.22)
    expect(acc / 4000).toBeLessThan(0.38)
    expect(fh / 4000).toBeGreaterThan(0.4)
    expect(fh / 4000).toBeLessThan(0.6)
  })
  it('ageFace: grey 0 at 25 and non-decreasing 25→40', () => {
    for (let s = 1; s <= 300; s++) {
      const base = generateFace(s)
      expect(ageFace(base, s, 25).grey).toBe(0)
      let prevG = 0, prevR = 0
      for (let a = 25; a <= 40; a++) {
        const f = ageFace(base, s, a)
        expect(f.grey).toBeGreaterThanOrEqual(prevG)
        expect(f.recede).toBeGreaterThanOrEqual(prevR)
        expect(f.grey).toBeLessThanOrEqual(1)
        prevG = f.grey
        prevR = f.recede
      }
    }
  })
  it('some players never recede, some do by 40', () => {
    let never = 0
    for (let s = 1; s <= 400; s++) if (ageFace(generateFace(s), s, 40).recede === 0) never++
    expect(never / 400).toBeGreaterThan(0.35)
    expect(never / 400).toBeLessThan(0.65)
  })
  it('does not consume league rng', () => {
    const rng = Rng.fromSeed(1)
    const before = { ...rng.state }
    generateFace(55)
    ageFace(generateFace(55), 55, 35)
    expect(rng.state).toEqual(before)
  })
})
