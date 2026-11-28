import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { generatePlayer } from '../../src/engine/player/generate'
import { isPlayStyle, PLAY_STYLES, type PlayStyle } from '../../src/engine/player/playStyle'
import { Rng } from '../../src/engine/rng'
import type { Position } from '../../src/engine/types'

const fnv = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

describe('play style at generation', () => {
  it('generatePlayer gives a valid style, deterministic by seed', () => {
    const a = generatePlayer(Rng.fromSeed(42), { season: 1 })
    const b = generatePlayer(Rng.fromSeed(42), { season: 1 })
    expect(isPlayStyle(a.playStyle)).toBe(true)
    expect(a.playStyle).toBe(b.playStyle)
  })

  it('does not draw from the league Rng (stream unchanged from before play styles)', () => {
    const rng = Rng.fromSeed(42)
    generatePlayer(rng, { season: 1 })
    expect(rng.next()).toBe(0.9047754912171513) // recorded before play styles existed
  })

  it('createLeague ids, names and ratings are unchanged from before play styles', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'x' })
    const s = Object.values(l.players).map((p) => p.id + ':' + p.firstName + p.lastName + ':' + JSON.stringify(p.ratings)).sort().join('|')
    expect(Object.keys(l.players).length).toBe(445)
    expect(fnv(s)).toBe(2051618936) // recorded before play styles existed
  })

  it("each position's most common style follows the owner's chart", () => {
    const count: Record<Position, Record<PlayStyle, number>> = {} as never
    for (const seed of [1, 2, 3]) {
      const l = createLeague({ seed, userTeamIndex: 0, name: 'x' })
      for (const p of Object.values(l.players)) {
        count[p.pos] ??= Object.fromEntries(PLAY_STYLES.map((s) => [s, 0])) as Record<PlayStyle, number>
        count[p.pos][p.playStyle]++
      }
    }
    const top = (pos: Position) => [...PLAY_STYLES].sort((a, b) => count[pos][b] - count[pos][a])[0]
    expect(['smart', 'offense']).toContain(top('PG'))
    expect(top('SG')).toBe('offense')
    expect(top('SF')).toBe('allAround')
    expect(top('PF')).toBe('power')
    expect(['defensive', 'power']).toContain(top('C'))
  })
})
