import { describe, expect, it } from 'vitest'
import { TEAM_MINUTES } from '../../src/engine/constants'
import { refreshRotation } from '../../src/engine/gm/cap'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simDays } from '../../src/engine/season/advance'
import { drainPerMinute, simGame } from '../../src/engine/sim/game'
import type { PlayEvent } from '../../src/engine/sim/playlog'
import {
  coachRotation, comfortMinutes, minutesTargets, suggestedMinutes, validateMinutes, validateRotation,
} from '../../src/engine/sim/rotation'
import type { Player, Rotation } from '../../src/engine/types'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'Minutes' })
const teams = Object.values(league.teams)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const rosterOf = (teamId: string) => Object.values(league.players).filter((p) => p.teamId === teamId)

describe('minutes plans', () => {
  it('suggested minutes are whole numbers that total 240', () => {
    for (const t of teams.slice(0, 6)) {
      const m = suggestedMinutes(t.rotation, league.players)
      expect(sum(Object.values(m))).toBe(TEAM_MINUTES)
      for (const v of Object.values(m)) expect(Number.isInteger(v)).toBe(true)
      expect(Object.keys(m).sort()).toEqual([...t.rotation.starters, ...t.rotation.bench].sort())
    }
  })

  it('validates a plan: it must total 240 with 0–48 each', () => {
    const rot = teams[0].rotation
    const ok = { ...rot, minutes: suggestedMinutes(rot, league.players) }
    expect(validateMinutes(ok)).toEqual([])
    expect(validateRotation(ok, rosterOf(teams[0].id).map((p) => p.id))).toEqual([])
    const short = { ...ok, minutes: { ...ok.minutes, [rot.starters[0]]: ok.minutes[rot.starters[0]] - 3 } }
    expect(validateMinutes(short)[0]).toMatch(/3 more minutes/)
    const long = { ...ok, minutes: { ...ok.minutes, [rot.starters[0]]: 49 } }
    expect(validateMinutes(long)[0]).toMatch(/0–48/)
    // Inactive players' minutes never count.
    const extra = { ...ok, minutes: { ...ok.minutes, [rot.inactive[0]]: 30 } }
    expect(validateMinutes(extra)).toEqual([])
  })

  it('the plan drives the targets, and fill-ins share the minutes of the injured', () => {
    const rot = teams[0].rotation
    const plan: Record<string, number> = {}
    rot.starters.forEach((id) => (plan[id] = 40))
    rot.bench.forEach((id, i) => (plan[id] = i < 4 ? 10 : 0))
    const t = minutesTargets({ starters: rot.starters, bench: rot.bench }, league.players, 0, plan)
    for (const id of rot.starters) expect(t[id]).toBeCloseTo(40)
    expect(t[rot.bench[5]]).toBe(0)
    // An injured starter is replaced by someone with no plan entry; the team still plays exactly 240.
    const lineup = { starters: [...rot.starters.slice(1), rot.inactive[0]], bench: rot.bench }
    const t2 = minutesTargets(lineup, league.players, 0, plan)
    expect(sum(Object.values(t2))).toBeCloseTo(TEAM_MINUTES)
    expect(t2[rot.inactive[0]]).toBeGreaterThan(0)
  })

  it('a team plays its planned minutes', () => {
    const a = structuredClone(teams[0])
    const plan: Record<string, number> = {}
    a.rotation.starters.forEach((id, i) => (plan[id] = [40, 38, 36, 30, 28][i]))
    a.rotation.bench.forEach((id, i) => (plan[id] = [24, 20, 14, 10, 0, 0, 0][i]))
    a.rotation.minutes = plan
    const healthy = structuredClone(league.players)
    for (const p of Object.values(healthy)) p.injury = null
    const rng = Rng.fromSeed(4)
    const got: Record<string, number> = {}
    let n = 0
    for (let i = 0; i < 60; i++) {
      const r = simGame(a, teams[1], healthy, league.coaches, rng)
      if (r.ot) continue
      n++
      for (const b of r.box.filter((x) => x.teamId === a.id)) got[b.playerId] = (got[b.playerId] ?? 0) + b.min
    }
    for (const [id, m] of Object.entries(plan)) expect(Math.abs((got[id] ?? 0) / n - m)).toBeLessThanOrEqual(4)
    expect(got[a.rotation.bench[6]] ?? 0).toBe(0)
  })
})

