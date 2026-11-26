import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { POSITION_HEIGHT_BOUNDS, generatePlayer } from '../../src/engine/player/generate'
import {
  C_STRETCH_WEIGHTS,
  POSITION_WEIGHTS,
  RATING_KEYS,
  SF_WING_WEIGHTS,
  SKILL_KEYS,
  calculatePlayerOVR,
  detectSfWingRole,
  heightMaxFor,
} from '../../src/engine/player/ratings'
import { generatePlayerArchetype } from '../../src/engine/player/archetype'
import { Rng } from '../../src/engine/rng'
import type { Position } from '../../src/engine/types'

describe('100%-normalized weight pools & SF sub-role parity', () => {
  it('sums every position and SF wing sub-role weight pool to 100.0', () => {
    const sum = (w: Record<string, number>) => SKILL_KEYS.reduce((s, k) => s + w[k], 0)
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
      expect(sum(POSITION_WEIGHTS[pos])).toBeCloseTo(100, 6)
      expect(POSITION_WEIGHTS[pos].intangibles).toBe(0)
    }
    for (const role of Object.keys(SF_WING_WEIGHTS) as (keyof typeof SF_WING_WEIGHTS)[]) {
      expect(sum(SF_WING_WEIGHTS[role])).toBeCloseTo(100, 6)
      expect(SF_WING_WEIGHTS[role].intangibles).toBe(0)
    }
    expect(sum(C_STRETCH_WEIGHTS)).toBeCloseTo(100, 6)
    expect(C_STRETCH_WEIGHTS.intangibles).toBe(0)
  })

  it('detects all 4 SF wing sub-roles cleanly from 36 attributes', () => {
    const base = generatePlayer(Rng.fromSeed(1), { season: 1, pos: 'SF', targetOvr: 78 })
    const makeSf = (over: Partial<typeof base.ratings>) => {
      const r = { ...base.ratings }
      for (const k of RATING_KEYS) r[k] = 68
      return { ...r, ...over }
    }
    expect(detectSfWingRole(makeSf({ threePointShot: 90, midRangeShot: 88, layup: 86, drivingDunk: 84, shotIQ: 88 }))).toBe('wingScorer')
    expect(detectSfWingRole(makeSf({ passVision: 90, passAccuracy: 90, passIQ: 88, ballHandle: 88, layup: 84 }))).toBe('pointForward')
    expect(detectSfWingRole(makeSf({ perimeterDefense: 90, steal: 86, agility: 86, passPerception: 86, threePointShot: 86, shotIQ: 82 }))).toBe('threeAndD')
    expect(detectSfWingRole(makeSf({ drivingDunk: 92, layup: 90, drawFoul: 88, vertical: 90, strength: 84, perimeterDefense: 82 }))).toBe('slashingWing')
  })

  it('keeps non-Point-Forward SF stars from getting inflated by passVision/passIQ or postHook/block', () => {
    const rng = Rng.fromSeed(42)
    const sf95 = generatePlayer(rng, { season: 1, pos: 'SF', targetOvr: 95 })
    const ovr95 = calculatePlayerOVR(sf95.ratings, 'SF')
    expect(ovr95).toBeGreaterThanOrEqual(94)
    expect(ovr95).toBeLessThanOrEqual(96)
  })

  it('prevents inflated secondary stats from reaching 94-99 without elite core attributes', () => {
    const base = generatePlayer(Rng.fromSeed(5), { season: 1, pos: 'PG', targetOvr: 80 }).ratings
    // 87 in core PG stats, 99 in everything secondary/off-role
    const fakeStar = { ...base }
    for (const k of RATING_KEYS) fakeStar[k] = 96
    for (const k of ['ballHandle', 'speedWithBall', 'passAccuracy', 'passVision', 'passIQ', 'threePointShot', 'midRangeShot', 'layup', 'speed', 'agility', 'shotIQ', 'offensiveConsistency'] as const) {
      fakeStar[k] = 87
    }
    fakeStar.intangibles = 75
    expect(calculatePlayerOVR(fakeStar, 'PG')).toBeLessThan(94)
  })
})

