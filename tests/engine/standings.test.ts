import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { computeStandings, sortTeams } from '../../src/engine/standings'
import type { Game, League } from '../../src/engine/types'

function leagueWith(results: [string, string, number, number][]): League {
  const l = createLeague({ seed: 2, userTeamIndex: 0, name: 'St' })
  l.games = results.map(([h, a, hs, as], i): Game => ({
    id: `g${i}`, season: 1, day: i + 1, homeId: h, awayId: a, playoff: null,
    result: { homeScore: hs, awayScore: as, quarters: { home: [hs], away: [as] }, ot: 0, box: [], potg: '' },
  }))
  return l
}
// East: atl bos bkn cha ; West: dal
const [A, B, C, D, W] = ['t_atl', 't_bos', 't_bkn', 't_cha', 't_dal']

describe('computeStandings', () => {
  it('orders by win pct and computes GB, home/away, streaks', () => {
    const l = leagueWith([[A, B, 100, 90], [A, C, 100, 90], [B, C, 100, 90], [C, A, 100, 90]])
    const east = computeStandings(l, 1).East
    expect(east).toHaveLength(15)
    expect(east[0].teamId).toBe(A)
    expect(east[0].w).toBe(2)
    expect(east[0].l).toBe(1)
    const b = east.find((r) => r.teamId === B)!
    expect(b.gb).toBe(0.5)
    expect(b.home).toEqual([1, 0])
    expect(b.away).toEqual([0, 1])
    expect(east[0].streak).toBe('L1')
    const c = east.find((r) => r.teamId === C)!
    expect(c.streak).toBe('W1')
    expect(c.last10).toBe('1-2')
  })
  it('breaks a 2-team tie by head-to-head', () => {
    const l = leagueWith([[B, A, 100, 99], [A, W, 120, 80], [W, B, 110, 100]])
    const order = computeStandings(l, 1).East.map((r) => r.teamId)
    expect(order.indexOf(B)).toBeLessThan(order.indexOf(A))
  })
  it('breaks a 3-team tie by group h2h, then conference record, then point diff — deterministically', () => {
    const l = leagueWith([
      [A, B, 120, 100], [B, C, 105, 100], [C, A, 101, 100], // circular h2h
      [A, W, 110, 100], [D, A, 101, 100],                   // A 2-2, conf 1-2, diff +28
      [B, D, 100, 90], [W, B, 100, 90],                     // B 2-2, conf 2-1
      [C, W, 102, 100], [D, C, 110, 100],                   // C 2-2, conf 1-2, diff -12
    ])
    const order = computeStandings(l, 1).East.map((r) => r.teamId)
    expect(order.slice(0, 4)).toEqual([D, B, A, C])
    expect(computeStandings(l, 1).East.map((r) => r.teamId)).toEqual(order)
  })
  it('sortTeams orders across conferences with the same chain', () => {
    const l = leagueWith([[A, W, 100, 90], [A, B, 100, 90], [W, B, 100, 90]])
    expect(sortTeams(l, 1, [W, A])).toEqual([A, W])
  })
  it('ignores playoff games and unplayed games', () => {
    const l = leagueWith([[A, B, 100, 90]])
    l.games.push({ ...l.games[0], id: 'po', playoff: { round: 1, seriesId: 's', gameNum: 1 } })
    l.games.push({ ...l.games[0], id: 'un', result: null })
    expect(computeStandings(l, 1).East.find((r) => r.teamId === A)!.w).toBe(1)
  })
})
