import { describe, expect, it } from 'vitest'
import { committed } from '../../src/engine/gm/cap'
import { emergencyRebuild, REBUILD_SELL_AGE, REBUILD_YOUTH_AGE, rebuildProblem } from '../../src/engine/gm/rebuild'
import { applyAutoMoves, planAuto } from '../../src/engine/gm/autosign'
import { advanceOffseason, seasonStartProblem } from '../../src/engine/gm/offseason'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simUntil } from '../../src/engine/season/advance'
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

describe('emergency rebuild over a real offseason', () => {
  it('traded picks become draft slots, and rebuild-mode auto-sign signs the rookies and fills a legal roster', { timeout: 120_000 }, () => {
    const l = simUntil(createLeague({ seed: 21, userTeamIndex: 3, name: 'GM' }), 'playoffsEnd')
    const me = l.userTeamId
    const deals = emergencyRebuild(l)
    const gotPicks = deals.flatMap((d) => d.got).filter((a) => a.kind === 'pick').map((a) => l.picks.find((p) => p.id === a.id)!)
    expect(gotPicks.length).toBeGreaterThan(0)
    // Every pick this draft that we own is one of our draft slots.
    const thisYear = l.picks.filter((p) => p.ownerId === me && p.season === l.draft!.season).map((p) => p.id).sort()
    expect(l.draft!.order.filter((s) => s.teamId === me).map((s) => s.pickId).sort()).toEqual(thisYear)
    const rng = new Rng(l.rng)
    while (l.offseason!.step !== 'resign') advanceOffseason(l, rng)
    const rights = Object.values(l.draftRights).filter((t) => t === me).length
    expect(rights).toBe(thisYear.length)
    // Re-sign step: rookies get signed, no vet 26+ kept unless a position would be empty.
    const plan = planAuto(l)
    expect(plan.filter((m) => m.kind === 'rights').length).toBeGreaterThan(0)
    for (const m of plan.filter((x) => x.kind === 'resign')) if (l.players[m.playerId].age >= REBUILD_SELL_AGE) expect(m.reason).toMatch(/red/)
    applyAutoMoves(l, rng, plan)
    advanceOffseason(l, rng) // → free agency
    const fa = planAuto(l)
    for (const m of fa.filter((x) => x.kind === 'sign')) if (l.players[m.playerId].age > 25) expect(m.years).toBe(1)
    applyAutoMoves(l, rng, fa)
    while ((l.offseason!.step as string) === 'freeAgency') advanceOffseason(l, rng)
    applyAutoMoves(l, rng, planAuto(l)) // top up anyone who said no
    expect(seasonStartProblem(l)).toBeNull()
    advanceOffseason(l, rng)
    expect(l.phase).toBe('regular')
    // Future picks we got are still ours in the new season.
    for (const p of gotPicks.filter((p) => p.season >= l.season)) expect(l.picks.find((q) => q.id === p.id)!.ownerId).toBe(me)
  })
})
