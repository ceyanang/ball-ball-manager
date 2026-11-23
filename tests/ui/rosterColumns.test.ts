import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { perGame, statKey } from '../../src/engine/stats/stats'
import type { League, Player, StatLine } from '../../src/engine/types'
import { groupRoster, rosterColumns } from '../../src/ui/rosterColumns'
import { rosterOf } from '../../src/ui/util'

const mk = () => createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const col = (league: League, key: string, mode: 'pg' | 'tot' = 'pg') => rosterColumns(league, mode).find((c) => c.key === key)!

function giveLine(league: League, p: Player, over: Partial<StatLine>): StatLine {
  const line: StatLine = {
    playerId: p.id, teamId: p.teamId!, season: league.season, playoffs: false, gp: 10, gs: 5, min: 300, pts: 150, oreb: 10, dreb: 30,
    ast: 40, stl: 12, blk: 6, tov: 20, pf: 25, fgm: 60, fga: 120, tpm: 15, tpa: 40, ftm: 15, fta: 20, pm: 30, ...over,
  }
  league.statLines[statKey(league.season, false, p.id, p.teamId!)] = line
  return line
}

describe('rosterColumns', () => {
  it('has the planned keys in order', () => {
    expect(rosterColumns(mk(), 'pg').map((c) => c.key)).toEqual([
      'player', 'pos', 'age', 'ovr', 'pot', 'gp', 'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg', 'tp', 'ft', 'pm', 'salary', 'through',
    ])
  })
  it('gives a player with no games null stats but gp 0', () => {
    const league = mk()
    const p = rosterOf(league, league.userTeamId)[0]
    expect(col(league, 'gp').value(p)).toBe(0)
    for (const k of ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fg', 'tp', 'ft', 'pm']) expect(col(league, k).value(p)).toBeNull()
  })
  it('gives null shooting percentages at 0 attempts', () => {
    const league = mk()
    const p = rosterOf(league, league.userTeamId)[0]
    giveLine(league, p, { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 })
    expect(col(league, 'fg').value(p)).toBeNull()
    expect(col(league, 'tp').value(p)).toBeNull()
    expect(col(league, 'ft').value(p)).toBeNull()
    expect(col(league, 'pts').value(p)).not.toBeNull()
  })
  it('reports percentages on a 0–100 scale', () => {
    const league = mk()
    const p = rosterOf(league, league.userTeamId)[0]
    giveLine(league, p, { fgm: 4, fga: 10 })
    expect(col(league, 'fg').value(p)).toBeCloseTo(40)
  })
  it('switches between per-game and totals', () => {
    const league = mk()
    const p = rosterOf(league, league.userTeamId)[0]
    const line = giveLine(league, p, {})
    expect(col(league, 'pts', 'tot').value(p)).toBe(line.pts)
    expect(col(league, 'pts', 'pg').value(p)).toBeCloseTo(perGame(line).pts)
    expect(col(league, 'pm', 'pg').value(p)).toBeCloseTo(line.pm / line.gp)
    expect(col(league, 'pm', 'tot').value(p)).toBe(line.pm)
  })
})

describe('groupRoster', () => {
  const idsOf = (g: ReturnType<typeof groupRoster>) => g.flatMap((x) => x.rows.map((p) => p.id))

  it('lists every rostered player once, starters first', () => {
    const league = mk()
    const team = league.teams[league.userTeamId]
    const roster = rosterOf(league, team.id)
    const groups = groupRoster(team, roster)
    expect(groups[0].label).toBe('Starters')
    expect(groups[0].rows).toHaveLength(5)
    expect(idsOf(groups).sort()).toEqual(roster.map((p) => p.id).sort())
  })
  it('ignores rotation ids that are no longer on the roster and benches unlisted players', () => {
    const league = mk()
    const team = league.teams[league.userTeamId]
    const roster = rosterOf(league, team.id)
    const unlisted = roster[roster.length - 1]
    const rot = {
      starters: team.rotation.starters.filter((id) => id !== unlisted.id),
      bench: [...team.rotation.bench.filter((id) => id !== unlisted.id), 'ghost-player'],
      inactive: team.rotation.inactive.filter((id) => id !== unlisted.id),
    }
    const groups = groupRoster({ ...team, rotation: rot }, roster)
    expect(idsOf(groups)).not.toContain('ghost-player')
    expect(idsOf(groups).sort()).toEqual(roster.map((p) => p.id).sort())
    expect(groups.find((g) => g.label === 'Bench')!.rows.map((p) => p.id)).toContain(unlisted.id)
  })
  it('falls back to OVR order when there are not five starters', () => {
    const league = mk()
    const team = league.teams[league.userTeamId]
    const roster = rosterOf(league, team.id)
    const groups = groupRoster({ ...team, rotation: { starters: [], bench: [], inactive: [] } }, roster)
    expect(groups.map((g) => g.label)).toEqual(['Starters', 'Bench'])
    expect(groups[0].rows).toHaveLength(5)
    expect(idsOf(groups).sort()).toEqual(roster.map((p) => p.id).sort())
  })
  it('omits empty groups and shows Inactive when the rotation has them', () => {
    const league = mk()
    const team = league.teams[league.userTeamId]
    const roster = rosterOf(league, team.id)
    const labels = groupRoster(team, roster).map((g) => g.label)
    expect(labels).not.toContain('')
    const r = team.rotation
    expect(labels.includes('Inactive')).toBe(r.inactive.length > 0)
  })
})
