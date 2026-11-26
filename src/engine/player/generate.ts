import { COLLEGES, FIRST_NAMES, HOMETOWNS, LAST_NAMES } from '../data/names'
import type { Rng } from '../rng'
import type { Player, Position, Ratings } from '../types'
import { RATING_KEYS, RATING_MAX, RATING_MIN, computeOvr } from './ratings'
import { pickJersey } from './jerseyNumber'

export { RATING_MIN }
export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

type Offs = Partial<Record<keyof Ratings, number>>

/** Position-baseline offsets relative to the player's talent level (on the 25–99 scale). */
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

/** Secondary build flavours rolled per player so leagues produce authentic 2K archetypes (Stretch 5s, 3&D Wings, Slashers, etc.). */
const BUILD_FLAVOURS: Record<Position, { w: number; offs: Offs }[]> = {
  PG: [
    { w: 32, offs: { passAccuracy: 6, passVision: 6, passIQ: 5, ballHandle: 4, drivingDunk: -4, threePointShot: -2, steal: -2 } },
    { w: 26, offs: { threePointShot: 6, midRangeShot: 6, shotIQ: 4, ballHandle: 3, passVision: -3, perimeterDefense: -3 } },
    { w: 22, offs: { drivingDunk: 14, layup: 7, vertical: 8, drawFoul: 6, threePointShot: -7, passAccuracy: -4 } },
    { w: 20, offs: { perimeterDefense: 8, steal: 8, passPerception: 6, agility: 4, midRangeShot: -5, threePointShot: -2 } },
  ],
  SG: [
    { w: 30, offs: { threePointShot: 6, freeThrow: 4, shotIQ: 4, drivingDunk: -4, interiorDefense: -4, perimeterDefense: -2 } },
    { w: 25, offs: { midRangeShot: 7, ballHandle: 5, speedWithBall: 4, shotIQ: 4, threePointShot: -2, steal: -3 } },
    { w: 25, offs: { perimeterDefense: 8, steal: 7, passPerception: 6, threePointShot: 2, ballHandle: -6, midRangeShot: -4 } },
    { w: 20, offs: { drivingDunk: 11, layup: 6, vertical: 7, drawFoul: 6, threePointShot: -9, perimeterDefense: -3 } },
  ],
  SF: [
    { w: 28, offs: { threePointShot: 5, perimeterDefense: 7, steal: 5, passPerception: 5, postControl: -6, drivingDunk: -4 } },
    { w: 28, offs: { midRangeShot: 6, threePointShot: 2, layup: 4, drivingDunk: 4, helpDefenseIQ: -4, perimeterDefense: -3 } },
    { w: 22, offs: { passVision: 10, passAccuracy: 9, passIQ: 8, ballHandle: 9, speedWithBall: 8, threePointShot: -3, postHook: -6, perimeterDefense: -4 } },
    { w: 22, offs: { drivingDunk: 10, layup: 6, vertical: 6, drawFoul: 5, threePointShot: -7, passVision: -4 } },
  ],
  PF: [
    { w: 26, offs: { threePointShot: 14, midRangeShot: 8, freeThrow: 6, standingDunk: -6, postHook: -6, interiorDefense: -5, defensiveRebound: -5 } },
    { w: 26, offs: { standingDunk: 6, drivingDunk: 7, offensiveRebound: 5, defensiveRebound: 4, vertical: 5, threePointShot: -7, block: -4 } },
    { w: 24, offs: { postControl: 8, postHook: 9, postFade: 9, closeShot: 5, drawFoul: 4, threePointShot: -5, speed: -4, block: -4 } },
    { w: 24, offs: { interiorDefense: 7, block: 8, helpDefenseIQ: 6, defensiveRebound: 4, midRangeShot: -6, threePointShot: -4, closeShot: -4 } },
  ],
  C: [
    { w: 28, offs: { interiorDefense: 6, block: 8, helpDefenseIQ: 5, defensiveRebound: 3, postHook: -5, threePointShot: -5, closeShot: -4 } },
    { w: 25, offs: { standingDunk: 6, offensiveRebound: 5, defensiveRebound: 4, closeShot: 4, vertical: 4, threePointShot: -6, interiorDefense: -4, block: -4 } },
    { w: 22, offs: { postControl: 8, postHook: 9, postFade: 9, closeShot: 6, drawFoul: 5, threePointShot: -5, block: -5, defensiveRebound: -4 } },
    { w: 15, offs: { threePointShot: 28, midRangeShot: 15, freeThrow: 14, shotIQ: 5, standingDunk: -8, postHook: -8, interiorDefense: -4, offensiveRebound: -6 } },
    { w: 10, offs: { passVision: 22, passAccuracy: 20, passIQ: 18, ballHandle: 14, closeShot: 4, block: -7, threePointShot: -2, standingDunk: -5 } },
  ],
}

const HEIGHT: Record<Position, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function pickFlavour(pos: Position, seed: number): Offs {
  const list = BUILD_FLAVOURS[pos]
  let total = 0
  for (let i = 0; i < list.length; i++) total += list[i].w
  // Mix the already-rolled faceSeed deterministically so build flavours don't perturb the shared rng stream.
  const h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  let r = h % total
  for (let i = 0; i < list.length; i++) {
    r -= list[i].w
    if (r < 0) return list[i].offs
  }
  return list[0].offs
}

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
  const ovrPre = computeOvr(ratings, pos)
  const pot = clamp(Math.max(ovrPre, Math.round(ovrPre + rng.normal(Math.max(0, 24 - age) * 0.85, 2.8))), ovrPre, 99)

  const id = rng.id('p_')
  const firstName = rng.pick(FIRST_NAMES)
  const lastName = rng.pick(LAST_NAMES)
  const heightIn = Math.round(rng.normal(HEIGHT[pos], 2))
  const jersey = pickJersey(rng)
  const hometown = rng.pick(HOMETOWNS)
  const college = rng.pick(COLLEGES)
  const faceSeed = rng.int(1, 2 ** 31 - 1)

  const flavour = pickFlavour(pos, faceSeed)
  for (const k of RATING_KEYS) if (flavour[k]) raw[k] += flavour[k]!
  shift = 0
  fill(shift)
  for (let i = 0; i < 40; i++) {
    const d = target - computeOvr(ratings, pos)
    if (d === 0) break
    shift += d
    fill(shift)
  }
  const ovr = computeOvr(ratings, pos)
  const finalPot = clamp(Math.max(ovr, pot), ovr, 99)

  return {
    id,
    firstName,
    lastName,
    age,
    heightIn,
    pos,
    jersey,
    hometown,
    college,
    ratings,
    pot: finalPot,
    faceSeed,
    teamId: null,
    contract: null,
    injury: null,
    morale: 60,
    draft: null,
    ratingHistory: [{ season: opts.season, ovr }],
  }
}
