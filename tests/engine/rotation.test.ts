import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { autoRotation, bestStartingFive, gameLineup, lineupPenalties, minutesTargets, slotFit, validateRotation } from '../../src/engine/sim/rotation'
import { generatePlayer } from '../../src/engine/player/generate'
import { Rng } from '../../src/engine/rng'
import type { Position } from '../../src/engine/types'
import type { League, Player, Team } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 31, userTeamIndex: 0, name: 'R' })
const rosterOf = (l: League, t: Team) => Object.values(l.players).filter((p) => p.teamId === t.id)
const firstTeam = (l: League) => Object.values(l.teams)[0]
const hurt = (p: Player, games: number) => { p.injury = { type: 'Ankle sprain', gamesRemaining: games, severity: 'dtd' } }

describe('autoRotation', () => {
  it('is valid for every created team and includes a guard and a big among starters', () => {
    const l = fresh()
    for (const t of Object.values(l.teams)) {
      const roster = rosterOf(l, t)
      const rot = autoRotation(roster)
      expect(validateRotation(rot, roster.map((p) => p.id))).toEqual([])
      const starters = rot.starters.map((id) => l.players[id])
      expect(starters.some((p) => p.pos === 'PG' || p.pos === 'SG')).toBe(true)
      expect(starters.some((p) => p.pos === 'PF' || p.pos === 'C')).toBe(true)
      expect(t.rotation).toEqual(rot)
    }
  })
})

describe('bestStartingFive', () => {
  const rng = Rng.fromSeed(8)
  const mk = (pos: Position, ovr: number) => generatePlayer(rng, { season: 1, pos, targetOvr: ovr })
  it('lines up PG, SG, SF, PF, C from a balanced roster', () => {
    const roster = (['C', 'PF', 'SF', 'SG', 'PG'] as Position[]).flatMap((pos) => [mk(pos, 80), mk(pos, 70)])
    expect(bestStartingFive(roster).map((p) => p.pos)).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
  })
  it('starts a far better SG at point guard over a weak PG', () => {
    const roster = [mk('PG', 62), mk('SG', 90), mk('SG', 80), mk('SF', 78), mk('PF', 78), mk('C', 78), mk('SF', 60), mk('C', 60)]
    const five = bestStartingFive(roster)
    expect(five.map((p) => p.pos)).toEqual(['SG', 'SG', 'SF', 'PF', 'C'])
  })
  it('never starts a guard at center when a real big is close in talent', () => {
    const roster = [mk('PG', 85), mk('PG', 84), mk('SG', 82), mk('SF', 80), mk('PF', 79), mk('C', 76)]
    expect(bestStartingFive(roster)[4].pos).toBe('C')
  })
  it('is deterministic and gives the slot fit penalty for off-position play', () => {
    const p = mk('PG', 80)
    expect(slotFit(p, 'PG')).toBeGreaterThan(slotFit(p, 'SG'))
    expect(slotFit(p, 'SG')).toBeGreaterThan(slotFit(p, 'C'))
  })
})

describe('validateRotation', () => {
  const l = fresh()
  const t = firstTeam(l)
  const ids = rosterOf(l, t).map((p) => p.id)
  const ok = t.rotation
  it('accepts the auto rotation', () => expect(validateRotation(ok, ids)).toEqual([]))
  it('rejects wrong starter count', () =>
    expect(validateRotation({ ...ok, starters: ok.starters.slice(0, 4), inactive: [...ok.inactive, ok.starters[4]] }, ids).length).toBeGreaterThan(0))
  it('rejects more than 12 active', () =>
    expect(validateRotation({ ...ok, bench: [...ok.bench, ...ok.inactive], inactive: [] }, ids).length).toBeGreaterThan(0))
  it('rejects duplicates', () =>
    expect(validateRotation({ ...ok, bench: [...ok.bench.slice(1), ok.starters[0]] , inactive: [...ok.inactive, ok.bench[0]] }, ids).length).toBeGreaterThan(0))
  it('rejects an id not on the roster', () =>
    expect(validateRotation({ ...ok, inactive: [...ok.inactive, 'p_ghost'] }, ids).length).toBeGreaterThan(0))
  it('rejects a missing roster player', () =>
    expect(validateRotation({ ...ok, inactive: ok.inactive.slice(1) }, ids).length).toBeGreaterThan(0))
})

