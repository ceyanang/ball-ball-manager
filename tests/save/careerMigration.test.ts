import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { CURRENT_VERSION, migrateLeague } from '../../src/save/migrate'

const mk = () => JSON.parse(JSON.stringify(createLeague({ seed: 13, userTeamIndex: 2, name: 'T' })))

describe('v13 → v14 career migration', () => {
  it('adds career: null and changes nothing else', () => {
    const raw = mk()
    raw.version = 13
    delete raw.career
    const before = JSON.parse(JSON.stringify(raw))
    const m = migrateLeague(raw)
    expect(CURRENT_VERSION).toBe(14)
    expect(m.version).toBe(14)
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
