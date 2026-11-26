import type { Position, Ratings } from '../types'

/** Every individual attribute lives on the NBA 2K 25–99 scale. */
export const RATING_MIN = 25
export const RATING_MAX = 99

export type RatingGroupName =
  | 'Outside Scoring'
  | 'Inside Scoring'
  | 'Playmaking'
  | 'Defense'
  | 'Rebounding'
  | 'Athleticism'
  | 'Mental / Misc'

export const RATING_GROUPS: [RatingGroupName, [keyof Ratings, string][]][] = [
  ['Outside Scoring', [
    ['closeShot', 'Close shot'],
    ['midRangeShot', 'Mid-range'],
    ['threePointShot', 'Three-point'],
    ['freeThrow', 'Free throw'],
    ['shotIQ', 'Shot IQ'],
    ['offensiveConsistency', 'Off. consistency'],
  ]],
  ['Inside Scoring', [
    ['layup', 'Layup'],
    ['standingDunk', 'Standing dunk'],
    ['drivingDunk', 'Driving dunk'],
    ['postHook', 'Post hook'],
    ['postFade', 'Post fade'],
    ['postControl', 'Post control'],
    ['drawFoul', 'Draw foul'],
    ['hands', 'Hands'],
  ]],
  ['Playmaking', [
    ['passAccuracy', 'Pass accuracy'],
    ['ballHandle', 'Ball handle'],
    ['speedWithBall', 'Speed w/ ball'],
    ['passIQ', 'Pass IQ'],
    ['passVision', 'Pass vision'],
  ]],
  ['Defense', [
    ['interiorDefense', 'Interior defense'],
    ['perimeterDefense', 'Perimeter defense'],
    ['steal', 'Steal'],
    ['block', 'Block'],
    ['helpDefenseIQ', 'Help defense IQ'],
    ['passPerception', 'Pass perception'],
    ['defensiveConsistency', 'Def. consistency'],
  ]],
  ['Rebounding', [
    ['offensiveRebound', 'Offensive rebound'],
    ['defensiveRebound', 'Defensive rebound'],
  ]],
  ['Athleticism', [
    ['speed', 'Speed'],
    ['agility', 'Agility'],
    ['strength', 'Strength'],
    ['vertical', 'Vertical'],
    ['stamina', 'Stamina'],
    ['hustle', 'Hustle'],
    ['overallDurability', 'Durability'],
  ]],
  ['Mental / Misc', [
    ['intangibles', 'Intangibles'],
  ]],
]

export const RATING_KEYS: (keyof Ratings)[] = RATING_GROUPS.flatMap(([, entries]) => entries.map(([k]) => k))

export const RATING_LABELS: Record<keyof Ratings, string> = Object.fromEntries(
  RATING_GROUPS.flatMap(([, entries]) => entries),
) as Record<keyof Ratings, string>

export const SKILL_KEYS: (keyof Ratings)[] = RATING_KEYS.filter((k) => k !== 'intangibles')

export type PillarKey =
  | 'shooting'
  | 'finishing'
  | 'playmaking'
  | 'perimeterDefense'
  | 'interiorDefense'
  | 'rebounding'

export type PillarScores = Record<PillarKey, number>

export const PILLAR_KEYS: readonly PillarKey[] = [
  'shooting',
  'finishing',
  'playmaking',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
]

export const PILLAR_LABELS: Record<PillarKey, string> = {
  shooting: 'Shooting',
  finishing: 'Finishing / Post',
  playmaking: 'Playmaking',
  perimeterDefense: 'Perimeter D',
  interiorDefense: 'Interior D',
  rebounding: 'Rebounding',
}

export type SfWingRole = 'wingScorer' | 'pointForward' | 'threeAndD' | 'slashingWing'

export const SF_WING_ROLES: readonly SfWingRole[] = [
  'wingScorer',
  'pointForward',
  'threeAndD',
  'slashingWing',
]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const roundRating = (v: number) => clamp(Math.round(v), 0, 99)
const isBigPos = (pos: Position) => pos === 'PF' || pos === 'C'

