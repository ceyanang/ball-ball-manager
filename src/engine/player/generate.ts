import { COLLEGES, HOMETOWNS, pickName } from '../data/names'
import { encodeHeritage, rollHeritage } from '../face/heritage'
import { Rng } from '../rng'
import type { Player, Position, Ratings } from '../types'
import { RATING_KEYS, RATING_MAX, RATING_MIN, SKILL_KEYS, calculatePlayerOVR, heightMaxFor } from './ratings'
import { pickJersey } from './jerseyNumber'
import { rollPlayStyle } from './playStyle'

export { RATING_MIN }
export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

type Key = keyof Ratings
type Offs = Partial<Record<Key, number>>

/** Position-specific realistic NBA height bounds in inches: [mean, min, max]. */
export const POSITION_HEIGHT_BOUNDS: Record<Position, readonly [number, number, number]> = {
  PG: [74, 71, 77],   // 5'11" - 6'5"
  SG: [77, 75, 80],   // 6'3" - 6'8"
  SF: [79, 77, 82],   // 6'5" - 6'10"
  PF: [81, 79, 83],   // 6'7" - 6'11"
  C:  [83.5, 81, 87], // 6'9" - 7'3"
}

/** Positional baseline offsets used to keep off-archetype stats realistic (e.g., PGs don't hook-shot, Cs don't dribble). */
const POS_BASE_OFFS: Record<Position, Offs> = {
  PG: {
    standingDunk: -28, drivingDunk: -10, postHook: -28, postFade: -16, postControl: -24,
    interiorDefense: -22, block: -26, offensiveRebound: -26, defensiveRebound: -14, strength: -16,
  },
  SG: {
    standingDunk: -22, postHook: -25, postFade: -6, postControl: -16,
    interiorDefense: -16, block: -20, offensiveRebound: -20, defensiveRebound: -10, strength: -8,
  },
  SF: {
    postHook: -18, standingDunk: -12, postControl: -10, block: -12, offensiveRebound: -12,
  },
  PF: {
    threePointShot: -10, freeThrow: -4, ballHandle: -16, speedWithBall: -16,
    passAccuracy: -8, passVision: -10, passIQ: -8, speed: -8, agility: -8, steal: -8, perimeterDefense: -8,
  },
  C: {
    threePointShot: -26, midRangeShot: -14, freeThrow: -10,
    ballHandle: -28, speedWithBall: -28, passAccuracy: -14, passVision: -16, passIQ: -12,
    perimeterDefense: -18, steal: -16, speed: -16, agility: -16, drivingDunk: -6,
  },
}

interface BuildTemplate {
  w: number
  core: readonly Key[]
  sec: readonly Key[]
  flawPool: readonly Key[]
  boost?: Offs
}

/**
 * Internal archetype templates per position. Core & secondary skills drive a player's target OVR quota,
 * while off-archetype attributes stay in a realistic 45–75 band and 1–3 genuine sim flaws are preserved.
 */
