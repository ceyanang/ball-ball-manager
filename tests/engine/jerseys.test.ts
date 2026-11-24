import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { statKey } from '../../src/engine/stats/stats'
import { BAR_STEP, STAR_SCORE, evaluateJerseys, renumberHolders, renumberIfRetired, teamStint } from '../../src/engine/stories/jerseys'
import { onRetired } from '../../src/engine/stories/hooks'
import type { League, Player, SeasonAwards, StatLine } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 4242, userTeamIndex: 3, name: 'Jerseys' })

function line(season: number, teamId: string, playerId: string, gp: number, ppg: number): StatLine {
  return {
    playerId, teamId, season, playoffs: false, gp, gs: gp, min: gp * 30, pts: ppg * gp, oreb: 0, dreb: 0, ast: 0,
    stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
  }
}
function addSeasons(l: League, p: Player, teamId: string, from: number, to: number, ppg: number, gp = 70) {
  for (let s = from; s <= to; s++) l.statLines[statKey(s, false, p.id, teamId)] = line(s, teamId, p.id, gp, ppg)
}
function addTitle(l: League, season: number, teamId: string, ids: string[]) {
  l.awards.push({
    season, championId: teamId, championRoster: ids, mvp: null, finalsMvp: null, dpoy: null, roy: null,
    allLeague: [], allDefense: [], allRookie: [],
  } as unknown as SeasonAwards)
}
/** A retiree: a rostered player turned into a retired one with no team. */
function retiree(l: League, teamId: string): Player {
  const p = Object.values(l.players).find((q) => q.teamId === teamId)!
  p.teamId = null
  p.retired = true
  return p
}
const ids = (l: League) => Object.keys(l.teams)

describe('jersey retirements', () => {
  it('retires the number of a star with a big team-only score, and says why', () => {
    const l = fresh()
    const [a] = ids(l)
    const p = retiree(l, a)
    addSeasons(l, p, a, 1, 8, 30)
    const out = evaluateJerseys(l, [p.id])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ teamId: a, playerId: p.id, number: p.jersey, door: 'star', seasons: 8 })
    expect(l.retiredJerseys).toHaveLength(1)
    expect(l.news.some((n) => n.title.includes(`#${p.jersey}`))).toBe(true)
  })

  it('the loyal door needs a long stay and a title with that team', () => {
    const l = fresh()
    const [a] = ids(l)
    const p = retiree(l, a)
    addSeasons(l, p, a, 1, 8, 26)
    expect(evaluateJerseys(l, [p.id])).toHaveLength(0)
    addTitle(l, 3, a, [p.id])
    const out = evaluateJerseys(l, [p.id])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ door: 'loyal', titles: 1 })
  })

  it('a title won with another team does not open the loyal door', () => {
    const l = fresh()
    const [a, b] = ids(l)
    const p = retiree(l, a)
    addSeasons(l, p, a, 1, 8, 26)
    addTitle(l, 10, b, [p.id])
    expect(evaluateJerseys(l, [p.id])).toHaveLength(0)
  })

  it('judges each team on its own years only', () => {
    const l = fresh()
    const [a, b] = ids(l)
    const p = retiree(l, a)
    addSeasons(l, p, a, 1, 8, 30)
    addSeasons(l, p, b, 9, 12, 12)
    expect(teamStint(l, p.id, a).seasons).toBe(8)
    const out = evaluateJerseys(l, [p.id])
    expect(out.map((j) => j.teamId)).toEqual([a])
  })

  it('a player can be honored by two teams', () => {
    const l = fresh()
    const [a, b] = ids(l)
    const p = retiree(l, a)
    addSeasons(l, p, a, 1, 8, 30)
    addSeasons(l, p, b, 9, 16, 30)
    expect(evaluateJerseys(l, [p.id]).map((j) => j.teamId).sort()).toEqual([a, b].sort())
  })

  it('each retired number raises that team\'s bar', () => {
    const l = fresh()
    const [a] = ids(l)
    const first = retiree(l, a)
    addSeasons(l, first, a, 1, 8, 30)
    expect(evaluateJerseys(l, [first.id])).toHaveLength(1)
    // Same quality as before is no longer enough for the next one.
    const second = retiree(l, a)
    addSeasons(l, second, a, 1, 8, 30)
    expect(teamStint(l, second.id, a).score).toBeLessThan(STAR_SCORE + BAR_STEP)
    expect(evaluateJerseys(l, [second.id])).toHaveLength(0)
    const third = retiree(l, a)
    addSeasons(l, third, a, 1, 8, 36)
    expect(evaluateJerseys(l, [third.id])).toHaveLength(1)
  })

  it('a player who never played retires nothing and does not crash', () => {
    const l = fresh()
    const p = retiree(l, ids(l)[0])
    expect(evaluateJerseys(l, [p.id, 'nobody'])).toEqual([])
  })

  it('retiring does not run twice for the same player and team', () => {
    const l = fresh()
    const [a] = ids(l)
    const p = retiree(l, a)
    addSeasons(l, p, a, 1, 8, 30)
    evaluateJerseys(l, [p.id])
    expect(evaluateJerseys(l, [p.id])).toEqual([])
    expect(l.retiredJerseys).toHaveLength(1)
  })

  it('pings the owner only when it is their team', () => {
    const l = fresh()
    const p = retiree(l, l.userTeamId)
    addSeasons(l, p, l.userTeamId, 1, 8, 30)
    onRetired(l, [p.id])
    expect(l.inbox.some((i) => i.key === `jersey:${l.userTeamId}:${p.id}`)).toBe(true)
    const other = ids(l).find((t) => t !== l.userTeamId)!
    const q = retiree(l, other)
    addSeasons(l, q, other, 1, 8, 30)
    onRetired(l, [q.id])
    expect(l.inbox.some((i) => i.key === `jersey:${other}:${q.id}`)).toBe(false)
  })
})

