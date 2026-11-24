import { describe, expect, it } from 'vitest'
import { committed } from '../../src/engine/gm/cap'
import { emergencyRebuild, REBUILD_SELL_AGE, REBUILD_YOUTH_AGE, rebuildProblem } from '../../src/engine/gm/rebuild'
import { createLeague } from '../../src/engine/league/create'
import type { League } from '../../src/engine/types'

const offseason = (): League => {
  const l = createLeague({ seed: 21, userTeamIndex: 3, name: 'GM' })
  l.phase = 'offseason'
  l.offseason = { step: 'awards', faDay: 0, report: { retired: [], changes: [], coaching: [] }, resignTries: {} }
  return l
}

describe('emergency rebuild', () => {
  it('is offseason-only and once per offseason', () => {
    const l = createLeague({ seed: 21, userTeamIndex: 3, name: 'GM' })
    expect(rebuildProblem(l)).toMatch(/offseason/)
    const o = offseason()
    expect(rebuildProblem(o)).toBeNull()
    emergencyRebuild(o)
    expect(rebuildProblem(o)).toMatch(/already/)
    expect(() => emergencyRebuild(o)).toThrow()
  })

  it('sells vets for youngsters and picks, and gets younger', () => {
    const l = offseason()
    const me = l.userTeamId
    const avgAge = () => { const r = committed(l, me); return r.reduce((t, p) => t + p.age, 0) / r.length }
    const before = avgAge()
    const deals = emergencyRebuild(l)
    expect(deals.length).toBeGreaterThan(0)
    for (const d of deals) {
      expect(d.teamId).not.toBe(me)
      for (const a of d.gave) {
        expect(a.kind).toBe('player')
        expect(l.players[a.id].teamId).toBe(d.teamId)
        expect(l.players[a.id].age).toBeGreaterThanOrEqual(REBUILD_SELL_AGE)
      }
      for (const a of d.got) {
        if (a.kind === 'pick') expect(l.picks.find((p) => p.id === a.id)!.ownerId).toBe(me)
        else { expect(l.players[a.id].teamId).toBe(me); expect(l.players[a.id].age).toBeLessThanOrEqual(REBUILD_YOUTH_AGE) }
      }
    }
    expect(avgAge()).toBeLessThan(before)
  })

  it('is deterministic', () => {
    const a = offseason(), b = offseason()
    expect(emergencyRebuild(a)).toEqual(emergencyRebuild(b))
  })
})