const BUILD_TEMPLATES: Record<Position, readonly BuildTemplate[]> = {
  PG: [
    {
      // Floor General
      w: 32,
      core: ['passAccuracy', 'passVision', 'passIQ', 'ballHandle', 'speedWithBall', 'speed', 'agility', 'layup', 'shotIQ', 'offensiveConsistency', 'threePointShot'],
      sec: ['midRangeShot', 'closeShot', 'freeThrow', 'drawFoul', 'hands', 'perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'helpDefenseIQ', 'stamina', 'hustle'],
      flawPool: ['midRangeShot', 'drivingDunk', 'perimeterDefense', 'steal', 'freeThrow', 'defensiveConsistency', 'threePointShot'],
    },
    {
      // Scoring / Shot-Creating PG
      w: 26,
      core: ['threePointShot', 'midRangeShot', 'shotIQ', 'offensiveConsistency', 'ballHandle', 'speedWithBall', 'layup', 'closeShot', 'speed', 'agility', 'passAccuracy'],
      sec: ['passVision', 'passIQ', 'freeThrow', 'drawFoul', 'hands', 'perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'helpDefenseIQ', 'stamina', 'hustle'],
      flawPool: ['passVision', 'perimeterDefense', 'steal', 'defensiveConsistency', 'drivingDunk', 'freeThrow'],
    },
    {
      // Slashing Playmaker PG
      w: 22,
      core: ['layup', 'drivingDunk', 'closeShot', 'drawFoul', 'ballHandle', 'speedWithBall', 'passAccuracy', 'passVision', 'speed', 'agility', 'vertical'],
      sec: ['passIQ', 'shotIQ', 'offensiveConsistency', 'hands', 'perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'freeThrow', 'stamina', 'hustle'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'perimeterDefense', 'defensiveConsistency'],
      boost: { drivingDunk: 12, vertical: 8 },
    },
    {
      // Two-Way Guard
      w: 20,
      core: ['perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'agility', 'speed', 'threePointShot', 'passAccuracy', 'ballHandle', 'speedWithBall', 'shotIQ'],
      sec: ['passVision', 'passIQ', 'layup', 'closeShot', 'offensiveConsistency', 'freeThrow', 'drawFoul', 'hands', 'helpDefenseIQ', 'stamina', 'hustle'],
      flawPool: ['midRangeShot', 'drivingDunk', 'drawFoul', 'passVision', 'freeThrow', 'offensiveConsistency'],
    },
  ],
  SG: [
    {
      // Sharpshooter
      w: 30,
      core: ['threePointShot', 'midRangeShot', 'freeThrow', 'shotIQ', 'offensiveConsistency', 'agility', 'speed', 'layup', 'closeShot', 'perimeterDefense'],
      sec: ['ballHandle', 'speedWithBall', 'passAccuracy', 'passIQ', 'passVision', 'drawFoul', 'hands', 'defensiveConsistency', 'passPerception', 'helpDefenseIQ', 'steal', 'vertical', 'stamina', 'hustle'],
      flawPool: ['drivingDunk', 'ballHandle', 'perimeterDefense', 'steal', 'passVision', 'drawFoul'],
    },
    {
      // Shot Creator / 3-Level Guard
      w: 25,
      core: ['midRangeShot', 'threePointShot', 'shotIQ', 'offensiveConsistency', 'ballHandle', 'speedWithBall', 'layup', 'closeShot', 'drivingDunk', 'speed', 'agility'],
      sec: ['freeThrow', 'drawFoul', 'hands', 'passAccuracy', 'passIQ', 'passVision', 'perimeterDefense', 'passPerception', 'defensiveConsistency', 'helpDefenseIQ', 'vertical', 'stamina', 'hustle'],
      flawPool: ['perimeterDefense', 'steal', 'defensiveConsistency', 'passVision', 'freeThrow'],
    },
    {
      // 3&D Guard
      w: 25,
      core: ['perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'threePointShot', 'shotIQ', 'agility', 'speed', 'helpDefenseIQ', 'offensiveConsistency'],
      sec: ['layup', 'closeShot', 'drivingDunk', 'freeThrow', 'hands', 'hustle', 'stamina', 'passAccuracy', 'passIQ', 'ballHandle', 'speedWithBall', 'vertical'],
      flawPool: ['ballHandle', 'speedWithBall', 'midRangeShot', 'drivingDunk', 'drawFoul', 'passVision'],
    },
    {
      // Slasher
      w: 20,
      core: ['drivingDunk', 'layup', 'closeShot', 'drawFoul', 'vertical', 'speed', 'agility', 'ballHandle', 'speedWithBall', 'offensiveConsistency'],
      sec: ['shotIQ', 'midRangeShot', 'freeThrow', 'hands', 'perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'helpDefenseIQ', 'passAccuracy', 'stamina', 'hustle'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'passVision', 'defensiveConsistency'],
      boost: { drivingDunk: 10, vertical: 8 },
    },
  ],
  SF: [
    {
      // Wing Shot Creator / 3-Level Scorer (low playmaking vision/IQ so 95 SF doesn't become an all-around PG)
      w: 28,
      core: ['threePointShot', 'midRangeShot', 'shotIQ', 'offensiveConsistency', 'layup', 'drivingDunk', 'closeShot', 'drawFoul', 'ballHandle', 'speed', 'agility'],
      sec: ['freeThrow', 'postFade', 'postControl', 'hands', 'speedWithBall', 'perimeterDefense', 'defensiveConsistency', 'helpDefenseIQ', 'passPerception', 'defensiveRebound', 'vertical', 'strength', 'stamina', 'hustle'],
      flawPool: ['perimeterDefense', 'steal', 'defensiveConsistency', 'defensiveRebound', 'freeThrow', 'passVision', 'passAccuracy'],
    },
    {
      // 3&D / Two-Way Wing
      w: 28,
      core: ['perimeterDefense', 'steal', 'passPerception', 'defensiveConsistency', 'helpDefenseIQ', 'threePointShot', 'shotIQ', 'offensiveConsistency', 'agility', 'speed', 'hustle'],
      sec: ['layup', 'drivingDunk', 'closeShot', 'freeThrow', 'hands', 'defensiveRebound', 'interiorDefense', 'block', 'strength', 'vertical', 'stamina', 'passAccuracy'],
      flawPool: ['ballHandle', 'speedWithBall', 'midRangeShot', 'drivingDunk', 'drawFoul', 'passVision'],
    },
    {
      // Point Forward
      w: 22,
      core: ['passAccuracy', 'passVision', 'passIQ', 'ballHandle', 'speedWithBall', 'layup', 'drivingDunk', 'closeShot', 'midRangeShot', 'threePointShot', 'shotIQ'],
      sec: ['offensiveConsistency', 'freeThrow', 'drawFoul', 'hands', 'speed', 'agility', 'perimeterDefense', 'defensiveConsistency', 'helpDefenseIQ', 'passPerception', 'defensiveRebound', 'strength', 'vertical', 'stamina', 'hustle'],
      flawPool: ['threePointShot', 'perimeterDefense', 'steal', 'defensiveConsistency', 'freeThrow', 'block'],
    },
    {
      // Slashing / Athletic Wing
      w: 22,
      core: ['drivingDunk', 'layup', 'closeShot', 'drawFoul', 'vertical', 'speed', 'agility', 'strength', 'perimeterDefense', 'hands', 'ballHandle'],
      sec: ['speedWithBall', 'shotIQ', 'offensiveConsistency', 'defensiveConsistency', 'steal', 'helpDefenseIQ', 'passPerception', 'interiorDefense', 'block', 'defensiveRebound', 'offensiveRebound', 'hustle', 'stamina'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'passVision', 'defensiveConsistency'],
      boost: { drivingDunk: 10, vertical: 8 },
    },
  ],
  PF: [
    {
      // Stretch Four
      w: 26,
      core: ['threePointShot', 'midRangeShot', 'shotIQ', 'freeThrow', 'closeShot', 'defensiveRebound', 'helpDefenseIQ', 'defensiveConsistency', 'perimeterDefense', 'interiorDefense'],
      sec: ['offensiveConsistency', 'layup', 'drivingDunk', 'standingDunk', 'postControl', 'postFade', 'drawFoul', 'hands', 'strength', 'vertical', 'agility', 'speed', 'hustle', 'stamina'],
      flawPool: ['standingDunk', 'postHook', 'block', 'offensiveRebound', 'ballHandle', 'steal'],
      boost: { threePointShot: 14, midRangeShot: 8 },
    },
    {
      // Athletic / Glass-Cleaning Finisher
      w: 26,
      core: ['standingDunk', 'drivingDunk', 'closeShot', 'offensiveRebound', 'defensiveRebound', 'vertical', 'strength', 'hustle', 'interiorDefense', 'hands'],
      sec: ['layup', 'drawFoul', 'shotIQ', 'offensiveConsistency', 'postControl', 'helpDefenseIQ', 'defensiveConsistency', 'block', 'perimeterDefense', 'speed', 'agility', 'stamina'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'passVision', 'perimeterDefense', 'steal'],
    },
    {
      // Interior Force / Post Scorer
      w: 24,
      core: ['postControl', 'postHook', 'postFade', 'closeShot', 'midRangeShot', 'drawFoul', 'strength', 'hands', 'defensiveRebound', 'interiorDefense'],
      sec: ['standingDunk', 'drivingDunk', 'layup', 'shotIQ', 'offensiveConsistency', 'helpDefenseIQ', 'defensiveConsistency', 'offensiveRebound', 'vertical', 'hustle', 'stamina'],
      flawPool: ['threePointShot', 'speed', 'agility', 'perimeterDefense', 'steal', 'block', 'freeThrow'],
    },
    {
      // Two-Way / Rim Anchor Four
      w: 24,
      core: ['interiorDefense', 'block', 'helpDefenseIQ', 'defensiveConsistency', 'defensiveRebound', 'offensiveRebound', 'strength', 'perimeterDefense', 'closeShot', 'vertical'],
      sec: ['standingDunk', 'drivingDunk', 'layup', 'drawFoul', 'hands', 'hustle', 'passPerception', 'shotIQ', 'offensiveConsistency', 'midRangeShot', 'postControl', 'stamina'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'postControl', 'ballHandle', 'passVision'],
    },
  ],
  C: [
    {
      // Rim Protector
      w: 28,
      core: ['interiorDefense', 'block', 'helpDefenseIQ', 'defensiveConsistency', 'defensiveRebound', 'offensiveRebound', 'strength', 'standingDunk', 'closeShot', 'hands'],
      sec: ['vertical', 'hustle', 'drawFoul', 'shotIQ', 'offensiveConsistency', 'layup', 'drivingDunk', 'postControl', 'postHook', 'stamina'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'postFade', 'passVision', 'steal'],
    },
    {
      // Paint Beast
      w: 25,
      core: ['standingDunk', 'closeShot', 'offensiveRebound', 'defensiveRebound', 'strength', 'vertical', 'hands', 'hustle', 'drawFoul', 'interiorDefense'],
      sec: ['drivingDunk', 'layup', 'block', 'helpDefenseIQ', 'defensiveConsistency', 'shotIQ', 'offensiveConsistency', 'postControl', 'postHook', 'stamina'],
      flawPool: ['threePointShot', 'midRangeShot', 'freeThrow', 'passVision', 'steal', 'perimeterDefense'],
    },
    {
      // Interior Force (Post Hub)
      w: 22,
      core: ['postControl', 'postHook', 'postFade', 'closeShot', 'drawFoul', 'hands', 'strength', 'defensiveRebound', 'interiorDefense', 'offensiveConsistency'],
      sec: ['standingDunk', 'layup', 'midRangeShot', 'shotIQ', 'helpDefenseIQ', 'defensiveConsistency', 'offensiveRebound', 'block', 'vertical', 'hustle', 'stamina'],
      flawPool: ['threePointShot', 'speed', 'agility', 'block', 'steal', 'freeThrow'],
    },
    {
      // Stretch Five
      w: 15,
      core: ['threePointShot', 'midRangeShot', 'freeThrow', 'shotIQ', 'closeShot', 'defensiveRebound', 'interiorDefense', 'helpDefenseIQ', 'defensiveConsistency', 'hands'],
      sec: ['block', 'strength', 'standingDunk', 'offensiveConsistency', 'hustle', 'postFade', 'postControl', 'drawFoul', 'vertical', 'stamina'],
      flawPool: ['standingDunk', 'offensiveRebound', 'postHook', 'speed', 'steal', 'passVision'],
      boost: { threePointShot: 24, midRangeShot: 14, freeThrow: 12 },
    },
    {
      // Playmaking Big
      w: 10,
      core: ['passAccuracy', 'passVision', 'passIQ', 'hands', 'closeShot', 'postControl', 'defensiveRebound', 'shotIQ', 'offensiveConsistency', 'interiorDefense'],
      sec: ['standingDunk', 'midRangeShot', 'postHook', 'postFade', 'drawFoul', 'strength', 'helpDefenseIQ', 'defensiveConsistency', 'offensiveRebound', 'hustle', 'stamina'],
      flawPool: ['threePointShot', 'block', 'vertical', 'speed', 'drivingDunk', 'steal'],
      boost: { passVision: 22, passAccuracy: 20, passIQ: 18, ballHandle: 12 },
    },
  ],
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function mixHash(seed: number, salt: number): number {
  return Math.imul(seed ^ salt, 0x85ebca6b) >>> 0
}

function pickTemplate(pos: Position, seed: number): BuildTemplate {
  const list = BUILD_TEMPLATES[pos]
  let total = 0
  for (let i = 0; i < list.length; i++) total += list[i].w
  let r = mixHash(seed, 0x9e3779b9) % total
  for (let i = 0; i < list.length; i++) {
    r -= list[i].w
    if (r < 0) return list[i]
  }
  return list[0]
}

export function generatePlayer(
  rng: Rng,
  opts: { season: number; age?: number; targetOvr?: number; pos?: Position },
): Player {
  const pos = opts.pos ?? rng.pick(POSITIONS)
  const target = opts.targetOvr ?? clamp(Math.round(rng.normal(70, 8)), 50, 95)
  const age = opts.age ?? clamp(Math.round(rng.normal(26, 4)), 19, 36)

  const [hMean, hMin, hMax] = POSITION_HEIGHT_BOUNDS[pos]

  const tpl = pickTemplate(pos, 1) // temporary; we'll pick from faceSeed below once rolled
  void tpl

  const posOffs = POS_BASE_OFFS[pos]
  const rawBase = Array.from({ length: SKILL_KEYS.length }, () => rng.normal(0, 1))
  const durNoise = rng.normal(0, 1)
  const intangNoise = rng.normal(0, 1)
  const potNoise = rng.normal(0, 1)

  const id = rng.id('p_')
  rng.next(); rng.next() // legacy name draws, kept so the league RNG stream (and every seeded result) is unchanged
  const heightIn = clamp(Math.round(rng.normal(hMean, 1.5)), hMin, hMax)
  const jersey = pickJersey(rng)
  const hometown = rng.pick(HOMETOWNS)
  const college = rng.pick(COLLEGES)
  const rawSeed = rng.int(1, 2 ** 31 - 1)
  // Heritage, names and the face come from rawSeed alone, never the league rng.
  const idRng = Rng.fromSeed((rawSeed ^ 0x2545f491) >>> 0)
  const heritage = rollHeritage(idRng)
  const { firstName, lastName } = pickName(idRng, heritage)
  const faceSeed = encodeHeritage(rawSeed, heritage)

  const buildTpl = pickTemplate(pos, rawSeed)
  const coreSet = new Set<Key>(buildTpl.core)
  const secSet = new Set<Key>(buildTpl.sec)

  // Roll 1–3 genuine sim weaknesses from the template's flaw pool (non-core attributes that actually show up in games).
  const flawCandidates = buildTpl.flawPool.filter((k) => !coreSet.has(k))
  const maxFlaws = target >= 90 ? 2 : 3
  const flawCount = Math.min(flawCandidates.length, 1 + (mixHash(rawSeed, 0x517cc1b7) % maxFlaws))
  const poolCopy = [...flawCandidates]
  const flawSet = new Set<Key>()
  for (let i = 0; i < flawCount && poolCopy.length; i++) {
    const idx = mixHash(rawSeed, 0x27d4eb2d + i * 31) % poolCopy.length
    flawSet.add(poolCopy.splice(idx, 1)[0])
  }

  const boost = buildTpl.boost ?? {}
  const raw = {} as Record<Key, number>
  const maxFor = (k: Key) => heightMaxFor(heightIn, k)

  for (let idx = 0; idx < SKILL_KEYS.length; idx++) {
    const k = SKILL_KEYS[idx]
    const n = rawBase[idx]
    if (k === 'overallDurability') {
      raw[k] = clamp(Math.round(74 + durNoise * 10 - Math.max(0, age - 30) * 1.2), 45, 98)
      continue
    }
    if (k === 'stamina') {
      raw[k] = clamp(Math.round(70 + n * 10 - Math.max(0, age - 32) * 1.2), 45, 96)
      continue
    }
    const b = boost[k] ?? 0
    if (flawSet.has(k)) {
      // Genuine sim flaws: keep in 45–74 for NBA-tier players (or lower if targetOvr < 62).
      const center = target >= 62 ? (target >= 92 ? 64 : 59) : Math.max(30, target - 6)
      raw[k] = clamp(center + n * 5.5, RATING_MIN, target >= 62 ? 74 : 68)
    } else if (coreSet.has(k)) {
      raw[k] = target - 1 + b * 0.15 + n * 4.5
    } else if (secSet.has(k)) {
      raw[k] = target - 8 + b * 0.15 + n * 5.5
    } else {
      // Off-archetype attributes stay in a realistic 45–75 range (with positional floor adjustments).
      const offCenter = clamp(54 + (target - 68) * 0.35 + (posOffs[k] ?? 0) * 0.55 + b * 0.35, 34, 69)
      raw[k] = clamp(offCenter + n * 5.5, RATING_MIN, Math.min(75, maxFor(k)))
    }
  }
  raw.intangibles = clamp(Math.round(52 + (target - 65) * 0.78 + intangNoise * 8), RATING_MIN, RATING_MAX)

  const ratings = {} as Ratings
  const fill = (shift: number) => {
    for (const k of RATING_KEYS) {
      if (k === 'overallDurability' || k === 'intangibles') {
        ratings[k] = clamp(Math.round(raw[k]), RATING_MIN, RATING_MAX)
        continue
      }
      let gain = 0
      if (k === 'stamina') gain = shift >= 0 ? 0.25 : 0.6
      else if (coreSet.has(k)) gain = 1.0
      else if (secSet.has(k)) gain = shift >= 0 ? 0.45 : 0.85
      else if (flawSet.has(k)) gain = shift < 0 && target < 60 ? 0.5 : 0
      else gain = shift < 0 && target < 62 ? 0.6 : 0

      const offCap = !coreSet.has(k) && !secSet.has(k) && target >= 62 ? Math.min(75, maxFor(k)) : maxFor(k)
      const cap = flawSet.has(k) && target >= 62 ? Math.min(74, offCap) : offCap
      ratings[k] = clamp(Math.round(raw[k] + shift * gain), RATING_MIN, cap)
    }
  }

  // Binary search shift to hit target OVR without inflating off-archetype attributes or flaws.
  let lo = -65
  let hi = 65
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5
    fill(mid)
    if (calculatePlayerOVR(ratings, pos) < target) lo = mid
    else hi = mid
  }
  fill((lo + hi) * 0.5)

  // Fine-tune 1 point at a time on core -> secondary (never inflating flaws unless forced) until we land on target OVR.
  const tuneOrder: Key[] = [
    ...buildTpl.core,
    ...buildTpl.sec,
    ...SKILL_KEYS.filter((k) => k !== 'overallDurability' && !coreSet.has(k) && !secSet.has(k) && !flawSet.has(k)),
  ]
  for (let step = 0; step < 120; step++) {
    const cur = calculatePlayerOVR(ratings, pos)
    if (cur === target) break
    const dir = Math.sign(target - cur)
    let moved = false
    for (const k of tuneOrder) {
      const offCap = !coreSet.has(k) && !secSet.has(k) && target >= 62 ? Math.min(75, maxFor(k)) : maxFor(k)
      if (dir > 0 ? ratings[k] < offCap : ratings[k] > RATING_MIN) {
        ratings[k] += dir
        moved = true
        if (calculatePlayerOVR(ratings, pos) === target) break
      }
    }
    if (!moved) {
      // Rare extreme star (e.g. 96-98) where core+sec maxed out: lift intangibles (up to 94) before touching flaws.
      if (dir > 0 && ratings.intangibles < 94) {
        ratings.intangibles++
        continue
      }
      let nudged = false
      for (const k of flawSet) {
        const cap = Math.min(76, maxFor(k))
        if (dir > 0 && ratings[k] < cap) {
          ratings[k]++
          nudged = true
          if (calculatePlayerOVR(ratings, pos) === target) break
        }
      }
      if (!nudged) break
    }
  }

  const ovr = calculatePlayerOVR(ratings, pos)
  const pot = clamp(Math.max(ovr, Math.round(ovr + Math.max(0, 24 - age) * 0.85 + potNoise * 2.8)), ovr, 99)

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
    pot,
    faceSeed,
    // Seeded from rawSeed only: the league rng stream is untouched.
    playStyle: rollPlayStyle(pos, ratings, mixHash(rawSeed, 0x5ca1ab1e)),
    teamId: null,
    contract: null,
    injury: null,
    morale: 60,
    draft: null,
    ratingHistory: [{ season: opts.season, ovr }],
  }
}
