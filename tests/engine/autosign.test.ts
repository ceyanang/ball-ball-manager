import { describe, expect, it } from 'vitest'
import { ROSTER_MIN, SALARY_CAP } from '../../src/engine/constants'
import { applyAutoMoves, planAuto } from '../../src/engine/gm/autosign'
import { committed, payroll, releasePlayerNow } from './helpers'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'

const fresh = () => createLeague({ seed: 33, userTeamIndex: 2, name: 'A' })
// Strip the user's roster down to `keep` players by turning the rest into free agents.
const shrink = (l: ReturnType<typeof fresh>, keep: number) => {
  committed(l, l.userTeamId).slice(keep).forEach((p) => releasePlayerNow(l, p.id))
}

describe('planAuto', () => {
  it('does not mutate the league', () => {
    const l = fresh()
    shrink(l, 6)
    const snap = JSON.stringify(l)
    planAuto(l)
    expect(JSON.stringify(l)).toBe(snap)
  })
  it('fills a short roster to at least 10 under the cap', () => {
    const l = fresh()
    shrink(l, 5)
    const moves = planAuto(l)
    expect(committed(l, l.userTeamId).length + moves.length).toBeGreaterThanOrEqual(ROSTER_MIN)
    expect(payroll(l, l.userTeamId) + moves.reduce((t, m) => t + m.salary, 0)).toBeLessThanOrEqual(SALARY_CAP)
  })
  it('applying the plan signs those players', () => {
    const l = fresh()
    shrink(l, 5)
    const moves = planAuto(l)
    applyAutoMoves(l, new Rng(l.rng), moves)
    expect(committed(l, l.userTeamId).length).toBeGreaterThanOrEqual(ROSTER_MIN)
  })
  it('never proposes the same player twice', () => {
    const l = fresh()
    shrink(l, 3)
    const ids = planAuto(l).map((m) => m.playerId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
