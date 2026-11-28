import type { Position, Ratings } from '../types'

/**
 * Play styles: a fixed trait rolled once at generation that changes how a player plays (habits) and gives a
 * small boost to the stats the style cares about — both only inside the sim. Stored ratings and OVR never see it.
 * Spec: docs/superpowers/specs/2026-11-28-play-styles-design.md
 */
export type PlayStyle = 'smart' | 'offense' | 'allAround' | 'power' | 'defensive'

export const PLAY_STYLES: readonly PlayStyle[] = ['smart', 'offense', 'allAround', 'power', 'defensive']

export const STYLE_LABEL: Record<PlayStyle, string> = {
  smart: 'Smart',
  offense: 'Offense',
  allAround: 'All-Around',
  power: 'Power',
  defensive: 'Defensive',
}

export const STYLE_EMOJI: Record<PlayStyle, string> = {
  smart: '🧠',
  offense: '⚔️',
  allAround: '🏀',
  power: '💪',
  defensive: '🛡',
}

export const isPlayStyle = (v: unknown): v is PlayStyle => typeof v === 'string' && (PLAY_STYLES as readonly string[]).includes(v)

const row = (smart: number, offense: number, allAround: number, power: number, defensive: number): Record<PlayStyle, number> => ({
  smart, offense, allAround, power, defensive,
})

/** Owner's chart: % chance per position before the ratings tilt. */
export const POSITION_ODDS: Record<Position, Record<PlayStyle, number>> = {
  PG: row(35, 30, 18, 5, 12),
  SG: row(15, 38, 20, 7, 20),
  SF: row(18, 18, 28, 18, 18),
  PF: row(8, 12, 14, 38, 28),
  C: row(8, 8, 10, 36, 38),
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const avg = (...xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

type Specialty = Exclude<PlayStyle, 'allAround'>

function pillarScores(r: Ratings): Record<Specialty, number> {
  return {
    offense: avg(r.threePointShot, r.midRangeShot, r.closeShot, r.speed, r.speedWithBall),
    smart: avg(r.passVision, r.passIQ, r.passAccuracy, r.shotIQ, r.helpDefenseIQ, r.passPerception),
    power: avg(r.strength, r.vertical, r.standingDunk, r.drivingDunk, r.postControl, r.layup),
    defensive: avg(Math.max(r.perimeterDefense, r.interiorDefense), r.steal, r.block, r.defensiveRebound, r.offensiveRebound),
  }
}

/** Ratings-fit tilt: ~0.4–3 per specialty from how far its pillar sits above the player's average pillar. */
function fitOf(r: Ratings): Record<PlayStyle, number> {
  const s = pillarScores(r)
  const vals = [s.smart, s.offense, s.power, s.defensive]
  const mean = avg(...vals)
  const spread = Math.max(...vals) - Math.min(...vals)
  const f = (x: number) => clamp(Math.exp((x - mean) / 10), 0.4, 3)
  return {
    smart: f(s.smart),
    offense: f(s.offense),
    power: f(s.power),
    defensive: f(s.defensive),
    allAround: clamp(1 + (10 - spread) / 20, 0.6, 1.4),
  }
}

/** Normalized probabilities (sum 1) of each style for this position and ratings. */
export function styleOdds(pos: Position, r: Ratings): Record<PlayStyle, number> {
  const fit = fitOf(r)
  const base = POSITION_ODDS[pos] ?? POSITION_ODDS.SF
  const w = {} as Record<PlayStyle, number>
  let total = 0
  for (const s of PLAY_STYLES) {
    const v = base[s] * fit[s]
    w[s] = Number.isFinite(v) && v > 0 ? v : 0
    total += w[s]
  }
  if (!(total > 0)) {
    for (const s of PLAY_STYLES) w[s] = base[s] / 100
    return w
  }
  for (const s of PLAY_STYLES) w[s] /= total
  return w
}

/** Integer hash (murmur3 finalizer) → uniform 32-bit value. */
function mix32(x: number): number {
  let h = x >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** Deterministic weighted pick from `styleOdds`, seeded by an integer (never the league Rng). */
export function rollPlayStyle(pos: Position, r: Ratings, seed: number): PlayStyle {
  const odds = styleOdds(pos, r)
  const u = mix32((seed ^ 0x5ca1ab1e) >>> 0) / 2 ** 32
  let acc = 0
  for (const s of PLAY_STYLES) {
    acc += odds[s]
    if (u < acc) return s
  }
  return PLAY_STYLES[PLAY_STYLES.length - 1]
}

/** FNV-1a 32-bit hash of a string (migration seeds from player ids). */
export function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