/** Computes the 6 NBA 2K pillar scores (0–99 weighted averages) directly from the 36 attributes. */
export function computePillars(r: Ratings, pos: Position): PillarScores {
  const big = isBigPos(pos)

  const shooting = roundRating(
    r.threePointShot * 0.42 +
      r.midRangeShot * 0.28 +
      r.shotIQ * 0.18 +
      r.freeThrow * 0.12,
  )

  const finishing = big
    ? roundRating(
        r.closeShot * 0.22 +
          r.standingDunk * 0.20 +
          r.postControl * 0.13 +
          r.layup * 0.11 +
          r.drivingDunk * 0.11 +
          r.postHook * 0.10 +
          r.drawFoul * 0.08 +
          r.postFade * 0.05,
      )
    : roundRating(
        r.layup * 0.30 +
          r.drivingDunk * 0.24 +
          r.closeShot * 0.22 +
          r.drawFoul * 0.14 +
          r.postFade * 0.04 +
          r.postControl * 0.03 +
          r.standingDunk * 0.02 +
          r.postHook * 0.01,
      )

  const playmaking = big
    ? roundRating(
        r.passAccuracy * 0.30 +
          r.passVision * 0.30 +
          r.passIQ * 0.22 +
          r.ballHandle * 0.10 +
          r.speedWithBall * 0.08,
      )
    : roundRating(
        r.ballHandle * 0.22 +
          r.passAccuracy * 0.22 +
          r.passVision * 0.22 +
          r.speedWithBall * 0.18 +
          r.passIQ * 0.16,
      )

  const perimeterDefense = roundRating(
    r.perimeterDefense * 0.36 +
      r.steal * 0.20 +
      r.agility * 0.16 +
      r.passPerception * 0.16 +
      r.defensiveConsistency * 0.12,
  )

  const interiorDefense = roundRating(
    r.interiorDefense * 0.34 +
      r.block * 0.26 +
      r.helpDefenseIQ * 0.18 +
      r.strength * 0.12 +
      r.vertical * 0.10,
  )

  const rebounding = roundRating(
    r.defensiveRebound * 0.38 +
      r.offensiveRebound * 0.28 +
      r.hustle * 0.14 +
      r.strength * 0.10 +
      r.vertical * 0.10,
  )

  return { shooting, finishing, playmaking, perimeterDefense, interiorDefense, rebounding }
}

/**
 * Detects an SF's specialized wing sub-role purely from their 36 attributes and 6 pillars:
 * - `wingScorer`: Shooting + Finishing (3-Level Scorer / Shot Creator)
 * - `pointForward`: Playmaking alongside Finishing or Shooting
 * - `threeAndD`: Perimeter Defense + Shooting (3&D / Two-Way Wing)
 * - `slashingWing`: Finishing + Physicals/Defense (Slashing / Athletic Wing)
 */
export function detectSfWingRole(r: Ratings, precomputed?: PillarScores): SfWingRole {
  const shooting = precomputed
    ? precomputed.shooting
    : roundRating(r.threePointShot * 0.42 + r.midRangeShot * 0.28 + r.shotIQ * 0.18 + r.freeThrow * 0.12)
  const finishing = precomputed
    ? precomputed.finishing
    : roundRating(
        r.layup * 0.30 +
          r.drivingDunk * 0.24 +
          r.closeShot * 0.22 +
          r.drawFoul * 0.14 +
          r.postFade * 0.04 +
          r.postControl * 0.03 +
          r.standingDunk * 0.02 +
          r.postHook * 0.01,
      )
  const playmaking = precomputed
    ? precomputed.playmaking
    : roundRating(
        r.ballHandle * 0.22 +
          r.passAccuracy * 0.22 +
          r.passVision * 0.22 +
          r.speedWithBall * 0.18 +
          r.passIQ * 0.16,
      )
  const perimeterDefense = precomputed
    ? precomputed.perimeterDefense
    : roundRating(
        r.perimeterDefense * 0.36 +
          r.steal * 0.20 +
          r.agility * 0.16 +
          r.passPerception * 0.16 +
          r.defensiveConsistency * 0.12,
      )
  const interiorDefense = precomputed
    ? precomputed.interiorDefense
    : roundRating(
        r.interiorDefense * 0.34 +
          r.block * 0.26 +
          r.helpDefenseIQ * 0.18 +
          r.strength * 0.12 +
          r.vertical * 0.10,
      )
  const offenseBest = Math.max(shooting, finishing)

  // Point Forward requires genuine playmaking vision/handle alongside scoring or finishing.
  const playGate = r.passVision >= 68 && r.passAccuracy >= 68 ? 0 : -8
  const pointForwardScore =
    playmaking * 0.58 + offenseBest * 0.28 + ((r.passVision + r.ballHandle) * 0.5) * 0.14 + playGate

  const defBlend = Math.max(perimeterDefense, perimeterDefense * 0.7 + interiorDefense * 0.3)
  const threeAndDScore =
    defBlend * 0.54 + (r.threePointShot * 0.6 + shooting * 0.4) * 0.46

  const wingScorerScore =
    shooting * 0.52 + finishing * 0.34 + ((r.midRangeShot + r.shotIQ) * 0.5) * 0.14

  const phys = r.vertical * 0.4 + r.strength * 0.3 + r.speed * 0.3
  const slashDefPhys = Math.max(perimeterDefense, phys) * 0.5 + phys * 0.5
  const slashingWingScore = finishing * 0.56 + slashDefPhys * 0.44

  let best: SfWingRole = 'wingScorer'
  let bestVal = wingScorerScore
  if (pointForwardScore > bestVal) { best = 'pointForward'; bestVal = pointForwardScore }
  if (threeAndDScore > bestVal) { best = 'threeAndD'; bestVal = threeAndDScore }
  if (slashingWingScore > bestVal) { best = 'slashingWing' }
  return best
}