describe('gameLineup', () => {
  it('fills an injured starter\'s slot with the healthy bench player who fits that position best', () => {
    const l = fresh()
    const t = firstTeam(l)
    hurt(l.players[t.rotation.starters[2]], 3)
    const lu = gameLineup(t, l.players)
    expect(lu.starters).toHaveLength(5)
    expect(lu.starters).not.toContain(t.rotation.starters[2])
    const sub = lu.starters[2]
    expect(t.rotation.bench).toContain(sub)
    for (const id of t.rotation.bench) expect(slotFit(l.players[sub], 'SF')).toBeGreaterThanOrEqual(slotFit(l.players[id], 'SF'))
    expect([0, 1, 3, 4].map((i) => lu.starters[i])).toEqual([0, 1, 3, 4].map((i) => t.rotation.starters[i]))
    expect(lu.starters.length + lu.bench.length).toBe(12)
  })
  it('never includes injured players when enough are healthy', () => {
    const l = fresh()
    const t = firstTeam(l)
    hurt(l.players[t.rotation.bench[1]], 5)
    const lu = gameLineup(t, l.players)
    expect([...lu.starters, ...lu.bench]).not.toContain(t.rotation.bench[1])
  })
  it('with only 3 healthy players still fields 5, using the 2 least-injured', () => {
    const l = fresh()
    const t = firstTeam(l)
    const roster = rosterOf(l, t)
    roster.slice(3).forEach((p, i) => hurt(p, 10 + i))
    const lu = gameLineup(t, l.players)
    expect(lu.starters).toHaveLength(5)
    const healthy = roster.slice(0, 3).map((p) => p.id)
    for (const id of healthy) expect(lu.starters).toContain(id)
    expect(lu.starters).toContain(roster[3].id)
    expect(lu.starters).toContain(roster[4].id)
  })
})

describe('minutesTargets', () => {
  const l = fresh()
  const t = firstTeam(l)
  const lu = gameLineup(t, l.players)
  it('sums exactly to 240 and 265 with one OT', () => {
    const sum = (m: Record<string, number>) => Object.values(m).reduce((s, x) => s + x, 0)
    expect(sum(minutesTargets(lu, l.players, 0))).toBeCloseTo(240, 6)
    expect(sum(minutesTargets(lu, l.players, 1))).toBeCloseTo(265, 6)
  })
  it('gives starters more than the bench, nobody over 48', () => {
    const m = minutesTargets(lu, l.players, 0)
    const avg = (ids: string[]) => ids.reduce((s, id) => s + m[id], 0) / ids.length
    expect(avg(lu.starters)).toBeGreaterThan(avg(lu.bench))
    for (const v of Object.values(m)) expect(v).toBeLessThanOrEqual(48)
    for (const id of lu.starters) expect(m[id]).toBeGreaterThanOrEqual(26)
  })
})

describe('lineupPenalties', () => {
  const rng = Rng.fromSeed(3)
  const mk = (id: string, pos: Position) => { const p = generatePlayer(rng, { season: 1, targetOvr: 75, pos, age: 27 }); p.id = id; return p }
  const pl: Record<string, Player> = {}
  for (const [id, pos] of [['pg', 'PG'], ['sg', 'SG'], ['sf', 'SF'], ['pf', 'PF'], ['c', 'C'], ['bc', 'C']] as [string, Position][]) pl[id] = mk(id, pos)

  it('re-slots a mixed group optimally, so a C wearing the SG card is not penalised', () => {
    const pen = lineupPenalties(['pg', 'bc', 'sf', 'pf', 'sg'], ['pg', 'sg', 'sf', 'pf', 'c'], pl)
    expect(Object.values(pen).every((v) => v <= 2.5)).toBe(true)
  })

  it('keeps the coach-set slots while all five starters are on the floor, in any card order', () => {
    const scrambled = ['c', 'pf', 'sf', 'sg', 'pg']
    const pen = lineupPenalties(['pg', 'sg', 'sf', 'pf', 'c'], scrambled, pl)
    expect(pen.c).toBeGreaterThan(20)
    expect(pen.pg).toBeGreaterThan(20)
  })
})
