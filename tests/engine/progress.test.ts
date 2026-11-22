import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { progressTick } from '../../src/engine/player/progress'
import { computeOvr } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import { simDays, simUntil } from '../../src/engine/season/advance'
import { playerSeasonStats } from '../../src/engine/stats/stats'
import type { League } from '../../src/engine/types'

const ovrOf = (l: League, id: string) => computeOvr(l.players[id].ratings, l.players[id].pos)
const runs = [11, 12, 13].map((seed) => {
  const start = createLeague({ seed, userTeamIndex: 0, name: 'P' })
  const end = simUntil(start, 'regularEnd')
  return { start, end }
})

describe('in-season progress', () => {
  it('young players rise and old players dip over a season', () => {
    const young: number[] = [], old: number[] = []
    for (const { start, end } of runs)
      for (const p of Object.values(start.players)) {
        if (!p.teamId) continue
        const d = ovrOf(end, p.id) - ovrOf(start, p.id)
        if (p.age <= 23) young.push(d)
        if (p.age >= 33) old.push(d)
      }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean(young)).toBeGreaterThanOrEqual(1.5)
    expect(mean(young)).toBeLessThanOrEqual(5)
    expect(mean(old)).toBeGreaterThanOrEqual(-4)
    expect(mean(old)).toBeLessThanOrEqual(-0.5)
  })
  it('keeps ratings in 40..99 and rises below potential', () => {
    for (const { start, end } of runs)
      for (const p of Object.values(end.players)) {
        for (const v of Object.values(p.ratings)) {
          expect(Number.isFinite(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(40)
          expect(v).toBeLessThanOrEqual(99)
        }
        expect(ovrOf(end, p.id)).toBeLessThanOrEqual(Math.max(ovrOf(start, p.id), p.pot))
      }
  })
  it('leaves free agents untouched', () => {
    for (const { start, end } of runs)
      for (const p of Object.values(start.players)) if (!p.teamId) expect(end.players[p.id].ratings).toEqual(p.ratings)
  })
  it('records events only when OVR changed, during the regular season', () => {
    const done = simUntil(runs[0].end, 'playoffsEnd')
    const lastRegular = Math.max(...done.games.filter((g) => !g.playoff).map((g) => g.day))
    expect(done.progress.length).toBeGreaterThan(0)
    expect(done.progress).toEqual(runs[0].end.progress)
    for (const e of done.progress) {
      expect(e.from).not.toBe(e.to)
      expect(e.day).toBeLessThanOrEqual(lastRegular)
      expect(e.day % 10).toBe(0)
    }
  })
  it('handles players with almost no minutes (day 10) without NaN', () => {
    const l = simDays(createLeague({ seed: 14, userTeamIndex: 0, name: 'P' }), 10)
    const events = progressTick(structuredClone(l), Rng.fromSeed(1))
    for (const e of events) expect(Number.isFinite(e.to)).toBe(true)
  })
  it('is deterministic', () => {
    expect(simUntil(createLeague({ seed: 11, userTeamIndex: 0, name: 'P' }), 'regularEnd')).toEqual(runs[0].end)
  })
  it('tilts toward players who outperform their rating', () => {
    const top: number[] = [], bottom: number[] = []
    for (const { start, end } of runs) {
      const rows = Object.values(start.players)
        .filter((p) => p.teamId && p.age >= 24 && p.age <= 30)
        .map((p) => {
          const s = playerSeasonStats(end, p.id, 1, false)
          if (!s || s.min < 300) return null
          const gs = s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm) + 0.7 * s.oreb + 0.3 * s.dreb + s.stl + 0.7 * s.ast + 0.7 * s.blk - 0.4 * s.pf - s.tov
          return { resid: (gs / s.min) * 36 - ovrOf(start, p.id) * 0.25, d: ovrOf(end, p.id) - ovrOf(start, p.id) }
        })
        .filter((x): x is { resid: number; d: number } => x !== null)
        .sort((a, b) => b.resid - a.resid)
      const q = Math.floor(rows.length / 4)
      top.push(...rows.slice(0, q).map((r) => r.d))
      bottom.push(...rows.slice(-q).map((r) => r.d))
    }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    expect(mean(top)).toBeGreaterThan(mean(bottom))
  })
})
