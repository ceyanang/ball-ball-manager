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
  it('balances teams: top-8 mean OVR spread <= 12', () => {
    const means = Object.values(league.teams).map((t) => {
      const top = rosterOf(league, t.id).map((p) => computeOvr(p.ratings, p.pos)).sort((a, b) => b - a).slice(0, 8)
      return top.reduce((s, x) => s + x, 0) / 8
    })
    expect(Math.max(...means) - Math.min(...means)).toBeLessThanOrEqual(12)
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
    expect(league.version).toBe(1)
  })
})
