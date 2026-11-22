import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { addBoxToStatLines, leaders, perGame, playerSeasonStats, statKey } from '../../src/engine/stats/stats'
import type { League, StatLine } from '../../src/engine/types'

function played(n: number): League {
  const l = createLeague({ seed: 8, userTeamIndex: 0, name: 'S' })
  const rng = Rng.fromSeed(8)
  for (const g of l.games.slice(0, n)) {
    g.result = simGame(l.teams[g.homeId], l.teams[g.awayId], l.players, l.coaches, rng)
    addBoxToStatLines(l.statLines, g)
  }
  return l
}

const empty = (o: Partial<StatLine>): StatLine => ({
  playerId: 'p', teamId: 't', season: 1, playoffs: false, gp: 0, gs: 0, min: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0,
  blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0, ...o,
})

describe('stat lines', () => {
  it('totals equal the sum of box scores', () => {
    const l = played(50)
    const pts: Record<string, number> = {}, gp: Record<string, number> = {}
    for (const g of l.games.slice(0, 50))
      for (const b of g.result!.box) {
        pts[b.playerId] = (pts[b.playerId] ?? 0) + b.pts
        if (b.min > 0) gp[b.playerId] = (gp[b.playerId] ?? 0) + 1
      }
    for (const [id, v] of Object.entries(pts)) {
      const s = playerSeasonStats(l, id, 1, false)
      if (!gp[id]) {
        expect(s).toBeNull() // never got minutes → no line
        continue
      }
      expect(s!.pts).toBe(v)
      expect(s!.gp).toBe(gp[id])
    }
  })
  it('merges a traded player across teams, reporting his current team', () => {
    const l = createLeague({ seed: 8, userTeamIndex: 0, name: 'S' })
    const p = Object.values(l.players).find((x) => x.teamId)!
    l.statLines[statKey(1, false, p.id, 't_old')] = empty({ playerId: p.id, teamId: 't_old', gp: 3, pts: 30, fga: 20, fgm: 10 })
    l.statLines[statKey(1, false, p.id, p.teamId!)] = empty({ playerId: p.id, teamId: p.teamId!, gp: 2, pts: 10, fga: 10, fgm: 4 })
    const s = playerSeasonStats(l, p.id, 1, false)!
    expect(s.gp).toBe(5)
    expect(s.pts).toBe(40)
    expect(s.teamId).toBe(p.teamId)
    expect(playerSeasonStats(l, p.id, 2, false)).toBeNull()
  })
  it('perGame gives 0 percentages with no attempts', () => {
    const pg = perGame(empty({ gp: 2, pts: 10, oreb: 2, dreb: 4 }))
    expect(pg.pts).toBe(5)
    expect(pg.reb).toBe(3)
    expect(pg.fgPct).toBe(0)
    expect(pg.tpPct).toBe(0)
    expect(pg.ftPct).toBe(0)
  })
  it('leaders exclude players below the games-played threshold', () => {
    const l = played(150)
    const star = Object.values(l.players).find((p) => p.teamId === null)!
    l.statLines[statKey(1, false, star.id, 't_x')] = empty({ playerId: star.id, teamId: 't_x', gp: 2, pts: 120, fga: 60, fgm: 50 })
    const top = leaders(l, 1, 'pts', 10)
    expect(top).toHaveLength(10)
    expect(top.map((x) => x.playerId)).not.toContain(star.id)
    for (let i = 1; i < top.length; i++) expect(top[i - 1].value).toBeGreaterThanOrEqual(top[i].value)
    expect(leaders(l, 1, 'fgPct', 5).map((x) => x.playerId)).not.toContain(star.id)
  })
})
