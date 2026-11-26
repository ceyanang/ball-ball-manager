import { describe, expect, it } from 'vitest'
import { GmError, committed, ovr } from '../../src/engine/gm/cap'
import { TRAINING_SLOTS, breakoutChance, isTraining, pruneTraining, startTraining, stopTraining } from '../../src/engine/gm/training'
import { createLeague } from '../../src/engine/league/create'
import { progressTick } from '../../src/engine/player/progress'
import { Rng } from '../../src/engine/rng'
import { simUntil } from '../../src/engine/season/advance'
import type { League, Player } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 5, userTeamIndex: 4, name: 'Dev' })
const mine = (l: League) => committed(l, l.userTeamId)

describe('development slots', () => {
  it('holds three players, only from your own roster, and frees the slot when he leaves', () => {
    const l = fresh()
    const [a, b, c, d] = mine(l)
    for (const p of [a, b, c]) startTraining(l, p.id)
    expect(l.training).toHaveLength(TRAINING_SLOTS)
    expect(() => startTraining(l, d.id)).toThrow(GmError)
    expect(() => startTraining(l, a.id)).toThrow(/already/)
    const other = Object.values(l.players).find((p) => p.teamId && p.teamId !== l.userTeamId)!
    stopTraining(l, c.id)
    expect(() => startTraining(l, other.id)).toThrow(/own roster/)
    b.teamId = null // traded or released away
    pruneTraining(l)
    expect(isTraining(l, b.id)).toBe(false)
    expect(l.training.map((t) => t.playerId)).toEqual([a.id])
  })
  it('late picks bloom more often than lottery picks, and the young more than the old', () => {
    const base = mine(fresh())[0]
    const as = (age: number, draft: Player['draft']): Player => ({ ...base, age, draft })
    const late = breakoutChance(as(21, { season: 0, round: 2, pick: 50, teamId: 'x' }), 1)
    const lottery = breakoutChance(as(21, { season: 0, round: 1, pick: 3, teamId: 'x' }), 1)
    const old = breakoutChance(as(31, { season: 0, round: 2, pick: 50, teamId: 'x' }), 1)
    expect(late).toBeGreaterThan(lottery * 2)
    expect(late).toBeGreaterThan(old * 5)
    expect(breakoutChance(as(21, null), 1.4)).toBeGreaterThan(breakoutChance(as(21, null), 0.7))
  })
  it('an invested prospect grows faster, and sometimes breaks out past his ceiling', () => {
    const l = fresh()
    const p = mine(l).filter((x) => ovr(x) < 82).sort((x, y) => x.age - y.age)[0] ?? mine(l).sort((x, y) => x.age - y.age)[0]
    p.age = 21
    p.draft = { season: 0, round: 2, pick: 55, teamId: p.teamId! }
    const run = (invest: boolean) => {
      const ratings = { ...p.ratings }, pot = p.pot, tid = p.teamId
      l.training = invest ? [{ playerId: p.id, season: 1, day: 1 }] : []
      let gain = 0, breakouts = 0, potGain = 0
      for (let i = 0; i < 400; i++) {
        p.ratings = { ...ratings }
        p.pot = ovr(p) + 6
        const before = ovr(p), potBefore = p.pot
        const evs = progressTick(l, Rng.fromSeed(1000 + i))
        gain += ovr(p) - before
        for (const e of evs) if (e.playerId === p.id && e.breakout) { breakouts++; potGain += e.breakout.potTo - e.breakout.potFrom }
        expect(p.pot).toBeGreaterThanOrEqual(potBefore)
      }
      p.ratings = ratings; p.pot = pot; p.teamId = tid
      return { gain: gain / 400, breakouts, potGain }
    }
    const control = run(false), invested = run(true)
    expect(control.breakouts).toBe(0)
    expect(invested.gain).toBeGreaterThan(control.gain + 0.1)
    expect(invested.breakouts).toBeGreaterThan(3)
    expect(invested.potGain / invested.breakouts).toBeGreaterThanOrEqual(3)
  })
  it('does nothing to anyone when nobody is invested', () => {
    const a = fresh(), b = fresh()
    const ea = progressTick(a, Rng.fromSeed(9)), eb = progressTick(b, Rng.fromSeed(9))
    expect(ea).toEqual(eb)
    expect(ea.some((e) => e.breakout)).toBe(false)
  })
  it('survives a full season and summer: slots stay on your roster and nobody invested loses ground to the program', { timeout: 60_000 }, () => {
    const l = fresh()
    for (const p of mine(l).slice(0, 3)) startTraining(l, p.id)
    const end = simUntil(l, 'playoffsEnd')
    expect(end.phase).toBe('offseason')
    expect(end.training.length).toBeLessThanOrEqual(TRAINING_SLOTS)
    for (const t of end.training) expect(end.players[t.playerId].teamId).toBe(end.userTeamId)
    for (const e of end.progress) if (e.breakout) expect(e.breakout.potTo).toBeGreaterThan(e.breakout.potFrom)
  })
})
