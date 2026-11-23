import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { emptyEvents } from '../../src/engine/events/state'
import { migrateLeague } from '../../src/save/migrate'

describe('events state (League v8)', () => {
  it('a new league starts with events on "lots", nothing pending, chemistry 50 everywhere', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'x' })
    expect(l.version).toBe(8)
    expect(l.events.frequency).toBe('lots')
    expect(l.events.pending).toBeNull()
    const ids = Object.keys(l.teams)
    expect(ids).toHaveLength(30)
    for (const id of ids) expect(l.chemistry[id]).toBe(50)
  })

  it('migrates a v7 save to v8 with default events and chemistry', () => {
    const l = createLeague({ seed: 2, userTeamIndex: 3, name: 'old' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = { ...structuredClone(l), version: 7 }
    delete raw.events
    delete raw.chemistry
    const m = migrateLeague(raw)
    expect(m.version).toBe(8)
    expect(m.events).toEqual(emptyEvents())
    for (const id of Object.keys(l.teams)) expect(m.chemistry[id]).toBe(50)
  })
})
