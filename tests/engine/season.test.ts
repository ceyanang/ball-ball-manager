import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { simDays, simUntil } from '../../src/engine/season/advance'
import { leaders } from '../../src/engine/stats/stats'
import { computeStandings } from '../../src/engine/standings'
import type { League } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 404, userTeamIndex: 3, name: 'Season' })
const t0 = Date.now()
const start = fresh()
const regEnd = simUntil(start, 'regularEnd')
const done = simUntil(regEnd, 'playoffsEnd')
const elapsed = Date.now() - t0

describe('simDays', () => {
  it('does not mutate its input', () => {
    const l = fresh()
    const snap = JSON.stringify(l)
    simDays(l, 3)
    expect(JSON.stringify(l)).toBe(snap)
  })
  it('advances the day and plays exactly that day’s games', () => {
    const l = simDays(fresh(), 1)
    expect(l.day).toBe(2)
    for (const g of l.games) expect(g.result !== null).toBe(g.day === 1)
    expect(l.rng).not.toEqual(fresh().rng)
  })
  it('is a no-op in the offseason', () => {
    expect(simDays(done, 5)).toEqual(done)
  })
})

describe('regular season', () => {
  it('plays all 600 games then seeds the playoffs', () => {
    expect(regEnd.games.filter((g) => !g.playoff && g.result)).toHaveLength(600)
    expect(regEnd.phase).toBe('playoffs')
    const b = regEnd.playoffs!
    const r1 = b.series.filter((s) => s.round === 1)
    expect(r1).toHaveLength(8)
    const st = computeStandings(regEnd, 1)
    for (const conf of ['East', 'West'] as const) {
      const seeds = st[conf].slice(0, 8).map((r) => r.teamId)
      const mine = r1.filter((s) => s.conf === conf)
      const pairs = mine.map((s) => [s.highSeed, s.lowSeed].join('v')).sort()
      expect(pairs).toEqual(['1v8', '2v7', '3v6', '4v5'])
      for (const s of mine) {
        expect(s.highSeedId).toBe(seeds[s.highSeed - 1])
        expect(s.lowSeedId).toBe(seeds[s.lowSeed - 1])
        expect(s.bestOf).toBe(5)
      }
    }
  })
  it('coach W/L matches team records', () => {
    const st = computeStandings(regEnd, 1)
    for (const row of [...st.East, ...st.West]) {
      const c = regEnd.coaches[regEnd.teams[row.teamId].coachId]
      expect([c.wins, c.losses]).toEqual([row.w, row.l])
    }
  })
  it('produces believable stat leaders', () => {
    const ppg = leaders(regEnd, 1, 'pts', 1)[0].value
    const apg = leaders(regEnd, 1, 'ast', 1)[0].value
    const rpg = leaders(regEnd, 1, 'reb', 1)[0].value
    expect(ppg).toBeGreaterThanOrEqual(25); expect(ppg).toBeLessThanOrEqual(36)
    expect(apg).toBeGreaterThanOrEqual(7); expect(apg).toBeLessThanOrEqual(12)
    expect(rpg).toBeGreaterThanOrEqual(10); expect(rpg).toBeLessThanOrEqual(15)
  })
})

describe('playoffs', () => {
  it('crowns a champion and ends in the offseason', () => {
    expect(done.phase).toBe('offseason')
    expect(done.playoffs!.championId).not.toBeNull()
    const finals = done.playoffs!.series.find((s) => s.round === 4)!
    expect(finals.conf).toBeNull()
    expect(finals.bestOf).toBe(7)
    expect(done.playoffs!.championId).toBe(finals.winnerId)
  })
  it('completes every series with the right number of games', () => {
    const series = done.playoffs!.series
    expect(series).toHaveLength(15)
    for (const s of series) {
      const need = s.bestOf === 7 ? 4 : 3
      expect(s.winnerId).not.toBeNull()
      expect(Math.max(s.highWins, s.lowWins)).toBe(need)
      const games = done.games.filter((g) => g.playoff?.seriesId === s.id)
      expect(games.length).toBe(s.highWins + s.lowWins)
      expect(games.length).toBeLessThanOrEqual(s.bestOf)
      expect(games.every((g) => g.result)).toBe(true)
      expect(games[0].homeId).toBe(s.highSeedId)
    }
  })
  it('records playoff stats separately', () => {
    expect(Object.values(done.statLines).some((s) => s.playoffs)).toBe(true)
  })
})

describe('season determinism and speed', () => {
  it('is deterministic', () => {
    expect(simUntil(simUntil(fresh(), 'regularEnd'), 'playoffsEnd')).toEqual(done)
  }, 30000)
  it('sims a full season + playoffs in under 8 s', () => {
    expect(elapsed).toBeLessThan(8000)
  })
})

export type { League }
