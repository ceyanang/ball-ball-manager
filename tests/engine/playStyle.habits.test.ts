import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { applyHabits, STYLE_HABITS, type PlayStyle } from '../../src/engine/player/playStyle'
import type { ArchetypeTendencies } from '../../src/engine/player/archetype'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import type { BoxLine, Player } from '../../src/engine/types'

const neutral = (): ArchetypeTendencies => ({
  zoneMult: [1, 1, 1, 1, 1, 1, 1], usageMult: 1, handlerMult: 1, passerMult: 1, foulDrawMult: 1,
  tovDelta: 0, assistShareDelta: 0, stealMult: 1, blockMult: 1,
})

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'H' })
const tIds = Object.keys(league.teams)
const home = league.teams[tIds[0]]
const away = league.teams[tIds[1]]

/** Sim `n` seeded games with some home players' styles overridden (ratings identical). */
function run(styles: Record<string, PlayStyle>, n: number) {
  const players: Record<string, Player> = { ...league.players }
  for (const [id, s] of Object.entries(styles)) players[id] = { ...players[id], playStyle: s }
  const lines: BoxLine[] = []
  for (let s = 1; s <= n; s++) lines.push(...simGame(home, away, players, league.coaches, Rng.fromSeed(s)).box)
  return lines
}
const sum = (lines: BoxLine[], id: string, f: (b: BoxLine) => number) => lines.filter((b) => b.playerId === id).reduce((a, b) => a + f(b), 0)

describe('play style habits', () => {
  it('applyHabits multiplies and adds as listed and never mutates its input', () => {
    const t = neutral()
    const p = applyHabits(t, 'power')
    expect(p.t.zoneMult[4]).toBe(1.3)
    expect(p.rebOffMult).toBe(1.15)
    expect(p.paceDelta).toBe(-8)
    expect(applyHabits(t, 'defensive').t.stealMult).toBe(1.2)
    expect(applyHabits(t, 'smart').t.tovDelta).toBe(-0.008)
    expect(applyHabits(t, 'offense').paceDelta).toBe(8)
    expect(t).toEqual(neutral())
    expect(p.t).not.toBe(t)
    expect(STYLE_HABITS.allAround.zoneMult).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it('a Power center plays inside and a Defensive center defends and rebounds (same ratings)', () => {
    const c = home.rotation.starters[4]
    const a = run({ [c]: 'power' }, 300)
    const b = run({ [c]: 'defensive' }, 300)
    const twoShare = (l: BoxLine[]) => (sum(l, c, (x) => x.fga - x.tpa)) / Math.max(1, sum(l, c, (x) => x.fga))
    expect(twoShare(a)).toBeGreaterThan(twoShare(b))
    expect(sum(a, c, (x) => x.tpa)).toBeLessThan(sum(b, c, (x) => x.tpa))
    expect(sum(b, c, (x) => x.blk + x.stl)).toBeGreaterThan(sum(a, c, (x) => x.blk + x.stl))
    expect(sum(b, c, (x) => x.dreb)).toBeGreaterThan(sum(a, c, (x) => x.dreb))
  })

  it('an all-Offense roster plays faster than the same roster as Power', () => {
    const roster = [...home.rotation.starters, ...home.rotation.bench]
    const all = (s: PlayStyle) => Object.fromEntries(roster.map((id) => [id, s]))
    const poss = (l: BoxLine[]) => l.reduce((a, b) => a + b.fga - b.oreb + b.tov + 0.44 * b.fta, 0)
    expect(poss(run(all('offense'), 100))).toBeGreaterThan(poss(run(all('power'), 100)))
  })

  it('same seed gives the same game twice', () => {
    const a = simGame(home, away, league.players, league.coaches, Rng.fromSeed(9))
    const b = simGame(home, away, league.players, league.coaches, Rng.fromSeed(9))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
