import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { CURRENT_VERSION, migrateLeague } from '../../src/save/migrate'

const mk = () => JSON.parse(JSON.stringify(createLeague({ seed: 13, userTeamIndex: 2, name: 'T' })))

describe('v13 → v15 career migration', () => {
  it('adds career: null and changes nothing else', () => {
    const raw = mk()
    raw.version = 13
    delete raw.career
    const before = JSON.parse(JSON.stringify(raw))
    const m = migrateLeague(raw)
    expect(CURRENT_VERSION).toBe(15)
    expect(m.version).toBe(15)
    expect(m.career).toBeNull()
    const { version: _v, career: _c, ...rest } = m as unknown as Record<string, unknown>
    const { version: _bv, ...bRest } = before
    void _v; void _c; void _bv
    expect(rest).toEqual(bRest)
  })
  it('keeps an existing career block', () => {
    const raw = mk()
    raw.career = { playerId: 'x', status: 'active' }
    expect(migrateLeague(raw).career).toEqual({ playerId: 'x', status: 'active' })
  })
  it('new leagues have career null', () => {
    expect(createLeague({ seed: 1, userTeamIndex: 0, name: 'N' }).career).toBeNull()
  })
})

describe('v14 → v15 intangibles migration', () => {
  it('sets the followed player intangibles and max to 99', () => {
    const raw = mk()
    const id = Object.keys(raw.players)[0]
    raw.version = 14
    raw.career = { playerId: id, status: 'active' }
    const p = raw.players[id]
    p.ratings.intangibles = 50
    p.careerBuild = { max: { ...p.ratings, intangibles: 60 }, startFraction: 0.67, startProgress: 0, floor: 40, archetype: 'x' }
    const m = migrateLeague(raw)
    expect(m.version).toBe(15)
    expect(m.players[id].ratings.intangibles).toBe(99)
    expect(m.players[id].careerBuild!.max.intangibles).toBe(99)
  })
})
