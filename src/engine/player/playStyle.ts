import type { Position, Ratings } from '../types'
import type { ArchetypeTendencies } from './archetype'

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

/**
 * Typical pillar scores per position (smart, offense, power, defensive), measured from generated leagues. The fit
 * compares a player to what is normal at his position, so the owner's chart stays the baseline mix.
 */
const POS_PILLAR_BASE: Record<Position, Record<Specialty, number>> = {
  PG: { smart: 74, offense: 75, power: 56, defensive: 55 },
  SG: { smart: 71, offense: 78, power: 62, defensive: 58 },
  SF: { smart: 69, offense: 73, power: 67, defensive: 65 },
  PF: { smart: 62, offense: 67, power: 76, defensive: 73 },
  C: { smart: 61, offense: 58, power: 71, defensive: 71 },
}

/** Ratings-fit tilt: 0.5–2 per specialty from how far its pillar beats the player's other pillars (vs position norm). */
function fitOf(pos: Position, r: Ratings): Record<PlayStyle, number> {
  const s = pillarScores(r)
  const base = POS_PILLAR_BASE[pos] ?? POS_PILLAR_BASE.SF
  const dev = {
    smart: s.smart - base.smart,
    offense: s.offense - base.offense,
    power: s.power - base.power,
    defensive: s.defensive - base.defensive,
  }
  const vals = [dev.smart, dev.offense, dev.power, dev.defensive]
  const mean = avg(...vals)
  const spread = Math.max(...vals) - Math.min(...vals)
  const f = (x: number) => clamp(Math.exp((x - mean) / 12), 0.5, 2)
  return {
    smart: f(dev.smart),
    offense: f(dev.offense),
    power: f(dev.power),
    defensive: f(dev.defensive),
    // Balanced profiles (no pillar standing out) lean All-Around.
    allAround: clamp(1 + (12 - spread) / 30, 0.7, 1.4),
  }
}

/** Normalized probabilities (sum 1) of each style for this position and ratings. */
export function styleOdds(pos: Position, r: Ratings): Record<PlayStyle, number> {
  const fit = fitOf(pos, r)
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

/**
 * Save migration: give every player lacking a valid style one rolled from his position + ratings, seeded by his
 * id (stable across reloads). Works on raw save data; skips anything malformed; never touches a valid style.
 */
export function backfillPlayStyles(raw: { players?: unknown }): void {
  const players = raw.players
  if (!players || typeof players !== 'object' || Array.isArray(players)) return
  for (const [id, p] of Object.entries(players as Record<string, unknown>)) {
    if (!p || typeof p !== 'object') continue
    const pl = p as { id?: unknown; pos?: unknown; ratings?: unknown; playStyle?: unknown }
    if (isPlayStyle(pl.playStyle)) continue
    if (!pl.ratings || typeof pl.ratings !== 'object') continue
    const pos = (typeof pl.pos === 'string' && pl.pos in POSITION_ODDS ? pl.pos : 'SF') as Position
    pl.playStyle = rollPlayStyle(pos, pl.ratings as Ratings, hashId(typeof pl.id === 'string' ? pl.id : id))
  }
}

/** Sim habits per style: multiplies the archetype tendencies and adds rebound weights and pace skill. */
export interface StyleHabits {
  /** Multipliers for [layup, driveDunk, standDunk, close, post, mid, three]. */
  zoneMult: [number, number, number, number, number, number, number]
  usageMult: number
  handlerMult: number
  passerMult: number
  tovDelta: number
  assistShareDelta: number
  foulDrawMult: number
  stealMult: number
  blockMult: number
  rebOffMult: number
  rebDefMult: number
  paceDelta: number
}

export const STYLE_HABITS: Record<PlayStyle, StyleHabits> = {
  smart: {
    zoneMult: [1, 1, 1, 1, 1, 1.04, 1], usageMult: 1, handlerMult: 1.1, passerMult: 1.25, tovDelta: -0.008,
    assistShareDelta: 0.03, foulDrawMult: 1, stealMult: 1.06, blockMult: 1, rebOffMult: 1, rebDefMult: 1, paceDelta: 0,
  },
  offense: {
    zoneMult: [1.06, 1.1, 0.9, 1, 0.85, 1, 1.2], usageMult: 1.06, handlerMult: 1.05, passerMult: 1, tovDelta: 0.002,
    assistShareDelta: 0, foulDrawMult: 1.04, stealMult: 1, blockMult: 0.97, rebOffMult: 0.95, rebDefMult: 0.95, paceDelta: 8,
  },
  allAround: {
    zoneMult: [1, 1, 1, 1, 1, 1, 1], usageMult: 1.02, handlerMult: 1.04, passerMult: 1.05, tovDelta: 0,
    assistShareDelta: 0, foulDrawMult: 1, stealMult: 1, blockMult: 1, rebOffMult: 1, rebDefMult: 1, paceDelta: 0,
  },
  power: {
    zoneMult: [1.1, 1.08, 1.2, 1.15, 1.3, 0.9, 0.7], usageMult: 1.04, handlerMult: 0.92, passerMult: 0.95, tovDelta: 0.002,
    assistShareDelta: 0, foulDrawMult: 1.12, stealMult: 0.97, blockMult: 1.08, rebOffMult: 1.15, rebDefMult: 1.05, paceDelta: -8,
  },
  defensive: {
    zoneMult: [1, 1, 1, 1, 1, 1, 1], usageMult: 0.94, handlerMult: 0.96, passerMult: 1, tovDelta: 0,
    assistShareDelta: 0, foulDrawMult: 1, stealMult: 1.2, blockMult: 1.2, rebOffMult: 1.1, rebDefMult: 1.2, paceDelta: 0,
  },
}

/** The archetype's tendencies with the style's habits applied (a new object; the input is never mutated). */
export function applyHabits(t: ArchetypeTendencies, style: PlayStyle): { t: ArchetypeTendencies; rebOffMult: number; rebDefMult: number; paceDelta: number } {
  const h = STYLE_HABITS[style] ?? STYLE_HABITS.allAround
  return {
    t: {
      zoneMult: t.zoneMult.map((z, i) => z * h.zoneMult[i]) as ArchetypeTendencies['zoneMult'],
      usageMult: t.usageMult * h.usageMult,
      handlerMult: t.handlerMult * h.handlerMult,
      passerMult: t.passerMult * h.passerMult,
      foulDrawMult: t.foulDrawMult * h.foulDrawMult,
      tovDelta: t.tovDelta + h.tovDelta,
      assistShareDelta: t.assistShareDelta + h.assistShareDelta,
      stealMult: t.stealMult * h.stealMult,
      blockMult: t.blockMult * h.blockMult,
    },
    rebOffMult: h.rebOffMult,
    rebDefMult: h.rebDefMult,
    paceDelta: h.paceDelta,
  }
}
