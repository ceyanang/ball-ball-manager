import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { simDays, simUntil, userSeries, watchDay } from '../../src/engine/season/advance'
import { boxFromLog } from '../../src/engine/sim/playlog'
import type { League } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 405, userTeamIndex: 3, name: 'W' })
const plays = (l: League) => l.games.some((g) => g.day === l.day && !g.result && !g.playoff && (g.homeId === l.userTeamId || g.awayId === l.userTeamId))
const userGameToday = (l: League) => l.games.find((g) => g.day === l.day && !g.result && (g.homeId === l.userTeamId || g.awayId === l.userTeamId))

function toDay(l: League, want: boolean): League {
  let cur = l
  for (let i = 0; i < 200 && plays(cur) !== want; i++) cur = simDays(cur, 1)
  return cur
}

/** Sim until the day before `done(l)` would flip on the next step. */
function dayBefore(l: League, flips: (after: League) => boolean): League {
  let cur = l
  for (let i = 0; i < 400; i++) {
    const nxt = simDays(cur, 1)
    if (flips(nxt) && userGameToday(cur)) return cur
    cur = nxt
  }
  throw new Error('never flipped')
}

describe('watchDay', () => {
  it('plays the same day as simDays', () => {
    const l = toDay(fresh(), true)
    const g = userGameToday(l)!
    const { league, watch } = watchDay(l)
    expect(league).toEqual(simDays(l, 1))
    expect(watch).not.toBeNull()
    expect(watch!.gameId).toBe(g.id)
    expect(watch!.log.length).toBeGreaterThan(0)
    const played = league.games.find((x) => x.id === g.id)!.result!
    const box = boxFromLog(watch!.log)
    for (const line of played.box) {
      const b = box[line.playerId]
      if (!b) continue
      expect(b.pts).toBe(line.pts)
      expect(b.ast).toBe(line.ast)
    }
  })

  it('returns null on a user off day', () => {
    const l = toDay(fresh(), false)
    const { league, watch } = watchDay(l)
    expect(watch).toBeNull()
    expect(league).toEqual(simDays(l, 1))
  })

  it('captures the game that ends the regular season', () => {
    const base = fresh()
    const lastDay = Math.max(...base.games.filter((g) => !g.playoff).map((g) => g.day))
    const lastGame = base.games.find((g) => !g.playoff && g.day === lastDay)!
    const l = dayBefore({ ...base, userTeamId: lastGame.homeId }, (a) => a.phase === 'playoffs')
    const { league, watch } = watchDay(l)
    expect(league.phase).toBe('playoffs')
    expect(watch).not.toBeNull()
  })

  it('captures a Finals clincher', () => {
    let l = simUntil(fresh(), 'regularEnd')
    // Make the user the team that wins the title: find it on a dry run. Taking over a team changes how it is run,
    // so re-run until the champion is the user's own team.
    for (let i = 0; i < 8; i++) {
      const champ = simUntil(l, 'playoffsEnd').playoffs!.championId!
      if (champ === l.userTeamId) break
      l = { ...l, userTeamId: champ }
    }
    const before = dayBefore(l, (a) => a.phase === 'offseason')
    const { league, watch } = watchDay(before)
    expect(league.phase).toBe('offseason')
    expect(watch).not.toBeNull()
    expect(league).toEqual(simDays(before, 1))
  })

  it('does not mutate its input', () => {
    const l = toDay(fresh(), true)
    const snap = structuredClone(l)
    watchDay(l)
    expect(l).toEqual(snap)
  })
})

describe('seriesEnd', () => {
  const playoffLeague = () => {
    // Find a seed/team combination where the user makes the playoffs.
    for (let i = 0; i < 30; i++) {
      const l = simUntil(createLeague({ seed: 404, userTeamIndex: i, name: 'W' }), 'regularEnd')
      if (userSeries(l)) return l
    }
    throw new Error('no user in playoffs')
  }

  it('stops when the user series is decided', () => {
    const l = playoffLeague()
    const id = userSeries(l)!.id
    const out = simUntil(l, 'seriesEnd')
    expect(out.playoffs!.series.find((s) => s.id === id)!.winnerId).not.toBeNull()
    // Stopped on the deciding day: one step earlier it was still open.
    expect(out.day).toBeGreaterThan(l.day)
  })

  it('does not overshoot: a day earlier the series was open', () => {
    const l = playoffLeague()
    const id = userSeries(l)!.id
    let cur = l
    while (cur.playoffs!.series.find((s) => s.id === id)!.winnerId === null) {
      const prev = cur
      cur = simDays(cur, 1)
      if (cur.playoffs!.series.find((s) => s.id === id)!.winnerId !== null) {
        expect(prev.playoffs!.series.find((s) => s.id === id)!.winnerId).toBeNull()
        expect(simUntil(l, 'seriesEnd')).toEqual(cur)
      }
    }
  })

  it('returns the league unchanged with no undecided user series', () => {
    const l = fresh()
    expect(userSeries(l)).toBeNull()
    expect(simUntil(l, 'seriesEnd')).toEqual(l)
  })
})
