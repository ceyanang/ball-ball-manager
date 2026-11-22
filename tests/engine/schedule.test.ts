import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { generateSchedule } from '../../src/engine/schedule/schedule'
import { Rng } from '../../src/engine/rng'

const league = createLeague({ seed: 5, userTeamIndex: 0, name: 'S' })
const teams = Object.values(league.teams)
const games = generateSchedule(teams, 1, Rng.fromSeed(77))

describe('generateSchedule', () => {
  it('has 600 games, sorted by day, unplayed regular-season games', () => {
    expect(games).toHaveLength(600)
    for (let i = 1; i < games.length; i++) expect(games[i].day).toBeGreaterThanOrEqual(games[i - 1].day)
    for (const g of games) {
      expect(g.playoff).toBeNull()
      expect(g.result).toBeNull()
      expect(g.season).toBe(1)
    }
    expect(new Set(games.map((g) => g.id)).size).toBe(600)
  })
  it('gives each team 40 games, 20 home and 20 away', () => {
    for (const t of teams) {
      expect(games.filter((g) => g.homeId === t.id)).toHaveLength(20)
      expect(games.filter((g) => g.awayId === t.id)).toHaveLength(20)
    }
  })
  it('has every pair meet at least once', () => {
    const met = new Set(games.map((g) => [g.homeId, g.awayId].sort().join('|')))
    expect(met.size).toBe(435)
  })
  it('splits 24 conference and 16 cross-conference games', () => {
    for (const t of teams) {
      const mine = games.filter((g) => g.homeId === t.id || g.awayId === t.id)
      const opp = (g: (typeof games)[number]) => league.teams[g.homeId === t.id ? g.awayId : g.homeId]
      expect(mine.filter((g) => opp(g).conf === t.conf)).toHaveLength(24)
      expect(mine.filter((g) => opp(g).conf !== t.conf)).toHaveLength(16)
    }
  })
  it('never schedules a team twice a day or three days running', () => {
    const byTeam = new Map<string, number[]>()
    for (const g of games)
      for (const id of [g.homeId, g.awayId]) byTeam.set(id, [...(byTeam.get(id) ?? []), g.day])
    for (const days of byTeam.values()) {
      expect(new Set(days).size).toBe(days.length)
      const s = new Set(days)
      for (const d of days) expect(s.has(d + 1) && s.has(d + 2)).toBe(false)
    }
  })
  it('spans 70–85 days', () => {
    expect(Math.max(...games.map((g) => g.day))).toBeGreaterThanOrEqual(70)
    expect(Math.max(...games.map((g) => g.day))).toBeLessThanOrEqual(85)
    expect(Math.min(...games.map((g) => g.day))).toBe(1)
  })
  it('is deterministic for a seed', () => {
    expect(generateSchedule(teams, 1, Rng.fromSeed(77))).toEqual(games)
  })
  it('is wired into createLeague', () => {
    expect(league.games).toHaveLength(600)
  })
})
