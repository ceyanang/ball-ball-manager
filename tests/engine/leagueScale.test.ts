import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { computeOvr } from '../../src/engine/player/ratings'

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1)
const rostered = (seed: number) =>
  Object.values(createLeague({ seed, userTeamIndex: 0, name: 'T' }).players)
    .filter((p) => p.teamId)
    .map((p) => computeOvr(p.ratings, p.pos))

describe('new-league talent scale', () => {
  it('makes 80+ rare (at most 12% of rostered players)', () => {
    for (const s of SEEDS) {
      const o = rostered(s)
      expect(o.filter((v) => v >= 80).length / o.length).toBeLessThanOrEqual(0.12)
    }
  })

  it('keeps the top end: 8-14 players at 89+ and at least one at 94+', () => {
    for (const s of SEEDS) {
      const o = rostered(s)
      const n = o.filter((v) => v >= 89).length
      expect(n).toBeGreaterThanOrEqual(8)
      expect(n).toBeLessThanOrEqual(14)
      expect(Math.max(...o)).toBeGreaterThanOrEqual(94)
    }
  })

  it('keeps 70 as a solid rotation player: at least 40% of the league is 70+', () => {
    for (const s of SEEDS) {
      const o = rostered(s)
      expect(o.filter((v) => v >= 70).length / o.length).toBeGreaterThanOrEqual(0.4)
    }
  })

  it('keeps every ceiling at or above current OVR after the franchise-quality shift', () => {
    for (const s of SEEDS) {
      const l = createLeague({ seed: s, userTeamIndex: 0, name: 'T' })
      for (const p of Object.values(l.players)) expect(p.pot).toBeGreaterThanOrEqual(computeOvr(p.ratings, p.pos))
    }
  })
})
