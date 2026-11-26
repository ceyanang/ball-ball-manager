import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { heritageOfName } from '../../src/engine/data/names'
import { decodeHeritage } from '../../src/engine/face/heritage'
import { CURRENT_VERSION, migrateLeague } from '../../src/save/migrate'

const mk = () => {
  const l = createLeague({ seed: 12, userTeamIndex: 3, name: 'T' })
  return JSON.parse(JSON.stringify(l))
}

describe('v11 → v12 heritage migration', () => {
  it('re-tags every player and coach from their name, keeping high bits', () => {
    const raw = mk()
    raw.version = 11
    const before: Record<string, number> = {}
    let i = 1
    for (const p of Object.values<any>(raw.players)) { p.faceSeed = 1000 * i++ + 3; before[p.id] = p.faceSeed }
    for (const c of Object.values<any>(raw.coaches)) { c.faceSeed = 1000 * i++ + 5; before[c.id] = c.faceSeed }
    const m = migrateLeague(raw)
    expect(m.version).toBe(CURRENT_VERSION)
    for (const p of Object.values(m.players)) {
      expect(decodeHeritage(p.faceSeed)).toBe(heritageOfName(p.firstName, p.lastName))
      expect(p.faceSeed >> 3).toBe(before[p.id] >> 3)
    }
    for (const c of Object.values(m.coaches)) expect(decodeHeritage(c.faceSeed)).toBe(heritageOfName(c.firstName, c.lastName))
  })
  it('is idempotent, handles odd names, and chains from older versions', () => {
    const raw = mk()
    raw.version = 11
    const first = Object.values<any>(raw.players)[0]
    first.firstName = 'Zzz'; first.lastName = 'Qqq'
    const once = migrateLeague(JSON.parse(JSON.stringify(raw)))
    expect(decodeHeritage(once.players[first.id].faceSeed)).toBe('american')
    const twice = migrateLeague(JSON.parse(JSON.stringify(once)))
    expect(twice).toEqual(once)
    const old = mk()
    old.version = 9
    delete old.retiredJerseys
    expect(migrateLeague(old).version).toBe(CURRENT_VERSION)
  })
  it('tolerates saves with missing coaches or malformed entries', () => {
    const raw = mk()
    raw.version = 11
    delete raw.coaches
    raw.players['bad'] = null
    expect(() => migrateLeague(raw)).not.toThrow()
  })
})
