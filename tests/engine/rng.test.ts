import { describe, expect, it } from 'vitest'
import { Rng } from '../../src/engine/rng'

describe('Rng', () => {
  it('same seed → same sequence', () => {
    const a = Rng.fromSeed(42), b = Rng.fromSeed(42)
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })
  it('state round-trips', () => {
    const rng = Rng.fromSeed(9)
    for (let i = 0; i < 10; i++) rng.next()
    const copy = new Rng({ ...rng.state })
    for (let i = 0; i < 50; i++) expect(copy.next()).toBe(rng.next())
  })
  it('int is inclusive and in range', () => {
    const rng = Rng.fromSeed(1)
    const seen = new Set<number>()
    for (let i = 0; i < 10000; i++) {
      const v = rng.int(1, 6)
      expect(v >= 1 && v <= 6 && Number.isInteger(v)).toBe(true)
      seen.add(v)
    }
    expect(seen.has(1) && seen.has(6)).toBe(true)
  })
  it('weighted respects weights', () => {
    const rng = Rng.fromSeed(3)
    let second = 0
    for (let i = 0; i < 10000; i++) if (rng.weighted(['a', 'b'], (x) => (x === 'a' ? 1 : 9)) === 'b') second++
    expect(second / 10000).toBeGreaterThan(0.85)
    expect(second / 10000).toBeLessThan(0.95)
  })
  it('normal mean/sd', () => {
    const rng = Rng.fromSeed(5)
    const xs = Array.from({ length: 20000 }, () => rng.normal(50, 10))
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
    expect(Math.abs(mean - 50)).toBeLessThan(0.5)
    expect(Math.abs(sd - 10)).toBeLessThan(0.5)
  })
  it('shuffle keeps elements and id has prefix', () => {
    const rng = Rng.fromSeed(8)
    expect(rng.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5])
    expect(rng.id('p_')).toMatch(/^p_[0-9a-z]{8}$/)
  })
})