export type WeightTable = Record<keyof Ratings, number>

/**
 * 100%-normalized weight pools across the 35 basketball/physical/mental skills (`intangibles` = 0 here,
 * applied separately as a subtle -2..+3 OVR modifier). Each table sums to exactly 100.0.
 */
export const SF_WING_WEIGHTS: Record<SfWingRole, WeightTable> = {
  wingScorer: {
    closeShot: 3.5, midRangeShot: 7.5, threePointShot: 8.5, freeThrow: 2.0, shotIQ: 6.0, offensiveConsistency: 6.0,
    layup: 6.5, standingDunk: 0.5, drivingDunk: 5.5, postHook: 0.4, postFade: 2.5, postControl: 2.0, drawFoul: 3.5, hands: 2.1,
    passAccuracy: 1.5, ballHandle: 4.5, speedWithBall: 3.5, passIQ: 1.0, passVision: 1.0,
    interiorDefense: 1.0, perimeterDefense: 4.5, steal: 1.5, block: 0.5, helpDefenseIQ: 1.5, passPerception: 1.5, defensiveConsistency: 2.5,
    offensiveRebound: 0.5, defensiveRebound: 2.0,
    speed: 4.0, agility: 4.0, strength: 1.8, vertical: 3.0, stamina: 1.5, hustle: 1.4, overallDurability: 0.8,
    intangibles: 0,
  },
  pointForward: {
    closeShot: 3.5, midRangeShot: 4.0, threePointShot: 5.0, freeThrow: 1.5, shotIQ: 4.0, offensiveConsistency: 3.5,
    layup: 6.0, standingDunk: 0.8, drivingDunk: 5.0, postHook: 0.4, postFade: 1.0, postControl: 1.3, drawFoul: 2.5, hands: 2.0,
    passAccuracy: 6.5, ballHandle: 7.0, speedWithBall: 6.0, passIQ: 5.0, passVision: 5.0,
    interiorDefense: 1.2, perimeterDefense: 3.8, steal: 1.5, block: 0.6, helpDefenseIQ: 1.5, passPerception: 1.4, defensiveConsistency: 2.0,
    offensiveRebound: 0.7, defensiveRebound: 2.8,
    speed: 3.5, agility: 3.5, strength: 2.0, vertical: 2.0, stamina: 1.5, hustle: 1.2, overallDurability: 0.8,
    intangibles: 0,
  },
  threeAndD: {
    closeShot: 2.0, midRangeShot: 2.5, threePointShot: 10.0, freeThrow: 1.5, shotIQ: 5.0, offensiveConsistency: 5.0,
    layup: 4.0, standingDunk: 0.4, drivingDunk: 3.5, postHook: 0.2, postFade: 0.4, postControl: 0.4, drawFoul: 1.6, hands: 2.0,
    passAccuracy: 2.0, ballHandle: 2.5, speedWithBall: 2.0, passIQ: 1.0, passVision: 1.0,
    interiorDefense: 2.0, perimeterDefense: 10.0, steal: 5.5, block: 1.5, helpDefenseIQ: 4.5, passPerception: 4.5, defensiveConsistency: 5.5,
    offensiveRebound: 0.6, defensiveRebound: 2.9,
    speed: 3.5, agility: 4.5, strength: 2.0, vertical: 2.0, stamina: 1.5, hustle: 1.7, overallDurability: 0.8,
    intangibles: 0,
  },
  slashingWing: {
    closeShot: 5.0, midRangeShot: 2.0, threePointShot: 2.5, freeThrow: 1.5, shotIQ: 2.5, offensiveConsistency: 2.0,
    layup: 9.0, standingDunk: 1.5, drivingDunk: 9.5, postHook: 0.3, postFade: 0.5, postControl: 1.2, drawFoul: 6.5, hands: 2.5,
    passAccuracy: 1.5, ballHandle: 3.5, speedWithBall: 3.0, passIQ: 1.0, passVision: 1.0,
    interiorDefense: 2.0, perimeterDefense: 6.0, steal: 2.5, block: 1.5, helpDefenseIQ: 2.5, passPerception: 1.5, defensiveConsistency: 3.0,
    offensiveRebound: 1.5, defensiveRebound: 3.0,
    speed: 4.5, agility: 4.5, strength: 3.0, vertical: 4.5, stamina: 1.2, hustle: 1.5, overallDurability: 0.8,
    intangibles: 0,
  },
}

