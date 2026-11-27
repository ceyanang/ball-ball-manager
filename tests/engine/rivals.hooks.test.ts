import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { pairKey, startingRivals } from '../../src/engine/rivals/rivalry'
import { simUntil } from '../../src/engine/season/advance'
import { onNewSeason } from '../../src/engine/stories/hooks'

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
})
