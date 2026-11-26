import { describe, expect, it } from 'vitest'
import { FIRST_NAMES, LAST_NAMES, NAME_POOLS, heritageOfName, pickName } from '../../src/engine/data/names'
import { HERITAGES } from '../../src/engine/face/heritage'
import { Rng } from '../../src/engine/rng'

describe('tagged name pools', () => {
  it('pools are big enough', () => {
    for (const h of HERITAGES) {
      const min = h === 'american' ? 200 : 40
      expect(NAME_POOLS[h].first.length).toBeGreaterThanOrEqual(min)
      expect(NAME_POOLS[h].last.length).toBeGreaterThanOrEqual(min)
    }
  })
  it('no name sits in two buckets and unions have no duplicates', () => {
    for (const kind of ['first', 'last'] as const) {
      const all = HERITAGES.flatMap((h) => NAME_POOLS[h][kind])
      expect(new Set(all).size).toBe(all.length)
    }
    expect(new Set(FIRST_NAMES).size).toBe(FIRST_NAMES.length)
    expect(new Set(LAST_NAMES).size).toBe(LAST_NAMES.length)
  })
  it('heritageOfName', () => {
    expect(heritageOfName('Hiro', 'Tanaka')).toBe('asian')
    expect(heritageOfName('Kofi', 'Williams')).toBe('african')
    expect(heritageOfName('Jamal', 'Kim')).toBe('asian')
    expect(heritageOfName('Diego', 'Cruz')).toBe('latino')
    expect(heritageOfName('Zzz', 'Qqq')).toBe('american')
  })
  it('pickName never returns empty parts and mixes ~12%', () => {
    const rng = Rng.fromSeed(3)
    for (const h of HERITAGES) {
      let mixed = 0
      const n = 10000
      for (let i = 0; i < n; i++) {
        const { firstName, lastName } = pickName(rng, h)
        expect(firstName && lastName).toBeTruthy()
        if (!NAME_POOLS[h].first.includes(firstName) || !NAME_POOLS[h].last.includes(lastName)) mixed++
      }
      expect(Math.abs(mixed / n - 0.12)).toBeLessThan(0.02)
    }
  })
})