describe('height-aware quota generation & built-in flaws', () => {
  it('assigns realistic position heights and bounds physical/interior attributes by height', () => {
    const rng = Rng.fromSeed(101)
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
      const [, hMin, hMax] = POSITION_HEIGHT_BOUNDS[pos]
      for (let i = 0; i < 60; i++) {
        const p = generatePlayer(rng, { season: 1, pos, targetOvr: 88 })
        expect(p.heightIn).toBeGreaterThanOrEqual(hMin)
        expect(p.heightIn).toBeLessThanOrEqual(hMax)
        for (const k of RATING_KEYS) {
          expect(p.ratings[k]).toBeLessThanOrEqual(heightMaxFor(p.heightIn, k))
        }
      }
    }
  })

  it('hits target OVR across 62..98 while keeping stars flawed (no 99-everything demigods)', () => {
    const rng = Rng.fromSeed(77)
    for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
      for (const target of [65, 75, 85, 90, 95, 97]) {
        const p = generatePlayer(rng, { season: 1, pos, targetOvr: target })
        const actual = calculatePlayerOVR(p.ratings, pos)
        expect(Math.abs(actual - target)).toBeLessThanOrEqual(1)
        if (target >= 95) {
          const below75 = SKILL_KEYS.filter((k) => k !== 'overallDurability' && p.ratings[k] <= 75)
          expect(below75.length).toBeGreaterThanOrEqual(5)
          // Never 99-everything: off-archetype & flaws stay realistic even for 95-97 stars
          const at99 = SKILL_KEYS.filter((k) => p.ratings[k] === 99)
          expect(at99.length).toBeLessThan(target >= 97 ? 22 : 16)
        }
      }
    }
  })

  it('produces all 4 SF wing archetypes across a created league', () => {
    const l = createLeague({ seed: 7, userTeamIndex: 0, name: 'Wings' })
    const sfs = Object.values(l.players).filter((p) => p.pos === 'SF')
    const wingRoles = new Set(sfs.map((p) => detectSfWingRole(p.ratings)))
    expect(wingRoles.size).toBe(4)
    const titles = new Set(sfs.map((p) => generatePlayerArchetype(p).baseRole))
    expect(titles.size).toBeGreaterThanOrEqual(4)
  })

  it('dynamically updates OVR and archetype when attributes develop or regress', () => {
    const p = generatePlayer(Rng.fromSeed(19), { season: 1, pos: 'SF', targetOvr: 76 })
    // Force into a pure 3&D Wing starting profile
    p.ratings.threePointShot = 85
    p.ratings.shotIQ = 82
    p.ratings.layup = 70
    p.ratings.drivingDunk = 68
    p.ratings.closeShot = 70
    p.ratings.drawFoul = 68
    p.ratings.perimeterDefense = 86
    p.ratings.steal = 84
    p.ratings.passPerception = 84
    p.ratings.agility = 84
    p.ratings.defensiveConsistency = 84
    p.ratings.passVision = 60
    p.ratings.passAccuracy = 64
    p.ratings.passIQ = 62
    p.ratings.ballHandle = 66
    const ovrBefore = calculatePlayerOVR(p.ratings, p.pos)
    expect(generatePlayerArchetype(p).baseRole).toBe('3&D Wing')

    // Develop playmaking & handle: archetype dynamically shifts to Point Forward and OVR rises
    p.ratings.passVision = 89
    p.ratings.passAccuracy = 88
    p.ratings.passIQ = 87
    p.ratings.ballHandle = 88
    p.ratings.speedWithBall = 85
    expect(detectSfWingRole(p.ratings)).toBe('pointForward')
    expect(generatePlayerArchetype(p).baseRole).toBe('Point Forward')
    expect(calculatePlayerOVR(p.ratings, p.pos)).toBeGreaterThan(ovrBefore)
  })

  it('keeps 95 SF Wing Scorers from becoming all-around Playmaking/Post demigods', () => {
    const rng = Rng.fromSeed(303)
    const scorers: ReturnType<typeof generatePlayer>[] = []
    for (let i = 0; i < 40; i++) {
      const sf = generatePlayer(rng, { season: 1, pos: 'SF', targetOvr: 95 })
      if (detectSfWingRole(sf.ratings) === 'wingScorer') scorers.push(sf)
    }
    expect(scorers.length).toBeGreaterThan(0)
    for (const sf of scorers) {
      // Non-Point-Forward 95 SF Wing Scorers lack PG floor-general vision & big-man post hooks/blocks
      expect(sf.ratings.passVision).toBeLessThanOrEqual(75)
      expect(sf.ratings.passIQ).toBeLessThanOrEqual(75)
      expect(sf.ratings.postHook).toBeLessThanOrEqual(75)
      expect(sf.ratings.standingDunk).toBeLessThanOrEqual(75)
    }
  })
})