export const C_STRETCH_WEIGHTS: WeightTable = {
  closeShot: 5.5, midRangeShot: 3.2, threePointShot: 6.5, freeThrow: 1.3, shotIQ: 3.2, offensiveConsistency: 1.5,
  layup: 1.5, standingDunk: 4.0, drivingDunk: 1.2, postHook: 1.5, postFade: 1.8, postControl: 2.5, drawFoul: 2.3, hands: 3.5,
  passAccuracy: 0.8, ballHandle: 0.2, speedWithBall: 0.2, passIQ: 0.6, passVision: 0.4,
  interiorDefense: 9.5, perimeterDefense: 0.4, steal: 0.3, block: 7.5, helpDefenseIQ: 6.0, passPerception: 0.8, defensiveConsistency: 6.0,
  offensiveRebound: 4.0, defensiveRebound: 10.0,
  speed: 0.8, agility: 0.8, strength: 6.0, vertical: 2.5, stamina: 0.9, hustle: 2.2, overallDurability: 0.6,
  intangibles: 0,
}

export const POSITION_WEIGHTS: Record<Position, WeightTable> = {
  PG: {
    closeShot: 2.5, midRangeShot: 4.5, threePointShot: 6.5, freeThrow: 1.5, shotIQ: 4.0, offensiveConsistency: 4.0,
    layup: 5.0, standingDunk: 0.1, drivingDunk: 1.0, postHook: 0.1, postFade: 0.4, postControl: 0.3, drawFoul: 2.0, hands: 1.6,
    passAccuracy: 7.5, ballHandle: 8.5, speedWithBall: 7.5, passIQ: 6.5, passVision: 7.0,
    interiorDefense: 0.2, perimeterDefense: 4.0, steal: 2.8, block: 0.2, helpDefenseIQ: 1.2, passPerception: 2.4, defensiveConsistency: 2.8,
    offensiveRebound: 0.2, defensiveRebound: 0.8,
    speed: 5.0, agility: 5.0, strength: 0.5, vertical: 0.8, stamina: 1.4, hustle: 1.4, overallDurability: 0.8,
    intangibles: 0,
  },
  SG: {
    closeShot: 3.0, midRangeShot: 6.5, threePointShot: 9.0, freeThrow: 2.0, shotIQ: 5.5, offensiveConsistency: 5.5,
    layup: 5.5, standingDunk: 0.2, drivingDunk: 4.5, postHook: 0.2, postFade: 1.2, postControl: 0.6, drawFoul: 2.5, hands: 1.8,
    passAccuracy: 2.5, ballHandle: 5.5, speedWithBall: 5.0, passIQ: 3.0, passVision: 3.0,
    interiorDefense: 0.4, perimeterDefense: 6.0, steal: 2.5, block: 0.3, helpDefenseIQ: 1.5, passPerception: 2.3, defensiveConsistency: 3.5,
    offensiveRebound: 0.3, defensiveRebound: 1.2,
    speed: 4.5, agility: 4.5, strength: 0.8, vertical: 2.0, stamina: 1.2, hustle: 1.2, overallDurability: 0.8,
    intangibles: 0,
  },
  // Balanced reference SF profile (used when no specific rating context is given; OVR always selects the detected SF wing sub-role).
  SF: {
    closeShot: 3.5, midRangeShot: 4.0, threePointShot: 6.5, freeThrow: 1.6, shotIQ: 4.4, offensiveConsistency: 4.1,
    layup: 6.4, standingDunk: 0.8, drivingDunk: 5.9, postHook: 0.3, postFade: 1.1, postControl: 1.2, drawFoul: 3.5, hands: 2.2,
    passAccuracy: 2.9, ballHandle: 4.4, speedWithBall: 3.6, passIQ: 2.0, passVision: 2.0,
    interiorDefense: 1.6, perimeterDefense: 6.1, steal: 2.8, block: 1.0, helpDefenseIQ: 2.5, passPerception: 2.2, defensiveConsistency: 3.2,
    offensiveRebound: 0.8, defensiveRebound: 2.7,
    speed: 3.9, agility: 4.1, strength: 2.2, vertical: 2.9, stamina: 1.4, hustle: 1.4, overallDurability: 0.8,
    intangibles: 0,
  },
  PF: {
    closeShot: 6.5, midRangeShot: 4.5, threePointShot: 2.8, freeThrow: 1.0, shotIQ: 3.2, offensiveConsistency: 2.0,
    layup: 2.0, standingDunk: 3.5, drivingDunk: 3.2, postHook: 1.8, postFade: 1.8, postControl: 3.2, drawFoul: 2.0, hands: 2.0,
    passAccuracy: 1.2, ballHandle: 0.8, speedWithBall: 0.7, passIQ: 1.0, passVision: 0.8,
    interiorDefense: 7.5, perimeterDefense: 3.2, steal: 1.0, block: 3.8, helpDefenseIQ: 5.5, passPerception: 1.5, defensiveConsistency: 5.0,
    offensiveRebound: 5.0, defensiveRebound: 7.5,
    speed: 1.8, agility: 1.8, strength: 5.0, vertical: 3.5, stamina: 1.0, hustle: 2.3, overallDurability: 0.6,
    intangibles: 0,
  },
  C: {
    closeShot: 7.0, midRangeShot: 1.2, threePointShot: 0.3, freeThrow: 0.5, shotIQ: 2.0, offensiveConsistency: 1.5,
    layup: 1.5, standingDunk: 7.0, drivingDunk: 1.2, postHook: 3.2, postFade: 1.8, postControl: 3.5, drawFoul: 2.3, hands: 3.5,
    passAccuracy: 0.8, ballHandle: 0.2, speedWithBall: 0.2, passIQ: 0.6, passVision: 0.4,
    interiorDefense: 9.5, perimeterDefense: 0.4, steal: 0.3, block: 7.5, helpDefenseIQ: 6.0, passPerception: 0.8, defensiveConsistency: 6.0,
    offensiveRebound: 6.5, defensiveRebound: 10.0,
    speed: 0.8, agility: 0.8, strength: 6.5, vertical: 2.5, stamina: 0.9, hustle: 2.2, overallDurability: 0.6,
    intangibles: 0,
  },
}

