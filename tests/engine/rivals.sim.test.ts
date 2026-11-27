import { describe, expect, it } from 'vitest'
import { buildMods, type GameMods } from '../../src/engine/events/mods'
import { committed } from '../../src/engine/gm/cap'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { drawRivalForms, rivalTilt } from '../../src/engine/rivals/tilt'
import { simGame } from '../../src/engine/sim/game'
import type { Game, League, StatLine } from '../../src/engine/types'

const league = createLeague({ seed: 3, userTeamIndex: 0, name: 'V' })
const home = league.teams.t_dal, away = league.teams.t_hou
const homeIds = committed(league, home.id).map((p) => p.id)
const empty = (): GameMods => ({ shooting: {}, defense: {}, energy: {}, sit: [], chemistry: {} })
const vol = (t: number): GameMods => ({ ...empty(), volatility: Object.fromEntries(homeIds.map((id) => [id, t])) })
const run = (n: number, mods?: GameMods) => {
  const rng = Rng.fromSeed(11)
  return Array.from({ length: n }, () => simGame(home, away, league.players, league.coaches, rng, undefined, mods))
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) }

describe('rival volatility in the sim', () => {
  it('empty volatility is bit-identical to no mods', () => {
    expect(run(5, { ...empty(), volatility: {} })).toEqual(run(5, undefined))
  })
  it('positive tilt scores more than negative tilt', () => {
    expect(mean(run(200, vol(1)).map((r) => r.homeScore))).toBeGreaterThan(mean(run(200, vol(-1)).map((r) => r.homeScore)) + 2)
  })
  it('neutral volatility widens each player\'s night-to-night swing', () => {
    const top = homeIds.slice(0, 7)
    const spread = (rs: ReturnType<typeof run>) => mean(top.map((id) => sd(rs.map((r) => r.box.find((b) => b.playerId === id)?.pts ?? 0))))
    expect(spread(run(400, vol(0)))).toBeGreaterThan(spread(run(400)) + 0.3)
  })
})

describe('buildMods for rival games', () => {
  const g = (homeId: string, awayId: string) => ({ id: 'x', season: 1, day: 1, homeId, awayId, playoff: null, result: null }) as Game
  it('AI-vs-AI rival games get volatility for rostered players; AI non-rival games get none', () => {
    const m = buildMods(league, g('t_dal', 't_hou'))
    expect(m?.volatility).toBeDefined()
    for (const id of homeIds) expect(m!.volatility![id]).toBeDefined()
    expect(buildMods(league, g('t_dal', 't_sac'))).toBeUndefined()
  })
})

describe('rivalTilt', () => {
  const lg = (): League => { const l = structuredClone(league); l.season = 5; l.history = [{ season: 4 } as never]; return l }
  const lines = (l: League, id: string, team: string, seasons: number[]) => {
    for (const s of seasons) l.statLines[`${id}_${s}_${team}`] = { playerId: id, teamId: team, season: s, playoffs: false, gp: 40 } as StatLine
  }
  it('3+ completed seasons with the team is a vet (+1), 1–2 is neutral, none is new (−1)', () => {
    const l = lg()
    const [a, b, c] = Object.values(l.players).filter((p) => p.teamId === 't_dal')
    lines(l, a.id, 't_dal', [2, 3, 4]); lines(l, b.id, 't_dal', [4])
    expect(rivalTilt(l, a, 't_dal')).toBe(1)
    expect(rivalTilt(l, b, 't_dal')).toBe(0)
    expect(rivalTilt(l, c, 't_dal')).toBe(-1)
  })
  it('this season and other teams do not count as tenure', () => {
    const l = lg()
    const p = Object.values(l.players).find((x) => x.teamId === 't_dal')!
    lines(l, p.id, 't_dal', [5]); lines(l, p.id, 't_hou', [2, 3, 4])
    expect(rivalTilt(l, p, 't_dal')).toBe(-1)
  })
  it('in a founding league with no history nobody is tilted', () => {
    const p = Object.values(league.players).find((x) => x.teamId === 't_dal')!
    expect(rivalTilt(league, p, 't_dal')).toBe(0)
  })
})

describe('rival form draws never touch the shared sim rng', () => {
  it('drawRivalForms leaves the rng state alone and is deterministic', () => {
    const rng = Rng.fromSeed(77)
    rng.next()
    const before = { ...rng.state }
    const a = drawRivalForms(rng, { a: 1, b: -1, c: 0 }, 0.03, 0.1)
    expect(rng.state).toEqual(before)
    expect(drawRivalForms(rng, { a: 1, b: -1, c: 0 }, 0.03, 0.1)).toEqual(a)
    expect(Object.keys(a).sort()).toEqual(['a', 'b', 'c'])
  })
})
