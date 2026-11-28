import { RATING_KEYS, RATING_MAX, POSITION_WEIGHTS } from '../player/ratings'
import { archetypeFor } from '../player/archetype'
import { CAREER_FLOOR, progressOf } from './careerOvr'
import type { Player, Position, Ratings } from '../types'
import type { CareerBuild } from './types'

export { START_OVR, CAREER_FLOOR } from './careerOvr'
export const START_FRACTION = 0.5
/** Points spent above the 40 floor across the 35 maxes (intangibles is free, always 99); every template spends it exactly. */
export const BUILD_BUDGET = 1300

export interface BuildTemplate { id: string; label: string; pos: Position; max: Ratings }

/** The followed player's intangibles are always 99 and are never bought: they cost no build budget. */
export const CAREER_INTANGIBLES = RATING_MAX

export const buildCost = (max: Ratings): number => RATING_KEYS.reduce((s, k) => (k === 'intangibles' ? s : s + (max[k] - CAREER_FLOOR)), 0)

export function isValidBuild(max: Ratings): boolean {
  for (const k of RATING_KEYS) {
    const v = max[k]
    if (!Number.isFinite(v) || v < CAREER_FLOOR || v > RATING_MAX || !Number.isInteger(v)) return false
  }
  return buildCost(max) <= BUILD_BUDGET
}

/** Rounded 40 + fraction of the way to each max. */
export function startRatings(max: Ratings, fraction: number = START_FRACTION): Ratings {
  const r = {} as Ratings
  for (const k of RATING_KEYS) r[k] = k === 'intangibles' ? CAREER_INTANGIBLES : Math.round(CAREER_FLOOR + fraction * (max[k] - CAREER_FLOOR))
  return r
}

/**
 * Moves an older 25-floor build onto the 40 floor (idempotent: builds marked `floor: 40` are left alone). Ratings and
 * maxes below 40 are raised, and the draft-day baseline is re-measured from what he really started with under the old
 * formula (lifted to 40), so his Career OVR keeps meaning "growth since draft night".
 */
export function liftToFloor(p: Player): void {
  const b = p.careerBuild
  if (!b || b.floor === CAREER_FLOOR) return
  const OLD_FLOOR = 25
  const oldStart = {} as Ratings
  for (const k of RATING_KEYS) {
    oldStart[k] = Math.max(CAREER_FLOOR, Math.round(OLD_FLOOR + b.startFraction * (b.max[k] - OLD_FLOOR)))
    b.max[k] = Math.max(CAREER_FLOOR, b.max[k])
    p.ratings[k] = Math.max(CAREER_FLOOR, p.ratings[k])
  }
  b.startProgress = progressOf(oldStart, b.max, p.pos)
  b.floor = CAREER_FLOOR
}

/**
 * Moves an older build onto the current BUILD_BUDGET (idempotent: builds marked with it are left alone). Every rating
 * but intangibles, and its max, is stretched away from the 40 floor by the same factor, so he keeps his shape and his
 * progress, and the draft-night anchor moves to START_FRACTION so his Career OVR reads his real strength.
 */
export function rebudgetBuild(p: Player): void {
  const b = p.careerBuild
  if (!b || b.budget === BUILD_BUDGET) return
  const cost = buildCost(b.max)
  if (cost > 0) {
    const s = BUILD_BUDGET / cost
    const up = (v: number) => Math.max(CAREER_FLOOR, Math.min(RATING_MAX, Math.round(CAREER_FLOOR + (v - CAREER_FLOOR) * s)))
    for (const k of RATING_KEYS) {
      if (k === 'intangibles') continue
      b.max[k] = up(b.max[k])
      p.ratings[k] = Math.min(b.max[k], up(p.ratings[k]))
    }
  }
  b.max.intangibles = RATING_MAX
  p.ratings.intangibles = RATING_MAX
  b.startFraction = START_FRACTION
  b.startProgress = progressOf(startRatings(b.max), b.max, p.pos)
  b.budget = BUILD_BUDGET
}

