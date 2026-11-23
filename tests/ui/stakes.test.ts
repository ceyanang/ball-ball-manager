import { describe, expect, it } from 'vitest'
import { seriesStake } from '../../src/ui/playoffs/stakes'
import type { Series } from '../../src/engine/types'

const s = (highWins: number, lowWins: number, bestOf: 5 | 7 = 7): Series => ({ id: 'x_r1_0', round: 1, conf: 'East', highSeedId: 'a', lowSeedId: 'b', highSeed: 1, lowSeed: 8, highWins, lowWins, bestOf, winnerId: null })

describe('seriesStake', () => {
  it('flags a sweep watch', () => {
    expect(seriesStake(s(3, 0))).toBe('sweep')
    expect(seriesStake(s(0, 3))).toBe('sweep')
    expect(seriesStake(s(2, 0, 5))).toBe('sweep')
  })
  it('flags elimination games', () => {
    expect(seriesStake(s(3, 2))).toBe('elimination')
    expect(seriesStake(s(1, 3))).toBe('elimination')
  })
  it('flags winner-takes-all', () => {
    expect(seriesStake(s(3, 3))).toBe('decider')
    expect(seriesStake(s(2, 2, 5))).toBe('decider')
  })
  it('is null otherwise', () => {
    expect(seriesStake(s(2, 2))).toBeNull()
    expect(seriesStake(s(0, 0))).toBeNull()
    expect(seriesStake(s(1, 1, 5))).toBeNull()
  })
})
