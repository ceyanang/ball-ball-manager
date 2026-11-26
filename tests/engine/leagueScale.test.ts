import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { computeOvr } from '../../src/engine/player/ratings'

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1)
const rostered = (seed: number) =>
  Object.values(createLeague({ seed, userTeamIndex: 0, name: 'T' }).players)
    .filter((p) => p.teamId)
    .map((p) => computeOvr(p.ratings, p.pos))

describe('new-league talent scale', () => {
  it('follows the 2K curve: roughly top 100 players at 80+ (~20-30% of rostered players)', () => {
    for (const s of SEEDS) {
      const o = rostered(s)
      const n80 = o.filter((v) => v >= 80).length
      expect(n80).toBeGreaterThanOrEqual(85)
      expect(n80).toBeLessThanOrEqual(125)
    }
  })

  it('keeps the top end: roughly top 24 players at 90+ (19-30) and at least one at 95+', () => {
    for (const s of SEEDS) {
      const o = rostered(s)
      const n = o.filter((v) => v >= 90).length
      expect(n).toBeGreaterThanOrEqual(19)
      expect(n).toBeLessThanOrEqual(30)
      expect(Math.max(...o)).toBeGreaterThanOrEqual(95)
    }
  })

  it('keeps 70+ as the main rotation baseline: at least 65% of the league is 70+', () => {
    for (const s of SEEDS) {
      const o = rostered(s)
      expect(o.filter((v) => v >= 70).length / o.length).toBeGreaterThanOrEqual(0.65)
    }
  })

  it('keeps every ceiling at or above current OVR after the franchise-quality shift', () => {
    for (const s of SEEDS) {
      const l = createLeague({ seed: s, userTeamIndex: 0, name: 'T' })
      for (const p of Object.values(l.players)) expect(p.pot).toBeGreaterThanOrEqual(computeOvr(p.ratings, p.pos))
    }
  })
})
