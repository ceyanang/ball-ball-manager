import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { rollInjuries, tickInjuries } from '../../src/engine/sim/injury'
import type { Injury, League } from '../../src/engine/types'

// Plays one full regular season by hand (simUntil doesn't exist yet).
function playSeason(seed: number) {
  const l: League = createLeague({ seed, userTeamIndex: 0, name: 'I' })
  const rng = Rng.fromSeed(seed + 1)
  const all: { playerId: string; injury: Injury; min: number }[] = []
  let injuredInBox = 0
  for (const g of l.games) {
    const res = simGame(l.teams[g.homeId], l.teams[g.awayId], l.players, l.coaches, rng)
    for (const b of res.box) if (l.players[b.playerId].injury && b.min > 0) injuredInBox++
    tickInjuries([g.homeId, g.awayId], l.players)
    for (const inj of rollInjuries(res, l.players, rng)) {
      l.players[inj.playerId].injury = inj.injury
      all.push({ playerId: inj.playerId, injury: { ...inj.injury }, min: res.box.find((b) => b.playerId === inj.playerId)!.min })
    }
  }
  return { all, injuredInBox }
}

const runs = [playSeason(10), playSeason(20), playSeason(30)]

describe('injuries', () => {
  it('are rare: 80–200 per season, long+season <= 25, season-ending <= 8', () => {
    for (const { all } of runs) {
      expect(all.length).toBeGreaterThanOrEqual(80)
      expect(all.length).toBeLessThanOrEqual(200)
      expect(all.filter((i) => i.injury.severity === 'long' || i.injury.severity === 'season').length).toBeLessThanOrEqual(25)
      expect(all.filter((i) => i.injury.severity === 'season').length).toBeLessThanOrEqual(8)
    }
  })
  it('respects severity ranges', () => {
    const range = { dtd: [1, 3], short: [4, 10], long: [11, 25], season: [999, 999] } as const
    for (const { all } of runs)
      for (const { injury } of all) {
        const [lo, hi] = range[injury.severity]
        expect(injury.gamesRemaining).toBeGreaterThanOrEqual(lo)
        expect(injury.gamesRemaining).toBeLessThanOrEqual(hi)
        expect(injury.type.length).toBeGreaterThan(0)
      }
  })
  it('never injures 0-minute players', () => {
    for (const { all } of runs) for (const i of all) expect(i.min).toBeGreaterThan(0)
  })
  it('keeps injured players out of the box when enough are healthy', () => {
    for (const { injuredInBox } of runs) expect(injuredInBox).toBe(0)
  })
  it('tickInjuries decrements and clears at 0', () => {
    const l = createLeague({ seed: 3, userTeamIndex: 0, name: 'T' })
    const t = Object.values(l.teams)[0]
    const p = l.players[t.rotation.starters[0]]
    p.injury = { type: 'Sore knee', gamesRemaining: 2, severity: 'dtd' }
    tickInjuries([t.id], l.players)
    expect(p.injury?.gamesRemaining).toBe(1)
    tickInjuries([t.id], l.players)
    expect(p.injury).toBeNull()
  })
})