const CORE_WEIGHT_CUTOFF = 3.0

/**
 * Returns the 100%-normalized weight pool for `(r, pos)`, dispatching SFs to their detected
 * wing sub-role (`wingScorer`, `pointForward`, `threeAndD`, `slashingWing`) and smoothly shifting
 * Stretch Five centers toward perimeter shooting weights when `threePointShot` exceeds 68.
 */
export function weightsForRatings(r: Ratings, pos: Position): WeightTable {
  if (pos === 'SF') return SF_WING_WEIGHTS[detectSfWingRole(r)]
  if (pos === 'C') {
    if (r.threePointShot <= 68) return POSITION_WEIGHTS.C
    if (r.threePointShot >= 80) return C_STRETCH_WEIGHTS
    const t = (r.threePointShot - 68) / 12
    const base = POSITION_WEIGHTS.C
    const blended = {} as WeightTable
    for (const k of RATING_KEYS) blended[k] = base[k] * (1 - t) + C_STRETCH_WEIGHTS[k] * t
    return blended
  }
  return POSITION_WEIGHTS[pos]
}

function skillOvrFromWeights(r: Ratings, w: WeightTable): number {
  let wSum = 0
  let wNum = 0
  let coreSum = 0
  let coreNum = 0

  for (let i = 0; i < SKILL_KEYS.length; i++) {
    const k = SKILL_KEYS[i]
    const wk = w[k]
    const rk = r[k]
    wSum += wk
    wNum += rk * wk
    if (wk >= CORE_WEIGHT_CUTOFF) {
      coreSum += wk
      coreNum += rk * wk
    }
  }

  const wMean = wNum / wSum
  const coreMean = coreSum > 0 ? coreNum / coreSum : wMean

  // Non-linear top-end scaling: above 85, raw linear gains compress unless core attributes are genuinely elite.
  let skillOvr = wMean > 85 ? 85 + (wMean - 85) * 0.55 : wMean
  if (coreMean > 85 && wMean > 78) {
    const gate = Math.min(1, (wMean - 78) / 7)
    const x = (coreMean - 85) / 14
    skillOvr += gate * 12.0 * Math.pow(x, 1.35)
  }
  return skillOvr
}

