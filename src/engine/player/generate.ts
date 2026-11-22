import { COLLEGES, FIRST_NAMES, HOMETOWNS, LAST_NAMES } from '../data/names'
import type { Rng } from '../rng'
import type { Player, Position, Ratings } from '../types'
import { RATING_KEYS, computeOvr } from './ratings'

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

type Offs = Partial<Record<keyof Ratings, number>>
// Archetype offsets relative to the player's talent level.
const ARCHETYPE: Record<Position, Offs> = {
  PG: { pass: 12, handle: 12, three: 5, stl: 5, ins: -5, oreb: -20, intD: -15, blk: -20, dreb: -15 },
  SG: { three: 10, mid: 6, handle: 5, perD: 3, oreb: -15, intD: -10, blk: -15, dreb: -10 },
  SF: { ath: 4, perD: 4, mid: 2, oreb: -5, blk: -5 },
  PF: { ins: 6, oreb: 10, dreb: 10, intD: 8, blk: 6, three: -8, handle: -10, pass: -5, stl: -5 },
  C: { ins: 10, oreb: 15, intD: 12, blk: 15, dreb: 15, three: -20, handle: -20, pass: -10, perD: -8, stl: -8, ft: -8 },
}
const HEIGHT: Record<Position, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** Every individual rating lives in 40..99. */
export const RATING_MIN = 40

export function generatePlayer(
  rng: Rng,
  opts: { season: number; age?: number; targetOvr?: number; pos?: Position },
): Player {
  const pos = opts.pos ?? rng.pick(POSITIONS)
  const target = opts.targetOvr ?? clamp(Math.round(rng.normal(70, 8)), 50, 95)
  const age = opts.age ?? clamp(Math.round(rng.normal(26, 4)), 19, 36)
  const arche = ARCHETYPE[pos]

  const raw = {} as Record<keyof Ratings, number>
  for (const k of RATING_KEYS) raw[k] = target + (arche[k] ?? 0) + rng.normal(0, 8)
  const ratings = {} as Ratings
  const fill = (shift: number) => {
    for (const k of RATING_KEYS) ratings[k] = clamp(Math.round(raw[k] + shift), RATING_MIN, 99)
  }
  // Shift all ratings until the OVR lands on the target.
  let shift = 0
  fill(shift)
  for (let i = 0; i < 25; i++) {
    const d = target - computeOvr(ratings, pos)
    if (d === 0) break
    shift += d
    fill(shift)
  }
  const ovr = computeOvr(ratings, pos)
  const pot = clamp(Math.max(ovr, Math.round(ovr + rng.normal(Math.max(0, 27 - age) * 1.6, 4))), ovr, 99)

  return {
    id: rng.id('p_'),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    heightIn: Math.round(rng.normal(HEIGHT[pos], 2)),
    pos,
    jersey: rng.int(0, 99),
    hometown: rng.pick(HOMETOWNS),
    college: rng.pick(COLLEGES),
    ratings,
    pot,
    faceSeed: rng.int(1, 2 ** 31 - 1),
    teamId: null,
    contract: null,
    injury: null,
    morale: 60,
    draft: null,
    ratingHistory: [{ season: opts.season, ovr }],
  }
}
