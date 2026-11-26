import { COLLEGES, FIRST_NAMES, HOMETOWNS, LAST_NAMES } from '../data/names'
import type { Rng } from '../rng'
import type { Player, Position, Ratings } from '../types'
import { RATING_KEYS, RATING_MAX, RATING_MIN, computeOvr } from './ratings'
import { pickJersey } from './jerseyNumber'

export { RATING_MIN }
export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

type Offs = Partial<Record<keyof Ratings, number>>

/** Archetype offsets relative to the player's talent level (on the 25–99 scale). */
const ARCHETYPE: Record<Position, Offs> = {
  PG: {
    passAccuracy: 12, ballHandle: 13, speedWithBall: 13, passIQ: 10, passVision: 11,
    threePointShot: 5, midRangeShot: 4, freeThrow: 7, layup: 5, closeShot: 2,
    speed: 10, agility: 10, perimeterDefense: 4, steal: 5, passPerception: 4,
    standingDunk: -32, drivingDunk: -12, postHook: -32, postFade: -18, postControl: -26,
    interiorDefense: -24, block: -28, offensiveRebound: -28, defensiveRebound: -18, strength: -18,
  },
  SG: {
    threePointShot: 10, midRangeShot: 7, freeThrow: 6, layup: 4, drivingDunk: 4,
    ballHandle: 5, speedWithBall: 5, perimeterDefense: 4, steal: 3, speed: 6, agility: 6,
    standingDunk: -25, postHook: -28, postFade: -8, postControl: -18,
    interiorDefense: -18, block: -22, offensiveRebound: -22, defensiveRebound: -12, strength: -10,
  },
  SF: {
    layup: 4, drivingDunk: 5, threePointShot: 2, midRangeShot: 2,
    perimeterDefense: 4, helpDefenseIQ: 3, speed: 4, agility: 4, vertical: 4,
    postHook: -16, standingDunk: -8, postControl: -8, block: -8, offensiveRebound: -8,
  },
  PF: {
    closeShot: 6, standingDunk: 10, drivingDunk: 3, postHook: 8, postFade: 5, postControl: 8,
    strength: 10, interiorDefense: 9, block: 8, helpDefenseIQ: 5,
    offensiveRebound: 11, defensiveRebound: 11, hands: 5, hustle: 4,
    threePointShot: -10, freeThrow: -4, ballHandle: -15, speedWithBall: -15,
    passAccuracy: -6, passVision: -8, speed: -8, agility: -8, steal: -7, perimeterDefense: -6,
  },
  C: {
    closeShot: 10, standingDunk: 16, postHook: 14, postFade: 4, postControl: 12, hands: 8,
    strength: 15, interiorDefense: 14, block: 16, helpDefenseIQ: 8,
    offensiveRebound: 16, defensiveRebound: 16, hustle: 5,
    threePointShot: -26, midRangeShot: -12, freeThrow: -10,
    ballHandle: -28, speedWithBall: -28, passAccuracy: -12, passVision: -14,
    perimeterDefense: -16, steal: -14, speed: -16, agility: -16, drivingDunk: -4,
  },
}

const HEIGHT: Record<Position, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function generatePlayer(
  rng: Rng,
  opts: { season: number; age?: number; targetOvr?: number; pos?: Position },
): Player {
  const pos = opts.pos ?? rng.pick(POSITIONS)
  const target = opts.targetOvr ?? clamp(Math.round(rng.normal(70, 8)), 50, 95)
  const age = opts.age ?? clamp(Math.round(rng.normal(26, 4)), 19, 36)
  const arche = ARCHETYPE[pos]

  const raw = {} as Record<keyof Ratings, number>
  for (const k of RATING_KEYS) raw[k] = target + (arche[k] ?? 0) + rng.normal(0, 8.5)
  // Keep durability in a healthy realistic band around ~74 so random low rolls don't cripple half the league.
  raw.overallDurability = clamp(Math.round(74 + rng.normal(0, 10) - Math.max(0, age - 30) * 1.2), 45, 98)

  const ratings = {} as Ratings
  const fill = (shift: number) => {
    for (const k of RATING_KEYS) ratings[k] = clamp(Math.round(raw[k] + shift), RATING_MIN, RATING_MAX)
  }
  // Shift all ratings until the position-weighted OVR lands on the target.
  let shift = 0
  fill(shift)
  for (let i = 0; i < 40; i++) {
    const d = target - computeOvr(ratings, pos)
    if (d === 0) break
    shift += d
    fill(shift)
  }
  const ovr = computeOvr(ratings, pos)
  const pot = clamp(Math.max(ovr, Math.round(ovr + rng.normal(Math.max(0, 24 - age) * 0.85, 2.8))), ovr, 99)

  return {
    id: rng.id('p_'),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    age,
    heightIn: Math.round(rng.normal(HEIGHT[pos], 2)),
    pos,
    jersey: pickJersey(rng),
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