describe('stamina', () => {
  const p = (stamina: number) => ({ ratings: { stamina } }) as Player
  it('high stamina and being hot both slow the drain', () => {
    expect(drainPerMinute(p(90), false)).toBeLessThan(drainPerMinute(p(50), false))
    expect(drainPerMinute(p(70), true)).toBeLessThan(drainPerMinute(p(70), false))
    expect(comfortMinutes(p(90))).toBeGreaterThan(comfortMinutes(p(40)))
  })

  it('logs energy at each break: rested players are fresher than iron men', () => {
    const iron = structuredClone(teams[0])
    const plan: Record<string, number> = {}
    iron.rotation.starters.forEach((id) => (plan[id] = 46))
    iron.rotation.bench.forEach((id, i) => (plan[id] = i === 0 ? 10 : 0))
    iron.rotation.minutes = plan
    const run = (t: typeof iron) => {
      const rng = Rng.fromSeed(8)
      const e: number[] = []
      for (let i = 0; i < 30; i++) {
        const log: PlayEvent[] = []
        simGame(t, teams[1], league.players, league.coaches, rng, log)
        const last = log.filter((x) => x.k === 'periodEnd').at(-1)
        if (last?.k !== 'periodEnd' || !last.energy) throw new Error('no energy logged')
        for (const id of t.rotation.starters) if (last.energy[id] !== undefined) e.push(last.energy[id])
      }
      return sum(e) / e.length
    }
    const rested = run(teams[0]), gassed = run(iron)
    expect(rested).toBeGreaterThan(gassed + 15)
    expect(gassed).toBeLessThan(65)
  })

  it('riding the starters all game is not a free win: the bench is worth its minutes', () => {
    const iron = structuredClone(teams[0])
    const plan: Record<string, number> = {}
    iron.rotation.starters.forEach((id) => (plan[id] = 46))
    iron.rotation.bench.forEach((id, i) => (plan[id] = i === 0 ? 10 : 0))
    iron.rotation.minutes = plan
    const margin = (t: typeof iron) => {
      const rng = Rng.fromSeed(5)
      let d = 0
      for (let i = 0; i < 1500; i++) { const r = simGame(t, teams[1], league.players, league.coaches, rng); d += r.homeScore - r.awayScore }
      return d / 1500
    }
    expect(margin(iron)).toBeLessThan(margin(teams[0]))
  })
})

describe('let the coach run the rotation', () => {
  it('parks the injured and plans around the healthy', () => {
    const roster = structuredClone(rosterOf(teams[0].id))
    const star = roster.find((p) => p.id === teams[0].rotation.starters[0])!
    star.injury = { type: 'Sprain', gamesRemaining: 4, severity: 'short' }
    const rot = coachRotation(roster)
    expect(rot.auto).toBe(true)
    expect(rot.minutes).toBeUndefined()
    expect(rot.inactive).toContain(star.id)
    expect(validateRotation(rot, roster.map((p) => p.id))).toEqual([])
  })

  it('re-picks the user depth chart before each game day when ticked', () => {
    const l = structuredClone(league)
    const t = l.teams[l.userTeamId]
    // A deliberately bad chart: starters and bench reversed.
    const bad: Rotation = { starters: t.rotation.bench.slice(0, 5), bench: [...t.rotation.starters, ...t.rotation.bench.slice(5)], inactive: t.rotation.inactive, auto: true }
    t.rotation = bad
    const next = simDays(l, 1)
    const after = next.teams[next.userTeamId].rotation
    expect(after.auto).toBe(true)
    expect(after.starters).not.toEqual(bad.starters)
  })

  it('a hand-set plan survives a day; a roster move rescales it to 240', () => {
    const l = structuredClone(league)
    const t = l.teams[l.userTeamId]
    const { auto: _auto, ...manual } = t.rotation
    t.rotation = { ...manual, minutes: suggestedMinutes(t.rotation, l.players) }
    const next = simDays(l, 1)
    expect(next.teams[next.userTeamId].rotation.minutes).toEqual(t.rotation.minutes)
    // Cut a bench player: the plan is rescaled over who is left, so it still totals 240.
    const gone = t.rotation.bench[0]
    l.players[gone].teamId = null
    refreshRotation(l, l.userTeamId)
    const after = l.teams[l.userTeamId].rotation
    expect(after.minutes).toBeDefined()
    expect(after.minutes![gone]).toBeUndefined()
    expect(validateMinutes(after)).toEqual([])
  })
})
