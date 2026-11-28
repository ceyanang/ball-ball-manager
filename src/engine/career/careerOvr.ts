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
    if (k === 'intangibles') continue // always 99 for the career player: never part of progress
    const span = max[k] - CAREER_FLOOR
    if (span <= 0) continue
    den += w[k]
    num += w[k] * clamp((cur[k] - CAREER_FLOOR) / span, 0, 1)
  }
  return den > 1e-9 ? num / den : 1
}

/**
 * The followed player's Career OVR, anchored to the real league formula: it is `computeOvr` of his ratings, rescaled
 * linearly so his draft-night ratings read START_OVR and his max build reads exactly 99. So a displayed 80 plays like an
 * 80 in this league (the max build itself is sized so its real OVR is about 96-99, i.e. the rescale is gentle).
 */
export function careerOvr(p: Player): number {
  const b = p.careerBuild
  if (!b) return computeOvr(p.ratings, p.pos)
  const start = {} as Ratings
  for (const k of RATING_KEYS) start[k] = k === 'intangibles' ? b.max[k] : Math.round(CAREER_FLOOR + b.startFraction * (b.max[k] - CAREER_FLOOR))
  const real0 = computeOvr(start, p.pos), real1 = computeOvr(b.max, p.pos), real = computeOvr(p.ratings, p.pos)
  if (real1 - real0 < 1) return progressOf(p.ratings, b.max, p.pos) >= 0.999 ? RATING_MAX : START_OVR
  const v = START_OVR + (RATING_MAX - START_OVR) * ((real - real0) / (real1 - real0))
  return Math.round(clamp(v, START_OVR - 10, RATING_MAX))
}

/** Overall at a lineup slot: the followed player's Career OVR (his slot fit is penalised by the caller), else the league formula at that slot. */
export const slotOvr = (p: Player, slot: Position): number => (p.careerBuild ? careerOvr(p) : computeOvr(p.ratings, slot))

/** The single overall seam: the followed player reads his Career OVR, everyone else the league formula. */
export const ovrOf = (p: Player): number => (p.careerBuild ? careerOvr(p) : computeOvr(p.ratings, p.pos))