describe('jersey number clashes', () => {
  it('a teammate wearing the retired number gets a new one; others are untouched', () => {
    const l = fresh()
    const [a] = ids(l)
    const p = retiree(l, a)
    const roster = Object.values(l.players).filter((q) => q.teamId === a)
    const holder = roster[0]
    const bystander = roster[1]
    holder.jersey = p.jersey
    const before = bystander.jersey
    addSeasons(l, p, a, 1, 8, 30)
    evaluateJerseys(l, [p.id])
    expect(holder.jersey).not.toBe(p.jersey)
    expect(bystander.jersey).toBe(before === p.jersey ? bystander.jersey : before)
    const others = roster.filter((q) => q !== holder).map((q) => q.jersey)
    expect(others).not.toContain(holder.jersey)
  })

  it('renumbering is deterministic for the same league', () => {
    const run = () => {
      const l = fresh()
      const a = ids(l)[0]
      const holder = Object.values(l.players).find((q) => q.teamId === a)!
      holder.jersey = 23
      l.retiredJerseys.push({ teamId: a, playerId: 'x', number: 23, season: 1, seasons: 9, titles: 1, score: 40, door: 'star' })
      renumberHolders(l, a, 23, 'x')
      return holder.jersey
    }
    expect(run()).toBe(run())
  })

  it('a player joining a team that retired his number is renumbered', () => {
    const l = fresh()
    const [a, b] = ids(l)
    l.retiredJerseys.push({ teamId: a, playerId: 'x', number: 23, season: 1, seasons: 9, titles: 1, score: 40, door: 'star' })
    const r = Object.values(l.players).find((q) => q.teamId === b)!
    r.jersey = 23
    r.teamId = a
    renumberIfRetired(l, r)
    expect(r.jersey).not.toBe(23)
    // His old team's retired list is irrelevant: a player keeps 23 on a team that did not retire it.
    r.jersey = 23
    r.teamId = b
    renumberIfRetired(l, r)
    expect(r.jersey).toBe(23)
  })
})
