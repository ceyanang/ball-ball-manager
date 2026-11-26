import { describe, expect, it } from 'vitest'
import { applyEffects } from '../../src/engine/events/effects'
import { buildMods, tickEffects, type GameMods } from '../../src/engine/events/mods'
import { committed } from '../../src/engine/gm/cap'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'

const league = createLeague({ seed: 3, userTeamIndex: 1, name: 'M' })
const me = league.teams[league.userTeamId]
const opp = Object.values(league.teams).find((t) => t.id !== me.id)!
const roster = committed(league, me.id)
const star = [...roster].sort((a, b) => b.ratings.threePointShot - a.ratings.threePointShot)[0]
const empty = (): GameMods => ({ shooting: {}, defense: {}, energy: {}, sit: [], chemistry: {} })
const run = (n: number, mods?: GameMods, home = me) => {
  const rng = Rng.fromSeed(11)
  return Array.from({ length: n }, () => simGame(home, home === me ? opp : me, league.players, league.coaches, rng, undefined, mods))
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('sim mods', () => {
  it('no mods and empty mods give bit-identical games', () => {
    expect(run(5, empty())).toEqual(run(5, undefined))
  })
  it('a shooting buff raises that player\'s points', () => {
    const base = run(200), buffed = run(200, { ...empty(), shooting: { [star.id]: 6 } })
    const pts = (rs: typeof base) => mean(rs.map((r) => r.box.find((b) => b.playerId === star.id)?.pts ?? 0))
    expect(pts(buffed)).toBeGreaterThan(pts(base))
  })
  it('a rested player gets no minutes (and the league player is untouched)', () => {
    const before = JSON.stringify(league.players[star.id])
    for (const r of run(5, { ...empty(), sit: [star.id] })) expect(r.box.find((b) => b.playerId === star.id)?.min ?? 0).toBe(0)
    expect(JSON.stringify(league.players[star.id])).toBe(before)
  })
  it('chemistry helps when high and hurts when low', () => {
    const margin = (c: number) => mean(run(300, { ...empty(), chemistry: { [me.id]: c } }).map((r) => r.homeScore - r.awayScore))
    expect(margin(100)).toBeGreaterThan(margin(0))
  })
})

describe('buildMods / tickEffects', () => {
  const game = { id: 'g', season: 1, day: 1, homeId: me.id, awayId: opp.id, playoff: null, result: null }
  it('is undefined with nothing active and neutral chemistry', () => {
    expect(buildMods(createLeague({ seed: 3, userTeamIndex: 1, name: 'M' }), game)).toBeUndefined()
  })
  it('ignores a rest that would leave fewer than five healthy players', () => {
    const l = structuredClone(league)
    const mine = committed(l, me.id)
    mine.slice(5).forEach((p) => { p.injury = { type: 'x', gamesRemaining: 5, severity: 'short' } })
    applyEffects(l, [{ kind: 'rest', player: mine[0].id }])
    expect(buildMods(l, game)?.sit ?? []).toEqual([])
  })
  it('expands team buffs over the roster and expires after the last game', () => {
    const l = structuredClone(league)
    applyEffects(l, [{ kind: 'buff', target: 'team', stat: 'shooting', amount: 3, games: 2 }])
    expect(Object.keys(buildMods(l, game)!.shooting)).toHaveLength(committed(l, me.id).length)
    tickEffects(l)
    expect(l.events.active).toHaveLength(1)
    tickEffects(l)
    expect(buildMods(l, game)).toBeUndefined()
  })
})
