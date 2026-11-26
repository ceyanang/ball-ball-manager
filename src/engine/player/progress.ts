import type { Rng } from '../rng'
import type { League, Player, ProgressEvent, Ratings, StatLine } from '../types'
import { aiDevIds, breakoutBump, breakoutChance, coachFactor } from '../gm/training'
import { POSITION_WEIGHTS, RATING_KEYS, computeOvr } from './ratings'

const RATING_MIN = 40
const MIN_MINUTES = 50

const ovr = (p: Player) => computeOvr(p.ratings, p.pos)

function riseChance(age: number) {
  return age <= 23 ? 0.4 : age <= 27 ? 0.2 : age <= 30 ? 0.08 : 0.05
}
function fallChance(age: number) {
  return age <= 27 ? 0.04 : age <= 30 ? 0.14 : age <= 32 ? 0.28 : 0.42
}

const gameScore = (s: StatLine) =>
  s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm) + 0.7 * s.oreb + 0.3 * s.dreb + s.stl + 0.7 * s.ast + 0.7 * s.blk - 0.4 * s.pf - s.tov

/** Per-player performance vs others of a similar OVR this season, in −0.5..0.5 (0 when too few minutes). */
export function performance(league: League): Record<string, number> {
  const per36: Record<string, number> = {}
  const mins: Record<string, number> = {}
  const gs: Record<string, number> = {}
  for (const s of Object.values(league.statLines)) {
    if (s.season !== league.season || s.playoffs) continue
    mins[s.playerId] = (mins[s.playerId] ?? 0) + s.min
    gs[s.playerId] = (gs[s.playerId] ?? 0) + gameScore(s)
  }
  const bins: Record<number, number[]> = {}
  for (const [id, m] of Object.entries(mins)) {
    const p = league.players[id]
    if (!p || m < MIN_MINUTES) continue
    per36[id] = (gs[id] / m) * 36
    ;(bins[Math.floor(ovr(p) / 5)] ??= []).push(per36[id])
  }
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(per36)) {
    const bin = bins[Math.floor(ovr(league.players[id]) / 5)]
    const expected = bin.reduce((a, b) => a + b, 0) / bin.length
    out[id] = Math.max(-0.5, Math.min(0.5, (v - expected) / Math.max(1, Math.abs(expected))))
  }
  return out
}

/** Bumps weighted-random ratings one point at a time until OVR moves by `delta` (or limits are hit). */
function shift(p: Player, delta: number, rng: Rng): void {
  const dir = Math.sign(delta)
  const start = ovr(p)
  const w = POSITION_WEIGHTS[p.pos]
  for (let i = 0; i < 60 && (ovr(p) - start) * dir < Math.abs(delta); i++) {
    const options = RATING_KEYS.filter((k) => (dir > 0 ? p.ratings[k] < 99 : p.ratings[k] > RATING_MIN))
    if (!options.length) return
    const k: keyof Ratings = rng.weighted(options, (key) => w[key])
    const before = { ...p.ratings }
    p.ratings[k] += dir
    if (dir > 0 && ovr(p) > Math.max(start, p.pot)) {
      p.ratings = before
      return
    }
  }
}

/** One in-season progress tick for every rostered player. Mutates ratings; returns events where OVR changed. */
export function progressTick(league: League, rng: Rng): ProgressEvent[] {
  const perf = performance(league)
  const events: ProgressEvent[] = []
  const invested = new Set(league.training.map((t) => t.playerId))
  const aiDev = aiDevIds(league)
  for (const p of Object.values(league.players)) {
    if (!p.teamId) continue
    // User development slots and CPU young-core focus both get real breakout odds and faster growth.
    const userInv = invested.has(p.id) && p.teamId === league.userTeamId
    const inv = userInv || aiDev.has(p.id)
    const cf = inv ? coachFactor(league, p.teamId) : 1
    if (inv && rng.chance(breakoutChance(p, cf))) {
      const from = ovr(p), potFrom = p.pot
      p.pot = Math.min(99, p.pot + breakoutBump(p, rng))
      shift(p, 2, rng)
      const to = ovr(p)
      if (userInv) events.push({ season: league.season, day: league.day, playerId: p.id, teamId: p.teamId, from, to, breakout: { potFrom, potTo: p.pot } })
      else if (to !== from) events.push({ season: league.season, day: league.day, playerId: p.id, teamId: p.teamId, from, to })
      continue
    }
    const tilt = perf[p.id] ?? 0
    let up = riseChance(p.age) * (1 + 1.5 * tilt)
    let down = fallChance(p.age) * (1 - 1.5 * tilt)
    if (inv) {
      up = Math.min(0.8, up * 1.3 * cf)
      down *= 0.6
    }
    const r = rng.next()
    const dir = r < up ? 1 : r < up + down ? -1 : 0
    if (!dir) continue
    if (dir > 0 && ovr(p) >= p.pot) continue
    // The last few points above 89 come slowly.
    if (dir > 0 && ovr(p) >= 89 && rng.chance(ovr(p) >= 93 ? 0.75 : 0.5)) continue
    const from = ovr(p)
    shift(p, dir * (rng.chance(0.7) ? 1 : 2), rng)
    const to = ovr(p)
    if (to !== from) events.push({ season: league.season, day: league.day, playerId: p.id, teamId: p.teamId, from, to })
  }
  return events
}
