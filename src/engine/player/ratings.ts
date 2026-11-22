import type { Position, Ratings } from '../types'

export const RATING_KEYS: (keyof Ratings)[] = [
  'ins', 'mid', 'three', 'ft', 'pass', 'handle', 'oreb', 'perD', 'intD', 'stl', 'blk', 'dreb', 'ath', 'stam', 'iq',
]

type W = Record<keyof Ratings, number>
// prettier-ignore
export const POSITION_WEIGHTS: Record<Position, W> = {
  PG: { ins: 1, mid: 1.5, three: 2, ft: 0.5, pass: 3, handle: 3, oreb: 0.3, perD: 2, intD: 0.3, stl: 1.5, blk: 0.2, dreb: 0.5, ath: 2, stam: 0.7, iq: 2.5 },
  SG: { ins: 1.5, mid: 2, three: 3, ft: 0.7, pass: 1.5, handle: 2, oreb: 0.4, perD: 2, intD: 0.4, stl: 1.3, blk: 0.3, dreb: 0.6, ath: 2, stam: 0.7, iq: 2 },
  SF: { ins: 2, mid: 1.8, three: 2, ft: 0.5, pass: 1.2, handle: 1.2, oreb: 0.8, perD: 2, intD: 1, stl: 1, blk: 0.6, dreb: 1.2, ath: 2.2, stam: 0.7, iq: 2 },
  PF: { ins: 2.5, mid: 1.3, three: 1, ft: 0.4, pass: 0.8, handle: 0.6, oreb: 1.6, perD: 1, intD: 2.2, stl: 0.6, blk: 1.3, dreb: 2.2, ath: 2, stam: 0.6, iq: 1.8 },
  C: { ins: 3, mid: 0.8, three: 0.5, ft: 0.3, pass: 0.7, handle: 0.3, oreb: 2.2, perD: 0.5, intD: 3, stl: 0.4, blk: 2.2, dreb: 2.8, ath: 2, stam: 0.5, iq: 1.8 },
}

/** Position-weighted mean of ratings, rounded. */
export function computeOvr(r: Ratings, pos: Position): number {
  const w = POSITION_WEIGHTS[pos]
  let num = 0
  let den = 0
  for (const k of RATING_KEYS) {
    num += r[k] * w[k]
    den += w[k]
  }
  return Math.round(num / den)
}
