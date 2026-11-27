import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { RIVAL, addSeriesHeat, isRivalGame, pairKey, rivalsOf, rolloverRivalry, startingRivals } from '../../src/engine/rivals/rivalry'
import type { League, Series } from '../../src/engine/types'

const mk = (seed = 3): League => createLeague({ seed, userTeamIndex: 0, name: 'R' })
const series = (round: number, a: string, b: string, winnerId: string | null = a): Series => ({
  id: `s_${round}_${a}_${b}`, round, conf: null, highSeedId: a, lowSeedId: b, highSeed: 1, lowSeed: 2, highWins: 3, lowWins: 1, bestOf: 5, winnerId,
})

describe('rivalry engine', () => {
  it('pairKey is order-independent', () => {
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'))
  })
  it('rivalsOf includes starting rivals (CLE↔GSW) and stored dynamic ones, ignoring unknown ids', () => {
    const l = mk()
    expect(startingRivals('t_cle')).toContain('t_gsw')
    expect(rivalsOf(l, 't_cle')).toContain('t_gsw')
    l.rivalry.dynamic.t_cle = ['t_atl', 't_gone']
    const r = rivalsOf(l, 't_cle')
    expect(r).toContain('t_atl')
    expect(r).not.toContain('t_gone')
    expect(new Set(r).size).toBe(r.length)
  })
  it('isRivalGame is true if either side lists the other', () => {
    const l = mk()
    expect(isRivalGame(l, { homeId: 't_cle', awayId: 't_gsw' })).toBe(true)
    expect(isRivalGame(l, { homeId: 't_atl', awayId: 't_sac' })).toBe(false)
    l.rivalry.dynamic.t_atl = ['t_sac']
    expect(isRivalGame(l, { homeId: 't_sac', awayId: 't_atl' })).toBe(true)
  })
  it('addSeriesHeat: Finals +40, conf finals +20, other +6; undecided adds nothing; records the meeting', () => {
    const l = mk()
    addSeriesHeat(l, series(4, 't_atl', 't_sac'))
    expect(l.rivalry.heat[pairKey('t_atl', 't_sac')]).toBe(40)
    addSeriesHeat(l, series(3, 't_bos', 't_den'))
    expect(l.rivalry.heat[pairKey('t_bos', 't_den')]).toBe(20)
    addSeriesHeat(l, series(1, 't_chi', 't_uta'))
    expect(l.rivalry.heat[pairKey('t_chi', 't_uta')]).toBe(6)
    addSeriesHeat(l, series(4, 't_mia', 't_por', null))
    expect(l.rivalry.heat[pairKey('t_mia', 't_por')]).toBeUndefined()
    expect(l.rivalry.met).toContain(pairKey('t_atl', 't_sac'))
  })
  it('rollover cools met pairs ×0.7 and unmet ×0.5, drops < 1, clears met', () => {
    const l = mk()
    l.rivalry.heat[pairKey('t_atl', 't_sac')] = 100
    l.rivalry.heat[pairKey('t_bos', 't_den')] = 100
    l.rivalry.heat[pairKey('t_chi', 't_uta')] = 1.5
    l.rivalry.met = [pairKey('t_atl', 't_sac')]
    rolloverRivalry(l)
    expect(l.rivalry.heat[pairKey('t_atl', 't_sac')]).toBeCloseTo(70)
    expect(l.rivalry.heat[pairKey('t_bos', 't_den')]).toBeCloseTo(50)
    expect(l.rivalry.heat[pairKey('t_chi', 't_uta')]).toBeUndefined()
    expect(l.rivalry.met).toEqual([])
  })
  it('a lone hot pair becomes dynamic rivals for both; cold or empty heat gives none', () => {
    for (const seed of [1, 2, 3, 4]) {
      const l = mk(seed)
      l.rivalry.heat[pairKey('t_atl', 't_lak')] = 60
      l.rivalry.heat[pairKey('t_bos', 't_den')] = 20 // cools to 10 (< minHeat 15)
      rolloverRivalry(l)
      expect(l.rivalry.dynamic.t_atl).toEqual(['t_lak'])
      expect(l.rivalry.dynamic.t_lak).toEqual(['t_atl'])
      expect(l.rivalry.dynamic.t_bos ?? []).toEqual([])
    }
    const e = mk()
    rolloverRivalry(e)
    expect(Object.values(e.rivalry.dynamic).every((d) => d.length === 0)).toBe(true)
  })
  it('never picks starting rivals, never more than 2, minHeat respected, deterministic', () => {
    const build = () => {
      const l = mk(5)
      for (const t of ['t_sac', 't_den', 't_uta', 't_por']) l.rivalry.heat[pairKey('t_atl', t)] = 200
      l.rivalry.heat[pairKey('t_atl', 't_mia')] = 200 // starting rival: excluded
      rolloverRivalry(l)
      return l
    }
    const a = build(), b = build()
    expect(a.rivalry.dynamic).toEqual(b.rivalry.dynamic)
    const d = a.rivalry.dynamic.t_atl
    expect(d).toHaveLength(2)
    expect(d).not.toContain('t_mia')
    expect(RIVAL.minHeat).toBe(15)
  })
})
