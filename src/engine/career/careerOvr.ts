import { RATING_KEYS, RATING_MAX, computeOvr, weightsForRatings } from '../player/ratings'
import type { Player, Position, Ratings } from '../types'

/** No MyCareer rating (start, max build or aged) ever sits below this — league players almost never do either. */
export const CAREER_FLOOR = 40

/** What a fresh 19-year-old MyCareer player reads. */
export const START_OVR = 68
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Weighted progress (0–1) of `cur` toward `max`; weights lean on the stats that define the build's archetype. */
export function progressOf(cur: Ratings, max: Ratings, pos: Position): number {
  const w = weightsForRatings(max, pos)
  let num = 0, den = 0
  for (const k of RATING_KEYS) {
    const span = max[k] - CAREER_FLOOR
    if (span <= 0) continue
    den += w[k]
    num += w[k] * clamp((cur[k] - CAREER_FLOOR) / span, 0, 1)
  }
  return den > 1e-9 ? num / den : 1
}

/** The followed player's Career OVR: START_OVR at the start, exactly 99 when his ratings equal his max build. */
export function careerOvr(p: Player): number {
  const b = p.careerBuild
  if (!b) return computeOvr(p.ratings, p.pos)
  const prog = progressOf(p.ratings, b.max, p.pos)
  if (b.startProgress >= 0.999) return prog >= 0.999 ? RATING_MAX : START_OVR
  const v = START_OVR + (RATING_MAX - START_OVR) * ((prog - b.startProgress) / (1 - b.startProgress))
  return Math.round(clamp(v, START_OVR - 10, RATING_MAX))
}

/** Overall at a lineup slot: the followed player's Career OVR (his slot fit is penalised by the caller), else the league formula at that slot. */
export const slotOvr = (p: Player, slot: Position): number => (p.careerBuild ? careerOvr(p) : computeOvr(p.ratings, slot))

/** The single overall seam: the followed player reads his Career OVR, everyone else the league formula. */
export const ovrOf = (p: Player): number => (p.careerBuild ? careerOvr(p) : computeOvr(p.ratings, p.pos))
