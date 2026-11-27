import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { updateFans } from '../../src/engine/stories/sentiment'
import type { Game, League } from '../../src/engine/types'

const base = createLeague({ seed: 3, userTeamIndex: 0, name: 'F' })
const result = simGame(base.teams.t_atl, base.teams.t_sac, base.players, base.coaches, Rng.fromSeed(9))
const game = { id: 'g', season: 1, day: 1, homeId: 't_atl', awayId: 't_sac', playoff: null, result } as Game
const run = (rivals: boolean): League => {
  const l = structuredClone(base)
  if (rivals) l.rivalry.dynamic.t_atl = ['t_sac']
  updateFans(l, game)
  return l
}
const homeWon = result.homeScore > result.awayScore

describe('rival game fan and morale swings', () => {
  const normal = run(false), rival = run(true)
  it('team fans swing 1.5× as hard', () => {
    for (const id of ['t_atl', 't_sac']) {
      expect(Math.abs(rival.fans.teams[id] - normal.fans.teams[id] * 1.5)).toBeLessThanOrEqual(1)
      expect(Math.abs(rival.fans.teams[id])).toBeGreaterThan(Math.abs(normal.fans.teams[id]))
    }
  })
  it('player buzz swings 1.5× as hard for rotation players', () => {
    const played = result.box.filter((b) => b.min >= 6)
    expect(played.length).toBeGreaterThan(6)
    for (const b of played) {
      const n = normal.fans.players[b.playerId] ?? 0, r = rival.fans.players[b.playerId] ?? 0
      expect(Math.abs(r - n * 1.5)).toBeLessThanOrEqual(1.5)
    }
  })
  it('morale moves ±2 in a rival game (winners up, losers down) and not otherwise', () => {
    for (const b of result.box.filter((x) => x.min >= 6)) {
      const won = (b.teamId === 't_atl') === homeWon
      const was = base.players[b.playerId].morale
      expect(normal.players[b.playerId].morale).toBe(was)
      expect(rival.players[b.playerId].morale).toBe(Math.max(0, Math.min(100, was + (won ? 2 : -2))))
    }
  })
})
