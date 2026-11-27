import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { applyRivalBumps, recordRivalShowing } from '../../src/engine/rivals/showing'
import { startOffseason } from '../../src/engine/gm/offseason'
import { simUntil } from '../../src/engine/season/advance'
import type { BoxLine, Game, League, StatLine } from '../../src/engine/types'

const mk = (): League => { const l = structuredClone(createLeague({ seed: 3, userTeamIndex: 0, name: 'P' })); l.season = 5; l.history = [{ season: 4 } as never]; return l }
const box = (playerId: string, teamId: string, pts: number): BoxLine => ({ playerId, teamId, gs: true, min: 30, pts, oreb: 1, dreb: 4, ast: 4, stl: 1, blk: 0, tov: 1, pf: 2, fgm: Math.round(pts / 2.2), fga: Math.round(pts / 2.2) + 2, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 8 })
const game = (home: string, away: string, lines: BoxLine[]) => ({ id: 'g', season: 5, day: 3, homeId: home, awayId: away, playoff: null, result: { homeScore: 110, awayScore: 100, quarters: { home: [], away: [] }, ot: 0, box: lines, potg: '' } }) as Game
const roster = (l: League, team: string) => Object.values(l.players).filter((p) => p.teamId === team)

describe('rival showing tally', () => {
  it('counts a new player\'s good rival game, but not vets, neutral players or non-rival games', () => {
    const l = mk()
    const [newGuy, vet, mid] = roster(l, 't_dal')
    for (const s of [2, 3, 4]) l.statLines[`${vet.id}_${s}`] = { playerId: vet.id, teamId: 't_dal', season: s, playoffs: false, gp: 40 } as StatLine
    l.statLines[`${mid.id}_4`] = { playerId: mid.id, teamId: 't_dal', season: 4, playoffs: false, gp: 40 } as StatLine
    const lines = [newGuy, vet, mid].map((p) => box(p.id, 't_dal', 45))
    recordRivalShowing(l, game('t_dal', 't_hou', lines))
    expect(l.rivalry.showing[newGuy.id]).toBe(1)
    expect(l.rivalry.showing[vet.id]).toBeUndefined()
    expect(l.rivalry.showing[mid.id]).toBeUndefined()
    recordRivalShowing(l, game('t_dal', 't_sac', lines)) // not rivals
    expect(l.rivalry.showing[newGuy.id]).toBe(1)
  })
  it('a bad night earns nothing', () => {
    const l = mk()
    const [newGuy] = roster(l, 't_dal')
    recordRivalShowing(l, game('t_dal', 't_hou', [box(newGuy.id, 't_dal', 2)]))
    expect(l.rivalry.showing[newGuy.id]).toBeUndefined()
  })
})

describe('offseason POT bump', () => {
  const shared = mk()
  const trial = (showing: number, seed: number) => {
    const l = shared
    const p = roster(l, 't_dal')[0]
    p.pot = 90
    l.rivalry.showing[p.id] = showing
    applyRivalBumps(l, Rng.fromSeed(seed))
    return { l, p }
  }
  it('bumps about 8% per showing (24% at 3), never past 99, and clears the tally', () => {
    let hits = 0
    for (let s = 1; s <= 400; s++) {
      const { l, p } = trial(3, s)
      if (p.pot > 90) hits++
      expect(p.pot).toBeLessThanOrEqual(99)
      expect(l.rivalry.showing).toEqual({})
    }
    expect(hits / 400).toBeGreaterThan(0.15)
    expect(hits / 400).toBeLessThan(0.35)
  })
  it('one showing is not enough, and 99 stays 99', () => {
    for (let s = 1; s <= 100; s++) expect(trial(1, s).p.pot).toBe(90)
    const l = mk(); const p = roster(l, 't_dal')[0]; p.pot = 99; l.rivalry.showing[p.id] = 5
    applyRivalBumps(l, Rng.fromSeed(1))
    expect(p.pot).toBe(99)
  })
  it('startOffseason runs it and clears the tally', () => {
    const done = simUntil(simUntil(createLeague({ seed: 404, userTeamIndex: 3, name: 'O' }), 'regularEnd'), 'playoffsEnd')
    const l = structuredClone(done)
    l.rivalry.showing = { [roster(l, 't_dal')[0].id]: 3 }
    startOffseason(l, Rng.fromSeed(5))
    expect(l.rivalry.showing).toEqual({})
  })
})
