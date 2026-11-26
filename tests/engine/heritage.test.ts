import { describe, expect, it } from 'vitest'
import { HERITAGES, HERITAGE_WEIGHTS, decodeHeritage, encodeHeritage, rollHeritage } from '../../src/engine/face/heritage'
import { Rng } from '../../src/engine/rng'

describe('heritage core', () => {
  it('round-trips every heritage over many seeds', () => {
    const rng = Rng.fromSeed(7)
    for (const h of HERITAGES) {
      for (let i = 0; i < 200; i++) expect(decodeHeritage(encodeHeritage(rng.int(1, 2 ** 31 - 1), h))).toBe(h)
    }
  })
  it('encoded seeds stay positive 31-bit ints', () => {
    for (const h of HERITAGES) for (const s of [0, 1, 7, 8, 2 ** 31 - 1, 12345]) {
      const e = encodeHeritage(s, h)
      expect(Number.isInteger(e) && e >= 8 && e <= 2 ** 31 - 1).toBe(true)
    }
  })
  it('decode is total', () => {
    for (const s of [0, -5, NaN, 2 ** 40, 5, 6, 7, Infinity]) expect(HERITAGES).toContain(decodeHeritage(s))
  })
  it('rollHeritage follows the weights', () => {
    const rng = Rng.fromSeed(1)
    const n = 20000
    const c: Record<string, number> = {}
    for (let i = 0; i < n; i++) { const h = rollHeritage(rng); c[h] = (c[h] ?? 0) + 1 }
    const total = HERITAGES.reduce((a, h) => a + HERITAGE_WEIGHTS[h], 0)
    for (const h of HERITAGES) expect(Math.abs((c[h] ?? 0) / n - HERITAGE_WEIGHTS[h] / total)).toBeLessThan(0.015)
    expect(HERITAGE_WEIGHTS.american).toBe(50)
  })
})
