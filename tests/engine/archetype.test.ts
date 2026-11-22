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
  it('names a pure shooting guard a Sharpshooter', () => expect(archetypeFor(make('SG', 70, { three: 92 }))).toBe('Sharpshooter'))
  it('names a shooting + perimeter-D wing a 3&D Wing', () => expect(archetypeFor(make('SF', 70, { three: 90, perD: 90 }))).toBe('3&D Wing'))
  it('names a shot-blocking center a Rim Protector', () => expect(archetypeFor(make('C', 70, { intD: 92, blk: 92 }))).toBe('Rim Protector'))
  it('names a shooting center a Stretch Big', () => expect(archetypeFor(make('C', 70, { three: 88 }))).toBe('Stretch Big'))
  it('prefixes 2-Way when elite on both ends', () =>
    expect(archetypeFor(make('SG', 70, { ins: 90, ath: 90, handle: 90, perD: 88, stl: 88 }))).toMatch(/^2-Way /))
  it('falls back to Role Player for low ratings', () => expect(archetypeFor(make('SF', 55, {}))).toBe('Role Player'))
  it('is deterministic', () => {
    const p = make('PG', 72, { pass: 90, handle: 88 })
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
    expect(seen.size).toBeGreaterThanOrEqual(8)
  })
  it('keeps any one title under 15% of the league', () => {
    const counts: Record<string, number> = {}
    let n = 0
    for (const seed of [1, 2, 3]) for (const p of Object.values(createLeague({ seed, userTeamIndex: 0, name: 'A' }).players)) {
      const t = archetypeFor(p)
      counts[t] = (counts[t] ?? 0) + 1
      n++
    }
    for (const [t, c] of Object.entries(counts)) expect([t, c / n < 0.15]).toEqual([t, true])
  })
})
