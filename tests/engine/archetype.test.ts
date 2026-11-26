import { describe, expect, it } from 'vitest'
import {
  BASE_ROLES,
  archetypeFor,
  computePillars,
  generatePlayerArchetype,
} from '../../src/engine/player/archetype'
import { createLeague } from '../../src/engine/league/create'
import { generatePlayer } from '../../src/engine/player/generate'
import { Rng } from '../../src/engine/rng'
import type { Player, Position, Ratings } from '../../src/engine/types'

function make(pos: Position, base: number, over: Partial<Ratings>): Player {
  const p = generatePlayer(Rng.fromSeed(1), { season: 1, pos })
  for (const k of Object.keys(p.ratings) as (keyof Ratings)[]) p.ratings[k] = base
  Object.assign(p.ratings, over)
  return p
}

describe('computePillars', () => {
  it('computes 6 weighted pillar scores on the 0-99 scale', () => {
    const p = make('PG', 70, {
      threePointShot: 92,
      midRangeShot: 88,
      freeThrow: 90,
      shotIQ: 86,
      passAccuracy: 90,
      passVision: 92,
      passIQ: 88,
      ballHandle: 90,
      speedWithBall: 89,
    })
    const pil = computePillars(p.ratings, p.pos)
    expect(pil.shooting).toBeGreaterThanOrEqual(88)
    expect(pil.playmaking).toBeGreaterThanOrEqual(89)
    expect(pil.rebounding).toBe(70)
    expect(pil.interiorDefense).toBe(70)
  })
})

