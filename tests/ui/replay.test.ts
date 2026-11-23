import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { boxFromLog, type PlayEvent } from '../../src/engine/sim/playlog'
import type { GameResult, Team } from '../../src/engine/types'
import {
  advanceTo, beatsAverage, benchLine, clockText, describePlays, elapsedFraction, finalState, initState, isHot, onPace, periodCount,
  periodLabel, periodMs, shotDelays, shotMs, ftGapMs, standout, sittingIds, courtCard,
} from '../../src/ui/watch/replay'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const teams = Object.values(league.teams)

function game(s: number) {
  const r = Rng.fromSeed(1000 + s)
  const home: Team = r.pick(teams)
  let away: Team = r.pick(teams)
  while (away.id === home.id) away = r.pick(teams)
  const log: PlayEvent[] = []
  const res: GameResult = simGame(home, away, league.players, league.coaches, Rng.fromSeed(s), log)
  return { res, log }
}
const games = Array.from({ length: 100 }, (_, i) => game(i + 1))
const keys = ['pts', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta'] as const

describe('replay model', () => {
  it('finalState matches boxFromLog and the final score', () => {
    for (const { res, log } of games) {
      const f = finalState(log)
      const box = boxFromLog(log)
      for (const [id, b] of Object.entries(box)) {
        for (const k of keys) expect(f.lines[id][k], `${id} ${k}`).toBe(b[k])
        expect(f.lines[id].reb).toBe(b.oreb + b.dreb)
        expect(f.lines[id].byPeriod.reduce((s, x) => s + x, 0)).toBe(b.pts)
      }
      expect(f.home).toBe(res.homeScore)
      expect(f.away).toBe(res.awayScore)
    }
  })

  it('random stepping ends in finalState and never mutates', () => {
    const r = Rng.fromSeed(7)
    for (const { log } of games.slice(0, 30)) {
      let s = initState()
      const n = periodCount(log)
      const steps = 1000
      for (let i = 1; i <= steps; i++) {
        const x = (i / steps) * n
        const period = Math.min(n, Math.floor(x) + 1)
        const t = Math.min(1, x - (period - 1) + r.next() * 0.001)
        s = advanceTo(log, s, period, t).state
      }
      s = advanceTo(log, s, n, 1).state
      expect(s).toEqual(finalState(log))
    }
  })

  it('advanceTo is immutable and reports fired events', () => {
    const { log } = games[0]
    const s0 = initState()
    const snap = JSON.stringify(s0)
    const { state, fired } = advanceTo(log, s0, 1, 0.5)
    expect(JSON.stringify(s0)).toBe(snap)
    expect(fired.length).toBe(state.cursor)
    expect(fired.every(e => e.period === 1 && e.t <= 0.5)).toBe(true)
    const again = advanceTo(log, state, 1, 0.5)
    expect(again.fired).toEqual([])
    expect(again.state).toEqual(state)
  })

  it('min/pm update only at period end', () => {
    const { log } = games[0]
    const mid = advanceTo(log, initState(), 1, 0.99).state
    expect(Object.values(mid.lines).every(l => l.min === 0 && l.pm === 0)).toBe(true)
    const end = advanceTo(log, initState(), 1, 1).state
    expect(Object.values(end.lines).some(l => l.min > 0)).toBe(true)
  })

  it('handles overtime labels and counts', () => {
    const ot = games.find(g => periodCount(g.log) >= 5)
    expect(ot).toBeTruthy()
    expect(periodLabel(1)).toBe('Q1')
    expect(periodLabel(5)).toBe('OT')
    expect(periodLabel(6)).toBe('2OT')
    expect(periodMs(4)).toBe(15000)
    expect(periodMs(5)).toBe(6250)
  })

  it('isHot / onPace / elapsedFraction', () => {
    expect(isHot(18, 10, 0.5)).toBe(true)
    expect(isHot(12, 10, 0.5)).toBe(false)
    expect(isHot(9, 0, 0.5)).toBe(false)
    expect(isHot(30, null, 0.5)).toBe(false)
    expect(onPace(10, 0.5)).toBe(20)
    expect(onPace(0, 0)).toBe(0)
    expect(elapsedFraction(2, 0.5)).toBe(0.375)
    expect(elapsedFraction(5, 1)).toBe(53 / 48)
  })

  it('benchLine sums and standout picks the biggest over-performer', () => {
    const { log } = games[0]
    const f = finalState(log)
    const ids = Object.keys(f.lines).slice(0, 3)
    const b = benchLine(f, ids)
    expect(b.pts).toBe(ids.reduce((s, i) => s + f.lines[i].pts, 0))
    expect(b.min).toBe(ids.reduce((s, i) => s + f.lines[i].min, 0))
    expect(b.byPeriod.reduce((s, x) => s + x, 0)).toBe(b.pts)
    expect(benchLine(f, []).pts).toBe(0)
    const st = { ...f, lines: { a: { ...b, pts: 10 }, b: { ...b, pts: 12 } } }
    expect(standout(st, { a: 2, b: 20 }, 1, ['a', 'b'])).toBe('a')
    expect(standout(st, { a: 2 }, 1, ['a', 'b'])).toBe('b')
    expect(standout(st, {}, 1, [])).toBeNull()
  })

  it('describePlays narrates the newest play', () => {
    const at = { period: 1, t: 0.5 }
    const last = (id: string) => id.toUpperCase()
    const fg = (player: string, made: boolean, three = false): PlayEvent => ({ ...at, k: 'fg', side: 'home', player, made, three, home: 0, away: 0 })
    const ft = (player: string, made: boolean): PlayEvent => ({ ...at, k: 'ft', side: 'home', player, made, home: 0, away: 0 })
    const ev = (k: 'reb' | 'ast' | 'stl' | 'blk' | 'tov', player: string, extra: object = {}): PlayEvent =>
      ({ ...at, k, side: 'home', player, ...extra }) as PlayEvent
    expect(describePlays([fg('a', true)], last)).toBe('A scores')
    expect(describePlays([fg('a', true, true), ev('ast', 'b')], last)).toBe('A from deep · dime from B')
    expect(describePlays([fg('a', true), ev('ast', 'b'), ft('a', true)], last)).toBe('A scores · dime from B · and one! 🎯 A at the line: 1/1')
    expect(describePlays([fg('a', false), ev('reb', 'c', { off: false })], last)).toBe('A misses · C with the board')
    expect(describePlays([fg('a', false, true), ev('reb', 'c', { off: true })], last)).toBe('A misses from three · C grabs the offensive board')
    expect(describePlays([fg('a', false), ev('blk', 'd'), ev('reb', 'c', { off: false })], last)).toBe('🚫 BLK! D swats A · C with the board')
    expect(describePlays([ft('a', true), ft('a', false), ev('reb', 'c', { off: false })], last)).toBe('🎯 A at the line: 1/2 · C with the board')
    expect(describePlays([ev('tov', 'a'), ev('stl', 'e')], last)).toBe("E picks A's pocket")
    expect(describePlays([ev('tov', 'a')], last)).toBe('A turns it over')
    // Newest segment wins: a miss, then the putback.
    expect(describePlays([fg('a', false), ev('reb', 'c', { off: true }), fg('c', true)], last)).toBe('C scores')
    expect(describePlays([{ period: 1, t: 1, k: 'periodEnd', min: {}, pm: {} }], last)).toBeNull()
    expect(describePlays([], last)).toBeNull()
  })

  it('beatsAverage and clockText', () => {
    expect(beatsAverage(12, 11.5)).toBe(true)
    expect(beatsAverage(11, 11.5)).toBe(false)
    expect(beatsAverage(8, 4.2)).toBe(false)
    expect(beatsAverage(30, null)).toBe(false)
    expect(clockText(1, 0)).toBe('12:00')
    expect(clockText(1, 0.5)).toBe('6:00')
    expect(clockText(2, 1)).toBe('0:00')
    expect(clockText(5, 0)).toBe('5:00')
    expect(clockText(3, 0.999)).toBe('0:01')
  })

  it('shotDelays: free throws a beat apart, and-ones after the make (assist or not)', () => {
    const at = { period: 2, t: 0.3 }
    const fg = (made: boolean): PlayEvent => ({ ...at, k: 'fg', side: 'home', player: 'a', made, three: false, home: 0, away: 0 })
    const ft = (player = 'a'): PlayEvent => ({ ...at, k: 'ft', side: 'home', player, made: true, home: 0, away: 0 })
    const ast: PlayEvent = { ...at, k: 'ast', side: 'home', player: 'b' }
    const reb: PlayEvent = { ...at, k: 'reb', side: 'away', player: 'c', off: false }
    expect(shotDelays([fg(true), ast, ft()], 4)).toEqual([0, 0, shotMs(4)])
    expect(shotDelays([fg(true), ft()], 1)).toEqual([0, shotMs(1)])
    expect(shotDelays([ft(), ft(), ft(), reb], 2)).toEqual([0, ftGapMs(2), 2 * ftGapMs(2), 0])
    expect(shotDelays([fg(true), ast, ft('z')], 1)).toEqual([0, 0, 0])
    expect(shotDelays([fg(false), ft()], 1)).toEqual([0, 0])
  })
})

describe('replay court model', () => {
  const handCourt = (log: PlayEvent[]) => {
    const c: Record<string, string[]> = {}
    for (const e of log) {
      if (e.k === 'lineup') c[e.side] = [...e.players]
      else if (e.k === 'sub') c[e.side][e.slot] = e.in
    }
    return c
  }
  it('court is built from lineup and sub events and matches the hand-replayed final lineup', () => {
    for (const { log } of games.slice(0, 50)) {
      const f = finalState(log)
      expect(f.court).toEqual(handCourt(log))
      expect(f.court!.home).toHaveLength(5)
      expect(f.court!.away).toHaveLength(5)
    }
  })
  it('legacy logs without lineup events leave court null', () => {
    const { log } = games[0]
    const legacy = log.filter((e) => e.k !== 'lineup' && e.k !== 'sub')
    expect(finalState(legacy).court).toBeNull()
    expect(initState().court).toBeNull()
  })
  it('advanceTo never mutates the court of the previous state', () => {
    const { log } = games[1]
    const mid = advanceTo(log, initState(), 2, 0.5).state
    const snap = JSON.stringify(mid.court)
    const next = advanceTo(log, mid, 4, 1).state
    expect(JSON.stringify(mid.court)).toBe(snap)
    expect(next.court).not.toBe(mid.court)
  })
  it('sittingIds returns everyone not on court, in input order', () => {
    expect(sittingIds(['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['b', 'd', 'e', 'f', 'g'])).toEqual(['a', 'c'])
  })
  it('courtCard resolves the slot a player stands in right now', () => {
    const { log } = games[2]
    const sub = log.find((e): e is Extract<PlayEvent, { k: 'sub' }> => e.k === 'sub')!
    const before = advanceTo(log, initState(), sub.period, Math.max(0, sub.t - 1e-9)).state
    const after = advanceTo(log, before, sub.period, sub.t).state
    expect(courtCard(before, sub.side, sub.out)).toBe(sub.slot)
    expect(courtCard(after, sub.side, sub.out)).toBeNull()
    expect(courtCard(after, sub.side, sub.in)).toBe(sub.slot)
    expect(courtCard(initState(), 'home', 'x')).toBeNull()
  })
})
