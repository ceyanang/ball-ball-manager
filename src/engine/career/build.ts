import { RATING_KEYS, RATING_MAX, POSITION_WEIGHTS } from '../player/ratings'
import { archetypeFor } from '../player/archetype'
import { CAREER_FLOOR, progressOf } from './careerOvr'
import type { Player, Position, Ratings } from '../types'
import type { CareerBuild } from './types'

export { START_OVR, CAREER_FLOOR } from './careerOvr'
export const START_FRACTION = 0.67
/** Points spent above the 40 floor across all 36 maxes; every template spends it exactly. */
export const BUILD_BUDGET = 960

export interface BuildTemplate { id: string; label: string; pos: Position; max: Ratings }

export const buildCost = (max: Ratings): number => RATING_KEYS.reduce((s, k) => s + (max[k] - CAREER_FLOOR), 0)

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
  for (const k of RATING_KEYS) r[k] = Math.round(CAREER_FLOOR + fraction * (max[k] - CAREER_FLOOR))
  return r
}

/** Lifts a (possibly older, 25-floor) build and its current ratings onto the 40 floor; idempotent. */
export function liftToFloor(p: Player): void {
  const b = p.careerBuild
  if (!b) return
  let changed = false
  for (const k of RATING_KEYS) {
    if (b.max[k] < CAREER_FLOOR) { b.max[k] = CAREER_FLOOR; changed = true }
    if (p.ratings[k] < CAREER_FLOOR) { p.ratings[k] = CAREER_FLOOR; changed = true }
  }
  if (changed) b.startProgress = progressOf(startRatings(b.max, b.startFraction), b.max, p.pos)
}

export function makeBuild(max: Ratings, pos: Position): CareerBuild {
  const start = startRatings(max)
  return {
    max: { ...max }, startFraction: START_FRACTION, startProgress: progressOf(start, max, pos),
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
    for (const k of RATING_KEYS) r[k] = Math.max(CAREER_FLOOR, Math.min(RATING_MAX, Math.round(CAREER_FLOOR + s * desire[k])))
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
  for (const k of RATING_KEYS) desire[k] = (k === 'intangibles' ? 3 : Math.max(w[k], 1)) + (d.add[k] ?? 0)
  return { id: d.id, label: d.label, pos: d.pos, max: fit(desire, BUILD_BUDGET) }
})
