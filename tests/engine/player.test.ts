import { describe, expect, it } from 'vitest'
import { Rng } from '../../src/engine/rng'
import { generatePlayer } from '../../src/engine/player/generate'
import { computeOvr } from '../../src/engine/player/ratings'
import { salaryForPlayer } from '../../src/engine/contracts'
import { MAX_SALARY, MIN_SALARY } from '../../src/engine/constants'
import type { Player } from '../../src/engine/types'

const ovr = (p: Player) => computeOvr(p.ratings, p.pos)

describe('generatePlayer', () => {
  it('is deterministic for a seed', () => {
    expect(generatePlayer(Rng.fromSeed(7), { season: 1 })).toEqual(generatePlayer(Rng.fromSeed(7), { season: 1 }))
  })
  it('ratings are ints 1..99 and pot >= ovr', () => {
    const rng = Rng.fromSeed(11)
    for (let i = 0; i < 500; i++) {
      const p = generatePlayer(rng, { season: 1 })
      for (const v of Object.values(p.ratings)) {
        expect(Number.isInteger(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(99)
      }
      expect(p.pot).toBeGreaterThanOrEqual(ovr(p))
      expect(p.pot).toBeLessThanOrEqual(99)
      expect(p.ratingHistory).toEqual([{ season: 1, ovr: ovr(p) }])
      expect(p.teamId).toBeNull()
      expect(p.contract).toBeNull()
    }
  })
  it('honours targetOvr', () => {
    const rng = Rng.fromSeed(12)
    for (const target of [45, 65, 85]) {
      for (let i = 0; i < 40; i++) {
        const p = generatePlayer(rng, { season: 1, targetOvr: target })
        expect(Math.abs(ovr(p) - target)).toBeLessThanOrEqual(2)
      }
    }
  })
  it('default distribution has a ~70 median and some stars', () => {
    const rng = Rng.fromSeed(13)
    const ovrs = Array.from({ length: 2000 }, () => ovr(generatePlayer(rng, { season: 1 }))).sort((a, b) => a - b)
    const stars = ovrs.filter((o) => o >= 85).length / ovrs.length
    expect(stars).toBeGreaterThanOrEqual(0.01)
    expect(stars).toBeLessThanOrEqual(0.08)
    expect(ovrs[1000]).toBeGreaterThanOrEqual(68)
    expect(ovrs[1000]).toBeLessThanOrEqual(72)
  })
  it('keeps every rating within 40..99, even for low targets', () => {
    const rng = Rng.fromSeed(21)
    for (let i = 0; i < 2000; i++) {
      const p = generatePlayer(rng, { season: 1, targetOvr: i % 4 === 0 ? 45 : undefined })
      for (const v of Object.values(p.ratings)) {
        expect(v).toBeGreaterThanOrEqual(40)
        expect(v).toBeLessThanOrEqual(99)
      }
    }
  })
  it('centers outrebound point guards', () => {
    const rng = Rng.fromSeed(14)
    const mean = (pos: 'C' | 'PG') => {
      let s = 0
      for (let i = 0; i < 300; i++) s += generatePlayer(rng, { season: 1, pos }).ratings.dreb
      return s / 300
    }
    expect(mean('C') - mean('PG')).toBeGreaterThanOrEqual(15)
  })
  it('respects given age', () => {
    expect(generatePlayer(Rng.fromSeed(2), { season: 1, age: 33 }).age).toBe(33)
  })
})

describe('salaryForPlayer', () => {
  const at = (target: number, age = 27) => {
    const rng = Rng.fromSeed(target)
    // regenerate until exact OVR to keep test exact
    for (;;) {
      const p = generatePlayer(rng, { season: 1, targetOvr: target, age })
      if (ovr(p) === target) return salaryForPlayer(p)
    }
  }
  it('maps low OVR to min and elite to max', () => {
    expect(at(60)).toBe(MIN_SALARY)
    expect(at(92)).toBe(MAX_SALARY)
  })
  it('is monotone in OVR at age 27', () => {
    let prev = 0
    for (let o = 40; o <= 95; o++) {
      const s = at(o)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })
  it('discounts old players', () => {
    expect(at(80, 35)).toBeLessThan(at(80, 27))
  })
})