export function makeBuild(max: Ratings, pos: Position): CareerBuild {
  const start = startRatings(max)
  return {
    max: { ...max, intangibles: CAREER_INTANGIBLES }, startFraction: START_FRACTION, startProgress: progressOf(start, max, pos), floor: CAREER_FLOOR, budget: BUILD_BUDGET,
    archetype: archetypeFor({ ratings: max, pos } as Player),
  }
}

type Key = keyof Ratings
interface TemplateDef { id: string; label: string; pos: Position; add: Partial<Record<Key, number>> }

const DEFS: TemplateDef[] = [
  { id: 'floor-general', label: 'Floor General', pos: 'PG', add: { passAccuracy: 3, passVision: 3, passIQ: 3, ballHandle: 2, speedWithBall: 1 } },
  { id: 'shot-creator', label: 'Shot Creator', pos: 'PG', add: { threePointShot: 3, midRangeShot: 3, ballHandle: 3, shotIQ: 2, speedWithBall: 2 } },
  { id: 'sharpshooter', label: 'Sharpshooter', pos: 'SG', add: { threePointShot: 6, midRangeShot: 3, freeThrow: 3, shotIQ: 2, offensiveConsistency: 3 } },
  { id: 'slasher', label: 'Slasher', pos: 'SG', add: { layup: 4, drivingDunk: 4, speed: 3, vertical: 3, drawFoul: 3, speedWithBall: 2 } },
  { id: 'two-way-wing', label: 'Two-Way Wing', pos: 'SF', add: { perimeterDefense: 4, steal: 3, threePointShot: 2, layup: 1, defensiveConsistency: 2 } },
  { id: 'point-forward', label: 'Point Forward', pos: 'SF', add: { passAccuracy: 4, passVision: 4, passIQ: 3, ballHandle: 3 } },
  { id: 'stretch-four', label: 'Stretch Four', pos: 'PF', add: { threePointShot: 7, midRangeShot: 3, freeThrow: 2 } },
  { id: 'paint-beast', label: 'Paint Beast', pos: 'PF', add: { standingDunk: 3, strength: 3, offensiveRebound: 3, defensiveRebound: 2, interiorDefense: 1 } },
  { id: 'rim-protector', label: 'Rim Protector', pos: 'C', add: { block: 4, interiorDefense: 3, helpDefenseIQ: 3, vertical: 2 } },
  { id: 'stretch-five', label: 'Stretch Five', pos: 'C', add: { threePointShot: 12, midRangeShot: 4, freeThrow: 4, shotIQ: 2 } },
  { id: 'playmaking-big', label: 'Playmaking Big', pos: 'C', add: { passVision: 7, passIQ: 7, passAccuracy: 7, ballHandle: 5, shotIQ: 2 } },
]

/** Scale a desirability profile so its cost is exactly `budget` (bisection, then hand out the remainder). */
function fit(desire: Record<Key, number>, budget: number): Ratings {
  const at = (s: number) => {
    const r = {} as Ratings
    for (const k of RATING_KEYS) r[k] = k === 'intangibles' ? CAREER_INTANGIBLES : Math.max(CAREER_FLOOR, Math.min(RATING_MAX, Math.round(CAREER_FLOOR + s * desire[k])))
    return r
  }
  let lo = 0, hi = 100
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (buildCost(at(mid)) <= budget) lo = mid; else hi = mid
  }
  const r = at(lo)
  let left = budget - buildCost(r)
  const order = [...RATING_KEYS].sort((a, b) => desire[b] - desire[a])
  let guard = 0
  while (left > 0 && guard++ < 10000) {
    for (const k of order) {
      if (left <= 0) break
      if (r[k] < RATING_MAX) { r[k] += 1; left -= 1 }
    }
  }
  return r
}

export const BUILD_TEMPLATES: BuildTemplate[] = DEFS.map((d) => {
  const w = POSITION_WEIGHTS[d.pos]
  const desire = {} as Record<Key, number>
  for (const k of RATING_KEYS) desire[k] = k === 'intangibles' ? 0 : Math.max(w[k], 1) + (d.add[k] ?? 0)
  return { id: d.id, label: d.label, pos: d.pos, max: fit(desire, BUILD_BUDGET) }
})
