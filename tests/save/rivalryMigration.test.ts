import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { CURRENT_VERSION, migrateLeague } from '../../src/save/migrate'

const mk = () => JSON.parse(JSON.stringify(createLeague({ seed: 12, userTeamIndex: 3, name: 'T' })))

describe('v12 → v13 rivalry migration', () => {
  it('adds an empty rivalry state', () => {
    const raw = mk()
    raw.version = 12
    delete raw.rivalry
    const m = migrateLeague(raw)
    expect(m.version).toBe(CURRENT_VERSION)
    expect(CURRENT_VERSION).toBe(16)
    expect(m.rivalry).toEqual({ heat: {}, dynamic: {}, showing: {}, met: [] })
  })
  it('tolerates a v13 save with partial rivalry keys', () => {
    const raw = mk()
    raw.rivalry = { heat: { 'a|b': 5 } }
    const m = migrateLeague(raw)
    expect(m.rivalry).toEqual({ heat: { 'a|b': 5 }, dynamic: {}, showing: {}, met: [] })
  })
  it('new leagues start with empty rivalry', () => {
    expect(createLeague({ seed: 1, userTeamIndex: 0, name: 'N' }).rivalry).toEqual({ heat: {}, dynamic: {}, showing: {}, met: [] })
  })
})
