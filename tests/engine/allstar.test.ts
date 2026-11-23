import { describe, expect, it } from 'vitest'
import { SIDE_SIZE, allStarDayFor, eventPlayerIds, pendingAllStar, playAllStarEvent, selectAllStars } from '../../src/engine/allstar/allstar'
import { createLeague } from '../../src/engine/league/create'
import { simDays, simUntil } from '../../src/engine/season/advance'
import type { League } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 33, userTeamIndex: 2, name: 'ASG' })
/** Sims week by week (pausing for trade offers) until the selections land. */
const toBreak = (l0: League): League => {
  let l = l0
  for (let i = 0; i < 40 && !l.allStars.length; i++) l = simDays(l, 7, { stopOnOffer: true })
  return l
}

describe('All-Star Weekend', () => {
  it('lands at the midpoint of the regular season', () => {
    const l = fresh()
    const last = Math.max(...l.games.filter((g) => !g.playoff).map((g) => g.day))
    expect(l.allStarDay).toBe(allStarDayFor(l.games, 1))
    expect(Math.abs(l.allStarDay - last / 2)).toBeLessThanOrEqual(1)
  })
  it('pauses the sim on the break with 12 a side, East vs West, and plays without touching stats', () => {
    const l = toBreak(fresh())
    expect(l.day).toBe(l.allStarDay + 1)
    const ev = l.allStars.find((e) => e.kind === 'allstar')!
    expect(ev.teams.map((t) => t.conf)).toEqual(['East', 'West'])
    for (const t of ev.teams) {
      expect(t.rotation.starters).toHaveLength(5)
      expect(t.rotation.starters.length + t.rotation.bench.length + t.rotation.inactive.length).toBe(SIDE_SIZE)
      for (const id of [...t.rotation.starters, ...t.rotation.bench]) expect(l.teams[l.players[id].teamId!].conf).toBe(t.conf)
    }
    expect(new Set(eventPlayerIds(ev)).size).toBe(SIDE_SIZE * 2)
    expect(l.coaches[ev.teams[0].coachId]).toBeTruthy()
    const linesBefore = Object.keys(l.statLines).length
    const gamesBefore = l.games.length
    const moraleOf = ev.teams[0].rotation.starters[0]
    const m0 = l.players[moraleOf].morale
    const copy = structuredClone(l)
    const e2 = copy.allStars.find((e) => e.kind === 'allstar')!
    playAllStarEvent(copy, e2)
    expect(e2.result).toBeTruthy()
    expect(e2.mvp).toBeTruthy()
    expect(e2.result!.homeScore).not.toBe(e2.result!.awayScore)
    expect(Object.keys(copy.statLines).length).toBe(linesBefore)
    expect(copy.games.length).toBe(gamesBefore)
    expect(copy.players[moraleOf].morale).toBeGreaterThanOrEqual(m0)
  })
  it('plays itself when the user just keeps simming, and never shifts the games that follow', () => {
    const a = simUntil(fresh(), 'regularEnd')
    expect(pendingAllStar(a)).toHaveLength(0)
    expect(a.allStars.every((e) => e.result)).toBe(true)
    expect(a.allStars.length).toBeGreaterThanOrEqual(1)
  })
  it('does not select twice in one season', () => {
    const l = toBreak(fresh())
    const n = l.allStars.length
    expect(selectAllStars(l)).toBe(false)
    expect(l.allStars.length).toBe(n)
  })
})
