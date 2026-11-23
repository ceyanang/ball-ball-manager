import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { boxFromLog, quartersFromLog, type PlayEvent } from '../../src/engine/sim/playlog'
import { SLOT_IDX } from '../../src/engine/sim/rotation'
import type { GameResult, Team } from '../../src/engine/types'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const teams = Object.values(league.teams)

function matchup(s: number): [Team, Team] {
  const r = Rng.fromSeed(1000 + s)
  const home = r.pick(teams)
  let away = r.pick(teams)
  while (away.id === home.id) away = r.pick(teams)
  return [home, away]
}

function sample(n: number) {
  const out: { res: GameResult; log: PlayEvent[]; plain: GameResult; rngA: number; rngB: number }[] = []
  for (let s = 1; s <= n; s++) {
    const [home, away] = matchup(s)
    const a = Rng.fromSeed(s), b = Rng.fromSeed(s)
    const plain = simGame(home, away, league.players, league.coaches, a)
    const log: PlayEvent[] = []
    const res = simGame(home, away, league.players, league.coaches, b, log)
    out.push({ res, log, plain, rngA: a.next(), rngB: b.next() })
  }
  return out
}
const games = sample(300)

describe('simGame play log', () => {
  it('does not change results', () => {
    for (const g of games) {
      expect(g.res).toEqual(g.plain)
      expect(g.rngB).toBe(g.rngA)
    }
  })

  it('rebuilds every box line', () => {
    const keys = ['pts', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'] as const
    for (const { res, log } of games) {
      const box = boxFromLog(log)
      for (const line of res.box) {
        for (const k of keys) expect(box[line.playerId]?.[k] ?? 0, `${line.playerId} ${k}`).toBe(line[k])
      }
    }
  })

  it('rebuilds quarter scores, including OT', () => {
    const ot = games.filter((g) => g.res.ot > 0)
    expect(ot.length).toBeGreaterThan(0)
    for (const { res, log } of games) expect(quartersFromLog(log)).toEqual(res.quarters)
    for (const { res, log } of ot) {
      const ends = log.filter((e) => e.k === 'periodEnd').map((e) => e.period)
      expect(ends).toEqual(Array.from({ length: 4 + res.ot }, (_, i) => i + 1))
    }
  })

  it('orders events inside each period', () => {
    for (const { res, log } of games) {
      let period = 0, last = 0
      for (const e of log) {
        if (e.period !== period) { period = e.period; last = 0 }
        expect(e.t).toBeGreaterThanOrEqual(last)
        if (e.k !== 'periodEnd') { expect(e.t).toBeLessThan(1); last = e.t }
      }
      const scoring = log.filter((e) => e.k === 'fg' || e.k === 'ft').pop()!
      expect(scoring).toMatchObject({ home: res.homeScore, away: res.awayScore })
    }
  })

  it('ends each period with minutes and plus-minus', () => {
    for (const { res, log } of games) {
      const end = log.filter((e) => e.k === 'periodEnd').pop()!
      if (end.k !== 'periodEnd') throw new Error('unreachable')
      for (const line of res.box) {
        expect(end.min[line.playerId]).toBe(line.min)
        expect(end.pm[line.playerId]).toBe(line.pm)
      }
    }
  })
})

describe('lineup and sub events', () => {
  it('boxFromLog and quartersFromLog ignore lineup and sub events', () => {
    const log: PlayEvent[] = [
      { k: 'lineup', side: 'home', players: ['a', 'b', 'c', 'd', 'e'], period: 1, t: 0 },
      { k: 'sub', side: 'home', out: 'b', in: 'f', slot: 1, period: 1, t: 0.2 },
      { k: 'fg', side: 'home', player: 'a', made: true, three: false, home: 2, away: 0, period: 1, t: 0.5 },
      { k: 'periodEnd', min: {}, pm: {}, period: 1, t: 1 },
    ]
    const box = boxFromLog(log)
    expect(Object.keys(box)).toEqual(['a'])
    expect(box.a).toMatchObject({ pts: 2, fgm: 1, fga: 1, ast: 0, tov: 0 })
    expect(quartersFromLog(log)).toEqual({ home: [2], away: [0] })
  })
})

describe('simGame substitutions in the log', () => {
  const subGames = games.slice(0, 100)

  it('logs a lineup per side and replaying subs always leaves 5 distinct players', () => {
    let subs = 0
    for (const { log } of subGames) {
      const court: Record<string, string[]> = {}
      for (const e of log) {
        if (e.k === 'lineup') {
          expect(e.period).toBe(1)
          expect(court[e.side]).toBeUndefined()
          expect(e.players).toHaveLength(5)
          court[e.side] = [...e.players]
        } else if (e.k === 'sub') {
          subs++
          const c = court[e.side]
          expect(c[e.slot]).toBe(e.out)
          expect(c).not.toContain(e.in)
          c[e.slot] = e.in
          expect(new Set(c).size).toBe(5)
        }
      }
      expect(Object.keys(court).sort()).toEqual(['away', 'home'])
    }
    expect(subs).toBeGreaterThan(100)
  })

  it('most swaps are the same or an adjacent position', () => {
    let near = 0, all = 0
    for (const { log } of subGames) {
      for (const e of log) {
        if (e.k !== 'sub') continue
        all++
        if (Math.abs(SLOT_IDX[league.players[e.in].pos] - e.slot) <= 1) near++
      }
    }
    expect(all).toBeGreaterThan(100)
    expect(near / all).toBeGreaterThanOrEqual(0.7)
  })
})
