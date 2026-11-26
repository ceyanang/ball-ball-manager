import { describe, expect, it } from 'vitest'
import { applyEffects } from '../../src/engine/events/effects'
import { committed, ovr } from '../../src/engine/gm/cap'
import { createLeague } from '../../src/engine/league/create'

const fresh = () => {
  const l = createLeague({ seed: 9, userTeamIndex: 2, name: 'fx' })
  const p = committed(l, l.userTeamId)[0]
  return { l, p }
}

describe('event effects', () => {
  it('morale clamps to 0–100 and reports the change', () => {
    const { l, p } = fresh()
    const lines = applyEffects(l, [{ kind: 'morale', target: { player: p.id }, delta: 500 }])
    expect(p.morale).toBe(100)
    expect(lines[0]).toContain(p.lastName)
    expect(lines[0]).toContain('+500')
    applyEffects(l, [{ kind: 'morale', target: { player: p.id }, delta: -500 }])
    expect(p.morale).toBe(0)
  })
  it('roster morale hits every user player', () => {
    const { l } = fresh()
    const before = committed(l, l.userTeamId).map((q) => q.morale)
    applyEffects(l, [{ kind: 'morale', target: 'roster', delta: -3 }])
    committed(l, l.userTeamId).forEach((q, i) => expect(q.morale).toBe(Math.max(0, before[i] - 3)))
  })
  it('fans clamp to ±100 for a player and for the team', () => {
    const { l, p } = fresh()
    applyEffects(l, [{ kind: 'fans', target: { player: p.id }, delta: 999 }, { kind: 'fans', target: 'team', delta: -999 }])
    expect(l.fans.players[p.id]).toBe(100)
    expect(l.fans.teams[l.userTeamId]).toBe(-100)
  })
  it('chemistry clamps to 0–100 on the user team only', () => {
    const { l } = fresh()
    const other = Object.keys(l.teams).find((t) => t !== l.userTeamId)!
    applyEffects(l, [{ kind: 'chemistry', delta: 99 }])
    expect(l.chemistry[l.userTeamId]).toBe(100)
    expect(l.chemistry[other]).toBe(50)
    applyEffects(l, [{ kind: 'chemistry', delta: -999 }])
    expect(l.chemistry[l.userTeamId]).toBe(0)
  })
  it('buff stores an active effect (null player = whole team)', () => {
    const { l, p } = fresh()
    applyEffects(l, [{ kind: 'buff', target: 'team', stat: 'shooting', amount: 3, games: 5 }, { kind: 'buff', target: { player: p.id }, stat: 'energy', amount: 10, games: 2 }])
    expect(l.events.active).toHaveLength(2)
    expect(l.events.active[0]).toMatchObject({ kind: 'shooting', playerId: null, amount: 3, gamesLeft: 5 })
    expect(l.events.active[1]).toMatchObject({ kind: 'energy', playerId: p.id, gamesLeft: 2 })
  })
  it('rest sits a player for one game', () => {
    const { l, p } = fresh()
    applyEffects(l, [{ kind: 'rest', player: p.id }])
    expect(l.events.active[0]).toMatchObject({ playerId: p.id, rest: true, gamesLeft: 1 })
  })
  it('train raises one rating, capped at 99, leaving the others alone', () => {
    const { l, p } = fresh()
    const before = { ...p.ratings }
    applyEffects(l, [{ kind: 'train', player: p.id, skill: 'threePointShot', delta: 2 }])
    expect(p.ratings.threePointShot).toBe(Math.min(99, before.threePointShot + 2))
    expect(p.ratings.midRangeShot).toBe(before.midRangeShot)
    p.ratings.threePointShot = 98
    applyEffects(l, [{ kind: 'train', player: p.id, skill: 'threePointShot', delta: 5 }])
    expect(p.ratings.threePointShot).toBe(99)
  })
  it('ovrNudge raises OVR by at least 1 touching at most 5 ratings', () => {
    const { l } = fresh()
    const p = committed(l, l.userTeamId).find((q) => ovr(q) < 92)!
    const before = ovr(p), r0 = { ...p.ratings }
    applyEffects(l, [{ kind: 'ovrNudge', player: p.id, delta: 1 }])
    expect(ovr(p)).toBeGreaterThanOrEqual(before + 1)
    expect(Object.keys(r0).filter((k) => p.ratings[k as keyof typeof r0] !== r0[k as keyof typeof r0]).length).toBeLessThanOrEqual(5)
  })
  it('inbox effect adds an inbox item', () => {
    const { l } = fresh()
    const n = l.inbox.length
    applyEffects(l, [{ kind: 'inbox', title: 'Hi', body: 'There' }])
    expect(l.inbox.length).toBe(n + 1)
  })
})
