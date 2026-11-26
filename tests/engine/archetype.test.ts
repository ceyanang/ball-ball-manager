import { describe, expect, it } from 'vitest'
import { ARCHETYPES, archetypeFor } from '../../src/engine/player/archetype'
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

describe('archetypeFor', () => {
  it('names a pure shooting guard a Sharpshooter', () => expect(archetypeFor(make('SG', 70, { threePointShot: 88 }))).toBe('Sharpshooter'))
  it('calls an elite pure shooter Splash', () => expect(archetypeFor(make('SG', 70, { threePointShot: 96 }))).toBe('Splash'))
  it('names a shot-blocking wing Block Party', () => expect(archetypeFor(make('SF', 70, { interiorDefense: 96, block: 96, helpDefenseIQ: 92 }))).toBe('Block Party'))
  it('names a passing + handling guard an Offensive Engine', () =>
    expect(archetypeFor(make('PG', 70, { passAccuracy: 88, passIQ: 88, passVision: 88, ballHandle: 92, speedWithBall: 92 }))).toBe('Offensive Engine'))
  it('names a high-flying finishing big a Launchpad', () =>
    expect(archetypeFor(make('C', 70, { speed: 90, agility: 90, vertical: 95, strength: 92, standingDunk: 92, drivingDunk: 90, closeShot: 90, layup: 90, postHook: 90, postControl: 90 }))).toBe('Launchpad'))
  it('prefixes 2-Way when elite on both ends', () =>
    expect(archetypeFor(make('SG', 75, { threePointShot: 95, perimeterDefense: 93, steal: 93, passPerception: 92 }))).toBe('2-Way Sharpshooter'))
  it('crowns a do-everything big an Anomaly', () => expect(archetypeFor(make('C', 90, {}))).toBe('Anomaly'))
  it('crowns a do-everything athletic wing a Prototype', () => expect(archetypeFor(make('SF', 90, { speed: 95, agility: 95, vertical: 95, strength: 95 }))).toBe('Prototype'))
  it('is deterministic', () => {
    const p = make('PG', 72, { passVision: 90, ballHandle: 88 })
    expect(archetypeFor(p)).toBe(archetypeFor(structuredClone(p)))
  })
  it('gives every player in a league a known title', () => {
    const l = createLeague({ seed: 5, userTeamIndex: 0, name: 'A' })
    const seen = new Set<string>()
    for (const p of Object.values(l.players)) {
      const t = archetypeFor(p)
      expect(ARCHETYPES).toContain(t)
      seen.add(t)
    }
    expect(seen.size).toBeGreaterThanOrEqual(25)
  })
  it('keeps any one title under 15% of the league', () => {
    const counts: Record<string, number> = {}
    let n = 0
    for (const seed of [1, 2, 3]) for (const p of Object.values(createLeague({ seed, userTeamIndex: 0, name: 'A' }).players)) {
      const t = archetypeFor(p)
      counts[t] = (counts[t] ?? 0) + 1
      n++
    }
    for (const [t, c] of Object.entries(counts)) expect([t, c / n < 0.1]).toEqual([t, true])
  })
})

describe('ARCHETYPES', () => {
  it('has the 45 titles, each reachable across a few leagues', () => {
    expect(new Set(ARCHETYPES).size).toBe(45)
    const seen = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6]) for (const p of Object.values(createLeague({ seed, userTeamIndex: 0, name: 'A' }).players)) seen.add(archetypeFor(p))
    expect([...ARCHETYPES].filter((t) => !seen.has(t))).toEqual([])
  })
})