/**
 * Position- & sub-role-weighted OVR calculator from the 36 attributes:
 * - Uses 100%-normalized weight pools per position (and SF wing sub-role / Stretch 5).
 * - Applies non-linear top-end scaling so reaching 94–99 requires elite core attributes, not inflated secondary stats.
 * - Applies `intangibles` (25–99) as a subtle final modifier (-2 to +3 OVR).
 */
export function calculatePlayerOVR(r: Ratings, pos: Position): number {
  let skillOvr: number
  if (pos === 'SF') {
    skillOvr = skillOvrFromWeights(r, SF_WING_WEIGHTS[detectSfWingRole(r)])
  } else if (pos === 'C') {
    if (r.threePointShot <= 68) {
      skillOvr = skillOvrFromWeights(r, POSITION_WEIGHTS.C)
    } else if (r.threePointShot >= 80) {
      skillOvr = skillOvrFromWeights(r, C_STRETCH_WEIGHTS)
    } else {
      const t = (r.threePointShot - 68) / 12
      skillOvr = skillOvrFromWeights(r, POSITION_WEIGHTS.C) * (1 - t) + skillOvrFromWeights(r, C_STRETCH_WEIGHTS) * t
    }
  } else {
    skillOvr = skillOvrFromWeights(r, POSITION_WEIGHTS[pos])
  }

  // Intangibles (25–99) acts as a subtle -2..+3 final OVR modifier.
  const intangMod = ((r.intangibles - 25) / 74) * 5 - 2

  return clamp(Math.round(skillOvr + intangMod), RATING_MIN, RATING_MAX)
}

/** Alias kept for existing engine & UI call sites. */
export const computeOvr = calculatePlayerOVR

/**
 * Realistic height-based attribute ceiling (on the 25–99 scale) for physical & interior ratings.
 * Keeps 5'11" guards from getting 92 blocks/standing dunks and 7'2" centers from getting 95 speed.
 */
export function heightMaxFor(heightIn: number, key: keyof Ratings): number {
  switch (key) {
    case 'standingDunk':
      return clamp(Math.round(50 + (heightIn - 71) * 4.5), 50, RATING_MAX)
    case 'block':
      return clamp(Math.round(60 + (heightIn - 71) * 4.0), 60, RATING_MAX)
    case 'postHook':
      return clamp(Math.round(58 + (heightIn - 71) * 4.0), 58, RATING_MAX)
    case 'interiorDefense':
      return clamp(Math.round(64 + (heightIn - 71) * 4.0), 64, RATING_MAX)
    case 'offensiveRebound':
      return clamp(Math.round(58 + (heightIn - 71) * 4.5), 58, RATING_MAX)
    case 'defensiveRebound':
      return clamp(Math.round(68 + (heightIn - 71) * 3.8), 68, RATING_MAX)
    case 'strength':
      return clamp(Math.round(76 + (heightIn - 71) * 3.2), 76, RATING_MAX)
    case 'speed':
    case 'agility':
      return clamp(Math.round(99 - Math.max(0, heightIn - 79) * 2.8), 76, RATING_MAX)
    case 'speedWithBall':
      return clamp(Math.round(99 - Math.max(0, heightIn - 79) * 2.6), 78, RATING_MAX)
    case 'vertical':
      return clamp(Math.round(99 - Math.max(0, heightIn - 82) * 2.5), 86, RATING_MAX)
    default:
      return RATING_MAX
  }
}

/** Average rating for a single UI category (rounded). */
export function groupAverage(r: Ratings, group: RatingGroupName): number {
  const entry = RATING_GROUPS.find(([name]) => name === group)
  if (!entry || !entry[1].length) return 0
  const keys = entry[1]
  let s = 0
  for (const [k] of keys) s += r[k]
  return Math.round(s / keys.length)
}
