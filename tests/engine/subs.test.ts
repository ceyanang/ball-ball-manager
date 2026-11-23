import { describe, expect, it } from 'vitest'
import { generatePlayer } from '../../src/engine/player/generate'
import { Rng } from '../../src/engine/rng'
import { SLOT_IDX } from '../../src/engine/sim/rotation'
import { chooseSubs, type SubInput } from '../../src/engine/sim/subs'
import type { Player, Position } from '../../src/engine/types'

const rng = Rng.fromSeed(7)
function mk(id: string, pos: Position, ovr: number): Player {
  const p = generatePlayer(rng, { season: 1, targetOvr: ovr, pos, age: 27 })
  p.id = id
  p.ratings.stam = 70
  return p
}
const STARTERS: [string, Position][] = [['s0', 'PG'], ['s1', 'SG'], ['s2', 'SF'], ['s3', 'PF'], ['s4', 'C']]
const BENCH: [string, Position][] = [['b0', 'PG'], ['b1', 'SG'], ['b2', 'SF'], ['b3', 'PF'], ['b4', 'C'], ['b5', 'SF'], ['b6', 'PF']]
const players: Record<string, Player> = {}
for (const [id, pos] of STARTERS) players[id] = mk(id, pos, 80)
for (const [id, pos] of BENCH) players[id] = mk(id, pos, 65)

/** A quarter-end-ish snapshot where everyone is exactly on their minutes plan (nobody ahead, nobody owed). */
function base(over: Partial<SubInput> = {}): SubInput {
  const starters = STARTERS.map(([id]) => id)
  const elapsed = over.elapsed ?? 12, gameMinutes = 48
  const target: Record<string, number> = {}
  starters.forEach((id) => (target[id] = 32))
  BENCH.forEach(([id], i) => (target[id] = [22, 18, 14, 10, 4, 2, 0][i]))
  const played: Record<string, number> = {}
  const stint: Record<string, number> = {}
  for (const id of Object.keys(target)) { played[id] = (target[id] * elapsed) / gameMinutes; stint[id] = 2 }
  for (const id of Object.keys(target)) if (!starters.includes(id)) stint[id] = 0
  return {
    period: 2, minuteInPeriod: 0, periodMinutes: 12, elapsed, gameMinutes, margin: 0,
    onCourt: starters, sitting: BENCH.map(([id]) => id), stint, played, target, starters, players, ...over,
  }
}

/** Sitters who have rested the whole game so far, so they are owed their plan minutes. */
const rested = (i: SubInput) => { for (const id of i.sitting) i.played[id] = 0; return i }

describe('chooseSubs', () => {
  it('rests a starter with a long stint and brings in the best-fitting sitter', () => {
    const i = base()
    i.stint.s0 = 13
    i.played.s0 = 13
    i.sitting = ['b4', 'b0', 'b1']
    rested(i)
    expect(chooseSubs(i)).toEqual([{ slot: 0, out: 's0', in: 'b0' }])
  })

  it('prefers an adjacent position over a better but distant one', () => {
    const i = base()
    i.stint.s1 = 13
    i.played.s1 = 13
    const strongC = mk('bigC', 'C', 90)
    i.players = { ...players, bigC: strongC }
    i.target.bigC = 22
    i.played.bigC = 5.5
    i.stint.bigC = 0
    i.sitting = ['bigC', 'b0']
    rested(i)
    const swaps = chooseSubs(i)
    expect(swaps).toHaveLength(1)
    expect(swaps[0]).toEqual({ slot: 1, out: 's1', in: 'b0' })
  })

  it('never makes more than 2 swaps and keeps 5 distinct on court', () => {
    const i = base()
    for (const id of i.onCourt) { i.stint[id] = 14; i.played[id] = 14 }
    rested(i)
    const swaps = chooseSubs(i)
    expect(swaps.length).toBeGreaterThan(0)
    expect(swaps.length).toBeLessThanOrEqual(2)
    const court = [...i.onCourt]
    for (const s of swaps) {
      expect(court[s.slot]).toBe(s.out)
      court[s.slot] = s.in
    }
    expect(new Set(court).size).toBe(5)
  })

  it('does nothing when everyone is on plan', () => {
    expect(chooseSubs(base())).toEqual([])
  })

  it('blowout rests starters, and brings them back when the margin falls under 12', () => {
    const rest = chooseSubs(base({ period: 4, minuteInPeriod: 4, margin: 22, elapsed: 36 }))
    expect(rest.length).toBeGreaterThan(0)
    for (const s of rest) {
      expect(STARTERS.map(([id]) => id)).toContain(s.out)
      expect(s.in.startsWith('b')).toBe(true)
    }
    const swapped = base({ period: 4, minuteInPeriod: 4, margin: 8, elapsed: 36 })
    swapped.onCourt = ['b0', 'b1', 'b2', 'b3', 'b4']
    swapped.sitting = ['s0', 's1', 's2', 's3', 's4', 'b5', 'b6']
    const back = chooseSubs(swapped)
    expect(back.length).toBeGreaterThan(0)
    for (const s of back) expect(s.in.startsWith('s')).toBe(true)
  })

  it('stays put in a blowout margin between 12 and 20', () => {
    const i = base({ period: 4, minuteInPeriod: 4, margin: 15, elapsed: 36 })
    i.onCourt = ['b0', 'b1', 'b2', 'b3', 'b4']
    i.sitting = ['s0', 's1', 's2', 's3', 's4', 'b5', 'b6']
    expect(chooseSubs(i)).toEqual([])
  })

  it('clutch: a close game in the last 4 minutes makes no resting swaps', () => {
    const i = base({ period: 4, minuteInPeriod: 9, margin: 5, elapsed: 45 })
    for (const id of i.onCourt) { i.stint[id] = 14; i.played[id] = 40 }
    expect(chooseSubs(i)).toEqual([])
  })

  it('returns [] when nobody is sitting', () => {
    const i = base({ sitting: [] })
    i.stint.s0 = 20
    expect(chooseSubs(i)).toEqual([])
  })

  it('is deterministic and adjacent-leaning', () => {
    const i = base()
    for (const id of i.onCourt) { i.stint[id] = 12; i.played[id] = 12 }
    rested(i)
    const a = chooseSubs(i), b = chooseSubs(i)
    expect(a).toEqual(b)
    for (const s of a) expect(Math.abs(SLOT_IDX[players[s.in].pos] - s.slot)).toBeLessThanOrEqual(1)
  })
})