describe('generatePlayerArchetype / archetypeFor', () => {
  it('names a pure 3PT shooting guard a Sharpshooter', () => {
    const p = make('SG', 70, { threePointShot: 92, midRangeShot: 78, freeThrow: 86, shotIQ: 85 })
    expect(archetypeFor(p)).toBe('Sharpshooter')
  })

  it('names a middy/handle guard a Shot Creator', () => {
    const p = make('PG', 70, { threePointShot: 84, midRangeShot: 92, freeThrow: 88, shotIQ: 86, ballHandle: 84 })
    expect(archetypeFor(p)).toBe('Shot Creator')
  })

  it('names a playmaking PG a Floor General', () => {
    const p = make('PG', 70, { passAccuracy: 90, passIQ: 88, passVision: 92, ballHandle: 90, speedWithBall: 88 })
    expect(archetypeFor(p)).toBe('Floor General')
  })

  it('names a 2-way 3-level guard a 2-Way 3-Level Scorer', () => {
    const p = make('SG', 72, {
      threePointShot: 88,
      midRangeShot: 86,
      freeThrow: 85,
      shotIQ: 84,
      layup: 88,
      drivingDunk: 84,
      closeShot: 85,
      drawFoul: 82,
      perimeterDefense: 88,
      steal: 84,
      agility: 85,
      passPerception: 84,
      defensiveConsistency: 84,
    })
    expect(archetypeFor(p)).toBe('2-Way 3-Level Scorer')
  })

  it('names a floor-spacing slasher cleanly', () => {
    const p = make('PG', 68, {
      layup: 90,
      drivingDunk: 82,
      closeShot: 88,
      drawFoul: 86,
      threePointShot: 82,
    })
    expect(archetypeFor(p)).toBe('Floor-Spacing Slasher')
  })

  it('names a 3&D Wing and Wing Stopper for SF', () => {
    const threeAndD = make('SF', 70, {
      threePointShot: 85,
      midRangeShot: 76,
      shotIQ: 82,
      freeThrow: 80,
      perimeterDefense: 86,
      steal: 82,
      passPerception: 82,
      agility: 80,
      defensiveConsistency: 82,
    })
    expect(archetypeFor(threeAndD)).toBe('3&D Wing')

    const stopper = make('SF', 68, {
      perimeterDefense: 90,
      steal: 88,
      agility: 84,
      passPerception: 86,
      defensiveConsistency: 86,
    })
    expect(archetypeFor(stopper)).toBe('Wing Stopper')
  })

  it('distinguishes Big archetypes (Interior Force, Paint Beast, Stretch Five, Rim Protector, Playmaking Big, Glass-Cleaning Finisher)', () => {
    expect(
      archetypeFor(make('C', 70, { postControl: 88, postHook: 88, postFade: 84, closeShot: 88, drawFoul: 82, standingDunk: 80 })),
    ).toBe('Interior Force')
    expect(
      archetypeFor(make('C', 70, { standingDunk: 92, drivingDunk: 85, closeShot: 88, layup: 82, drawFoul: 82, postHook: 60, postControl: 65 })),
    ).toBe('Paint Beast')
    expect(
      archetypeFor(make('C', 70, { threePointShot: 88, midRangeShot: 84, freeThrow: 82, shotIQ: 82 })),
    ).toBe('Stretch Five')
    expect(
      archetypeFor(make('C', 70, { interiorDefense: 92, block: 94, helpDefenseIQ: 88, strength: 84, vertical: 82 })),
    ).toBe('Rim Protector')
    expect(
      archetypeFor(make('C', 70, { passAccuracy: 88, passVision: 90, passIQ: 88, ballHandle: 74, speedWithBall: 70 })),
    ).toBe('Playmaking Big')
    expect(
      archetypeFor(make('PF', 70, { offensiveRebound: 90, defensiveRebound: 92, hustle: 86, strength: 84, vertical: 82 })),
    ).toBe('Glass-Cleaning Finisher')
  })

  it('formats 2-Way Stretch Glass Cleaner cleanly', () => {
    const p = make('C', 72, {
      threePointShot: 86,
      midRangeShot: 82,
      shotIQ: 82,
      freeThrow: 82,
      interiorDefense: 86,
      block: 85,
      helpDefenseIQ: 84,
      defensiveRebound: 88,
      offensiveRebound: 84,
      hustle: 84,
      strength: 82,
    })
    expect(archetypeFor(p)).toBe('2-Way Stretch Glass Cleaner')
  })

  it('crowns 88+ OVR players with 4+ pillars at 82+ as 2-Way Superstar or All-Around Threat', () => {
    const twoWay = make('SF', 90, {})
    expect(archetypeFor(twoWay)).toBe('2-Way Superstar')

    const allAround = make('SF', 94, {
      perimeterDefense: 74,
      steal: 70,
      passPerception: 72,
      defensiveConsistency: 74,
      interiorDefense: 72,
      block: 70,
      helpDefenseIQ: 74,
    })
    expect(archetypeFor(allAround)).toBe('All-Around Threat')
  })

  it('caps modifiers at 2 max', () => {
    const p = make('PG', 72, {
      layup: 90,
      drivingDunk: 90,
      vertical: 90,
      closeShot: 88,
      drawFoul: 86,
      threePointShot: 83,
      passVision: 84,
      passAccuracy: 84,
      perimeterDefense: 86,
      steal: 84,
      agility: 86,
      passPerception: 84,
      defensiveConsistency: 84,
      defensiveRebound: 88,
      offensiveRebound: 84,
      hustle: 86,
    })
    const res = generatePlayerArchetype(p)
    expect(res.modifiers.length).toBeLessThanOrEqual(2)
  })

  it('is deterministic', () => {
    const p = make('PG', 72, { passVision: 90, ballHandle: 88 })
    expect(generatePlayerArchetype(p)).toEqual(generatePlayerArchetype(structuredClone(p)))
  })

  it('gives every player in a league a valid base role and strong build diversity', () => {
    const seenTitles = new Set<string>()
    const seenRoles = new Set<string>()
    for (const seed of [1, 2, 3, 4]) {
      const l = createLeague({ seed, userTeamIndex: 0, name: 'A' })
      for (const p of Object.values(l.players)) {
        const res = generatePlayerArchetype(p)
        expect(BASE_ROLES).toContain(res.baseRole)
        expect(res.modifiers.length).toBeLessThanOrEqual(2)
        seenTitles.add(res.title)
        seenRoles.add(res.baseRole)
      }
    }
    expect(seenTitles.size).toBeGreaterThanOrEqual(25)
    expect(seenRoles.size).toBeGreaterThanOrEqual(15)
  })
})
