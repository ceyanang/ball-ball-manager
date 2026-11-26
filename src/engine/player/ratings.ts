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

type W = Record<keyof Ratings, number>

export const POSITION_WEIGHTS: Record<Position, W> = {
  PG: {
    closeShot: 1.4, midRangeShot: 1.7, threePointShot: 2.3, freeThrow: 0.8, shotIQ: 2.0, offensiveConsistency: 1.8,
    layup: 2.0, standingDunk: 0.1, drivingDunk: 0.6, postHook: 0.1, postFade: 0.3, postControl: 0.2, drawFoul: 1.2, hands: 1.2,
    passAccuracy: 3.0, ballHandle: 3.2, speedWithBall: 3.0, passIQ: 2.5, passVision: 2.6,
    interiorDefense: 0.3, perimeterDefense: 2.2, steal: 1.6, block: 0.2, helpDefenseIQ: 0.8, passPerception: 1.4, defensiveConsistency: 1.5,
    offensiveRebound: 0.2, defensiveRebound: 0.5,
    speed: 2.4, agility: 2.4, strength: 0.4, vertical: 0.8, stamina: 1.0, hustle: 1.0, overallDurability: 0.6,
    intangibles: 1.2,
  },
  SG: {
    closeShot: 1.6, midRangeShot: 2.3, threePointShot: 3.2, freeThrow: 0.9, shotIQ: 2.0, offensiveConsistency: 2.0,
    layup: 2.0, standingDunk: 0.2, drivingDunk: 1.4, postHook: 0.2, postFade: 0.7, postControl: 0.4, drawFoul: 1.3, hands: 1.3,
    passAccuracy: 1.5, ballHandle: 2.2, speedWithBall: 2.0, passIQ: 1.4, passVision: 1.3,
    interiorDefense: 0.4, perimeterDefense: 2.3, steal: 1.4, block: 0.3, helpDefenseIQ: 1.0, passPerception: 1.4, defensiveConsistency: 1.7,
    offensiveRebound: 0.3, defensiveRebound: 0.6,
    speed: 2.2, agility: 2.2, strength: 0.6, vertical: 1.5, stamina: 1.0, hustle: 1.0, overallDurability: 0.6,
    intangibles: 1.2,
  },
  SF: {
    closeShot: 1.8, midRangeShot: 1.9, threePointShot: 2.2, freeThrow: 0.7, shotIQ: 1.8, offensiveConsistency: 1.8,
    layup: 2.1, standingDunk: 0.7, drivingDunk: 1.8, postHook: 0.4, postFade: 1.0, postControl: 0.8, drawFoul: 1.3, hands: 1.4,
    passAccuracy: 1.2, ballHandle: 1.3, speedWithBall: 1.3, passIQ: 1.2, passVision: 1.1,
    interiorDefense: 1.2, perimeterDefense: 2.2, steal: 1.2, block: 0.7, helpDefenseIQ: 1.6, passPerception: 1.2, defensiveConsistency: 1.8,
    offensiveRebound: 0.8, defensiveRebound: 1.3,
    speed: 2.0, agility: 2.0, strength: 1.2, vertical: 1.8, stamina: 1.0, hustle: 1.2, overallDurability: 0.6,
    intangibles: 1.2,
  },
  PF: {
    closeShot: 2.4, midRangeShot: 1.4, threePointShot: 1.1, freeThrow: 0.6, shotIQ: 1.6, offensiveConsistency: 1.7,
    layup: 1.8, standingDunk: 1.8, drivingDunk: 1.5, postHook: 1.4, postFade: 1.4, postControl: 1.8, drawFoul: 1.4, hands: 1.6,
    passAccuracy: 0.9, ballHandle: 0.6, speedWithBall: 0.6, passIQ: 0.9, passVision: 0.7,
    interiorDefense: 2.4, perimeterDefense: 1.2, steal: 0.6, block: 1.6, helpDefenseIQ: 1.8, passPerception: 0.8, defensiveConsistency: 1.8,
    offensiveRebound: 1.8, defensiveRebound: 2.4,
    speed: 1.2, agility: 1.2, strength: 2.1, vertical: 1.8, stamina: 0.8, hustle: 1.3, overallDurability: 0.6,
    intangibles: 1.2,
  },
  C: {
    closeShot: 2.8, midRangeShot: 0.8, threePointShot: 0.5, freeThrow: 0.5, shotIQ: 1.6, offensiveConsistency: 1.6,
    layup: 1.6, standingDunk: 2.6, drivingDunk: 0.9, postHook: 2.2, postFade: 1.2, postControl: 2.4, drawFoul: 1.5, hands: 2.0,
    passAccuracy: 0.8, ballHandle: 0.3, speedWithBall: 0.3, passIQ: 0.9, passVision: 0.6,
    interiorDefense: 3.0, perimeterDefense: 0.6, steal: 0.4, block: 2.6, helpDefenseIQ: 2.2, passPerception: 0.7, defensiveConsistency: 2.0,
    offensiveRebound: 2.4, defensiveRebound: 3.0,
    speed: 0.7, agility: 0.7, strength: 2.5, vertical: 1.6, stamina: 0.8, hustle: 1.4, overallDurability: 0.6,
    intangibles: 1.2,
  },
}

const WEIGHT_SUM: Record<Position, number> = {
  PG: RATING_KEYS.reduce((s, k) => s + POSITION_WEIGHTS.PG[k], 0),
  SG: RATING_KEYS.reduce((s, k) => s + POSITION_WEIGHTS.SG[k], 0),
  SF: RATING_KEYS.reduce((s, k) => s + POSITION_WEIGHTS.SF[k], 0),
  PF: RATING_KEYS.reduce((s, k) => s + POSITION_WEIGHTS.PF[k], 0),
  C: RATING_KEYS.reduce((s, k) => s + POSITION_WEIGHTS.C[k], 0),
}

/** Position-weighted mean across all 36 ratings (including `intangibles`), clamped to 25..99 and rounded. */
export function computeOvr(r: Ratings, pos: Position): number {
  const w = POSITION_WEIGHTS[pos]
  let num = 0
  for (let i = 0; i < RATING_KEYS.length; i++) {
    const k = RATING_KEYS[i]
    num += r[k] * w[k]
  }
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(num / WEIGHT_SUM[pos])))
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
