import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import type { PlayEvent } from '../../src/engine/sim/playlog'
import type { Team } from '../../src/engine/types'
import { recapRows } from '../../src/ui/watch/recap'
import { benchLine, finalState } from '../../src/ui/watch/replay'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const teams = Object.values(league.teams)

describe('recapRows', () => {
  it('lists starters by role, and a bench row whose children are every non-starter, on the floor or not', () => {
    let checked = 0
    for (let s = 1; s <= 60 && checked < 10; s++) {
      const log: PlayEvent[] = []
      const res = simGame(teams[0], teams[1], league.players, league.coaches, Rng.fromSeed(s), log)
      const rs = finalState(log)
      const box = res.box.filter((b) => b.teamId === teams[0].id)
      const starters = box.filter((b) => b.gs).map((b) => b.playerId)
      const bench = box.filter((b) => !b.gs).map((b) => b.playerId)
      const onFloorBench = rs.court!.home.concat(rs.court!.away).filter((id) => bench.includes(id))
      const rows = recapRows(rs, { starters, bench }, teams[0] as Team, league.players, new Set())
      expect(rows.slice(0, starters.length).map((r) => r.playerId)).toEqual(starters)
      const row = rows[rows.length - 1]
      expect(row.playerId).toBeNull()
      expect(row.children!.map((c) => c.playerId)).toEqual(bench)
      expect(row.line.pts).toBe(row.children!.reduce((t, c) => t + c.line.pts, 0))
      expect(row.line).toEqual(benchLine(rs, bench))
      if (onFloorBench.length) {
        expect(row.children!.map((c) => c.playerId)).toContain(onFloorBench[0])
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  it('keeps a sitting starter in the starters rows, not the bench', () => {
    for (let s = 1; s <= 60; s++) {
      const log: PlayEvent[] = []
      const res = simGame(teams[0], teams[1], league.players, league.coaches, Rng.fromSeed(s), log)
      const rs = finalState(log)
      const box = res.box.filter((b) => b.teamId === teams[0].id)
      const starters = box.filter((b) => b.gs).map((b) => b.playerId)
      const sitting = starters.find((id) => !rs.court!.home.includes(id) && !rs.court!.away.includes(id))
      if (!sitting) continue
      const bench = box.filter((b) => !b.gs).map((b) => b.playerId)
      const rows = recapRows(rs, { starters, bench }, teams[0] as Team, league.players, new Set())
      expect(rows.map((r) => r.playerId)).toContain(sitting)
      expect(rows[rows.length - 1].children!.map((c) => c.playerId)).not.toContain(sitting)
      return
    }
    throw new Error('no game ended with a starter sitting')
  })
})
