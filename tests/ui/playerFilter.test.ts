import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { filterPlayers } from '../../src/ui/playerFilter'
import { fullName, ovrOf } from '../../src/ui/util'

const league = createLeague({ seed: 7, userTeamIndex: 0, name: 'F' })
const all = Object.values(league.players)

describe('filterPlayers', () => {
  it('returns only rostered players, best OVR first', () => {
    const out = filterPlayers(all, {})
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((p) => p.teamId && !p.retired)).toBe(true)
    for (let i = 1; i < out.length; i++) expect(ovrOf(out[i - 1])).toBeGreaterThanOrEqual(ovrOf(out[i]))
  })
  it('filters by team and position together', () => {
    const team = league.userTeamId
    const out = filterPlayers(all, { team, pos: 'C' })
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((p) => p.teamId === team && p.pos === 'C')).toBe(true)
    expect(filterPlayers(all, { team: 'All', pos: 'All' }).length).toBe(filterPlayers(all, {}).length)
  })
  it('searches names case-insensitively', () => {
    const target = filterPlayers(all, {})[5]
    const out = filterPlayers(all, { q: `  ${target.lastName.toUpperCase()} ` })
    expect(out).toContain(target)
    expect(out.every((p) => fullName(p).toLowerCase().includes(target.lastName.toLowerCase()))).toBe(true)
  })
})
