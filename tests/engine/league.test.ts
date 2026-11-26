import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { generateCoach } from '../../src/engine/coach/generate'
import { computeOvr } from '../../src/engine/player/ratings'
import { SALARY_CAP } from '../../src/engine/constants'
import { Rng } from '../../src/engine/rng'
import type { League, Player } from '../../src/engine/types'

const league = createLeague({ seed: 99, userTeamIndex: 20, name: 'Test' })
const rosterOf = (l: League, teamId: string) => Object.values(l.players).filter((p) => p.teamId === teamId)

describe('generateCoach', () => {
  it('has valid style, dev and age', () => {
    const rng = Rng.fromSeed(4)
    for (let i = 0; i < 200; i++) {
      const c = generateCoach(rng)
      expect(['pace', 'three', 'defense', 'balanced']).toContain(c.style)
      expect(c.dev).toBeGreaterThanOrEqual(30)
      expect(c.dev).toBeLessThanOrEqual(95)
      expect(c.age).toBeGreaterThanOrEqual(38)
      expect(c.age).toBeLessThanOrEqual(68)
      expect(c.teamId).toBeNull()
    }
  })
})

describe('createLeague', () => {
  it('is deterministic for a seed', () => {
    expect(createLeague({ seed: 99, userTeamIndex: 20, name: 'Test' })).toEqual(league)
  })
  it('has 30 teams × 14 players and 25 free agents', () => {
    const teams = Object.values(league.teams)
    expect(teams).toHaveLength(30)
    for (const t of teams) expect(rosterOf(league, t.id)).toHaveLength(14)
    expect(Object.values(league.players).filter((p) => p.teamId === null)).toHaveLength(25)
  })
  it('keeps every payroll under the cap and gives rostered players contracts', () => {
    for (const t of Object.values(league.teams)) {
      const roster = rosterOf(league, t.id)
      const payroll = roster.reduce((s, p) => s + (p.contract?.salary ?? 0), 0)
      expect(payroll).toBeLessThanOrEqual(SALARY_CAP)
      for (const p of roster) {
        expect(p.contract).not.toBeNull()
        expect(p.contract!.expires).toBeGreaterThanOrEqual(1)
        expect(p.contract!.expires).toBeLessThanOrEqual(5)
      }
    }
  })
  const top8 = (l: League) => Object.values(l.teams).map((t) => {
    const top = rosterOf(l, t.id).map((p) => computeOvr(p.ratings, p.pos)).sort((a, b) => b - a).slice(0, 8)
    return { id: t.id, mean: top.reduce((s, x) => s + x, 0) / 8 }
  })
  it('has contenders and rebuilders, but no hopeless gap: top-8 mean spread 7..18', () => {
    for (const seed of [99, 1, 2, 3]) {
      const l = seed === 99 ? league : createLeague({ seed, userTeamIndex: 0, name: 'x' })
      const means = top8(l).map((m) => m.mean)
      const spread = Math.max(...means) - Math.min(...means)
      expect(spread).toBeGreaterThanOrEqual(7)
      expect(spread).toBeLessThanOrEqual(18)
    }
  })
  it('reshuffles which franchises are good from seed to seed', () => {
    const best = new Set<string>(), star = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const l = createLeague({ seed, userTeamIndex: 0, name: 'x' })
      best.add(top8(l).sort((a, b) => b.mean - a.mean)[0].id)
      const ps = Object.values(l.players).filter((p) => p.teamId)
      star.add(ps.reduce((a, b) => (computeOvr(a.ratings, a.pos) >= computeOvr(b.ratings, b.pos) ? a : b)).teamId!)
    }
    expect(best.size).toBeGreaterThanOrEqual(4)
    expect(star.size).toBeGreaterThanOrEqual(4)
  })
  it('enforces positional balance', () => {
    const isG = (p: Player) => p.pos === 'PG' || p.pos === 'SG'
    const isF = (p: Player) => p.pos === 'SF' || p.pos === 'PF'
    const isB = (p: Player) => p.pos === 'PF' || p.pos === 'C'
    for (const t of Object.values(league.teams)) {
      const r = rosterOf(league, t.id)
      expect(r.filter(isG).length).toBeGreaterThanOrEqual(2)
      expect(r.filter(isF).length).toBeGreaterThanOrEqual(2)
      expect(r.filter(isB).length).toBeGreaterThanOrEqual(2)
    }
  })
  it('gives unique jerseys per team', () => {
    for (const t of Object.values(league.teams)) {
      const nums = rosterOf(league, t.id).map((p) => p.jersey)
      expect(new Set(nums).size).toBe(nums.length)
    }
  })
  it('builds a valid rotation per team', () => {
    for (const t of Object.values(league.teams)) {
      const ids = rosterOf(league, t.id).map((p) => p.id).sort()
      const { starters, bench, inactive } = t.rotation
      expect(starters).toHaveLength(5)
      expect(starters.length + bench.length).toBeLessThanOrEqual(12)
      expect([...starters, ...bench, ...inactive].sort()).toEqual(ids)
    }
  })
  it('assigns one coach per team plus 8 unemployed', () => {
    const coaches = Object.values(league.coaches)
    expect(coaches).toHaveLength(38)
    for (const t of Object.values(league.teams)) expect(league.coaches[t.coachId].teamId).toBe(t.id)
    expect(coaches.filter((c) => c.teamId === null)).toHaveLength(8)
  })
  it('round-trips through JSON', () => {
    expect(JSON.parse(JSON.stringify(league))).toEqual(league)
  })
  it('sets user team and initial state', () => {
    expect(Object.keys(league.teams).indexOf(league.userTeamId)).toBe(20)
    expect(league.teams[league.userTeamId].name).toBe('Fakers')
    expect(league.phase).toBe('regular')
    expect(league.day).toBe(1)
    expect(league.season).toBe(1)
    expect(league.version).toBe(12)
    expect(league.favoritePlayerIds).toEqual([])
    expect(league.progress).toEqual([])
  })
  it('is stacked: most starters 72+, bench averages 66+', () => {
    const starters = Object.values(league.teams).flatMap((t) => t.rotation.starters.map((id) => computeOvr(league.players[id].ratings, league.players[id].pos)))
    expect(starters.filter((o) => o >= 72).length / starters.length).toBeGreaterThanOrEqual(0.7)
    const bench = Object.values(league.teams).flatMap((t) => t.rotation.bench.map((id) => computeOvr(league.players[id].ratings, league.players[id].pos)))
    expect(bench.reduce((s, x) => s + x, 0) / bench.length).toBeGreaterThanOrEqual(66)
  })
  it('keeps free agents between 60 and 71', () => {
    for (const p of Object.values(league.players).filter((x) => x.teamId === null)) {
      const o = computeOvr(p.ratings, p.pos)
      expect(o).toBeGreaterThanOrEqual(60)
      expect(o).toBeLessThanOrEqual(71)
    }
  })
  it('has a realistic 2K cohort of 90+ stars (~19-30)', () => {
    for (const seed of [99, 1, 2, 3]) {
      const l = seed === 99 ? league : createLeague({ seed, userTeamIndex: 0, name: 'x' })
      const ovrs = Object.values(l.players).map((p) => computeOvr(p.ratings, p.pos))
      const n90 = ovrs.filter((o) => o >= 90).length
      expect(n90).toBeGreaterThanOrEqual(19)
      expect(n90).toBeLessThanOrEqual(30)
      expect(Math.max(...ovrs)).toBeGreaterThanOrEqual(95)
    }
  })
})
