import { describe, expect, it } from 'vitest'
import { pickJersey } from '../../src/engine/player/jerseyNumber'
import { Rng } from '../../src/engine/rng'

const draws = (n: number, taken?: Set<number>) => {
  const rng = Rng.fromSeed(42)
  return Array.from({ length: n }, () => pickJersey(rng, taken))
}

describe('pickJersey', () => {
  const d = draws(5000)
  it('mostly picks numbers up to 35', () => {
    expect(d.filter((n) => n <= 35).length / d.length).toBeGreaterThan(0.85)
  })
  it('1-10 are common', () => {
    expect(d.filter((n) => n >= 1 && n <= 10).length / d.length).toBeGreaterThan(0.4)
  })
  it('above 10 the last digit is usually 0-5', () => {
    const big = d.filter((n) => n > 10)
    expect(big.filter((n) => n % 10 <= 5).length / big.length).toBeGreaterThan(0.85)
  })
  it('still produces rare outliers', () => {
    expect(d.some((n) => n > 60)).toBe(true)
  })
  it('stays in range and never returns a taken number', () => {
    const taken = new Set(Array.from({ length: 36 }, (_, i) => i))
    const t = draws(2000, taken)
    expect(t.every((n) => n >= 0 && n <= 99 && !taken.has(n))).toBe(true)
  })
})
