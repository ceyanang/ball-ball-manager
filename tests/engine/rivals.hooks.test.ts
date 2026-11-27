import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { pairKey, startingRivals } from '../../src/engine/rivals/rivalry'
import { simGame } from '../../src/engine/sim/game'
import { Rng } from '../../src/engine/rng'
import { simUntil } from '../../src/engine/season/advance'
import { afterGame, onNewSeason } from '../../src/engine/stories/hooks'

const start = createLeague({ seed: 404, userTeamIndex: 3, name: 'Rivals' })
const done = simUntil(simUntil(start, 'regularEnd'), 'playoffsEnd')

describe('rivalry hooks', () => {
  it('a decided Finals heats the pair; new season cools it and clears met', () => {
    const f = done.playoffs!.series.find((s) => s.round === 4)!
    const k = pairKey(f.highSeedId, f.lowSeedId)
    expect(done.rivalry.heat[k]).toBeGreaterThanOrEqual(40)
    expect(done.rivalry.met).toContain(k)
    const before = done.rivalry.heat[k]
    const l = structuredClone(done)
    onNewSeason(l)
    expect(l.rivalry.heat[k]).toBeCloseTo(before * 0.7)
    expect(l.rivalry.met).toEqual([])
  })
  it('a brand-new dynamic rival for the user team makes news', () => {
    const l = structuredClone(start)
    const me = l.userTeamId
    const other = Object.keys(l.teams).find((id) => id !== me && !startingRivals(me).includes(id) && !startingRivals(id).includes(me))!
    l.rivalry.heat[pairKey(me, other)] = 80
    const n = l.news.length
    onNewSeason(l)
    expect(l.rivalry.dynamic[me]).toContain(other)
    const item = l.news.slice(n).find((x) => x.teamIds.includes(me) && x.teamIds.includes(other) && x.emoji === '🔥')
    expect(item).toBeDefined()
  })
  it('the user\'s rival game makes a news line tied to the game; other teams\' rival games do not', () => {
    const l = structuredClone(start)
    const me = l.userTeamId
    const opp = startingRivals(me)[0]
    const res = simGame(l.teams[me], l.teams[opp], l.players, l.coaches, Rng.fromSeed(2))
    const g = { id: 'gx', season: 1, day: 1, homeId: me, awayId: opp, playoff: null, result: res } as never
    const n = l.news.length
    afterGame(l, g)
    expect(l.news.slice(n).some((x) => x.gameId === 'gx' && x.emoji === '🔥')).toBe(true)
    const other = structuredClone(start)
    const [a, b] = ['t_dal', 't_hou']
    const res2 = simGame(other.teams[a], other.teams[b], other.players, other.coaches, Rng.fromSeed(2))
    const n2 = other.news.length
    afterGame(other, { id: 'gy', season: 1, day: 1, homeId: a, awayId: b, playoff: null, result: res2 } as never)
    expect(other.news.slice(n2).some((x) => x.gameId === 'gy' && x.emoji === '🔥')).toBe(false)
  })
})
