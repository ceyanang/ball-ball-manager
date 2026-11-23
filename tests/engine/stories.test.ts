import { describe, expect, it } from 'vitest'
import { advanceOffseason, startNewSeason } from '../../src/engine/gm/offseason'
import { fillRoster } from '../../src/engine/gm/roster'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simDays, simUntil } from '../../src/engine/season/advance'
import { simGame } from '../../src/engine/sim/game'
import { careerScore, induct, HOF_SCORE } from '../../src/engine/stories/awards'
import { streakOf } from '../../src/engine/stories/highlights'
import { maybeAiOffer, respondToOffer } from '../../src/engine/stories/inbox'
import { careerRecords, gameRecords } from '../../src/engine/stories/records'
import type { League } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 777, userTeamIndex: 5, name: 'Stories' })
const regEnd = simUntil(fresh(), 'regularEnd')
const done = simUntil(regEnd, 'playoffsEnd')

describe('sim clutch tracking', () => {
  it('reports comebacks and game-winners for the winning side only', () => {
    const l = fresh()
    const rng = Rng.fromSeed(5)
    const teams = Object.values(l.teams)
    let clutch = 0, comebacks = 0
    for (let i = 0; i < 300; i++) {
      const r = simGame(teams[i % 30], teams[(i + 7) % 30], l.players, l.coaches, rng)
      expect(r.comeback).toBeGreaterThanOrEqual(0)
      if (r.clutch) {
        clutch++
        const winner = r.homeScore > r.awayScore ? teams[i % 30].id : teams[(i + 7) % 30].id
        expect(r.box.find((b) => b.playerId === r.clutch!.playerId)!.teamId).toBe(winner)
      }
      if ((r.comeback ?? 0) >= 15) comebacks++
    }
    // Late lead changes and big comebacks happen, but not every night.
    expect(clutch).toBeGreaterThan(5)
    expect(clutch).toBeLessThan(150)
    expect(comebacks).toBeGreaterThan(0)
    expect(comebacks).toBeLessThan(80)
  })
})

describe('highlights, social and fans during the season', () => {
  it('builds a believable feed', () => {
    const kinds = new Set(regEnd.news.map((n) => n.kind))
    for (const k of ['bigGame', 'streak', 'overtime']) expect(kinds.has(k as never)).toBe(true)
    expect(regEnd.news.length).toBeGreaterThan(80)
    expect(regEnd.news.length).toBeLessThan(1500)
    for (const n of regEnd.news) if (n.gameId) expect(regEnd.games.some((g) => g.id === n.gameId)).toBe(true)
    expect(regEnd.social.length).toBeGreaterThan(100)
    expect(regEnd.social.length).toBeLessThanOrEqual(400)
    expect(regEnd.social.some((p) => p.author.kind === 'player')).toBe(true)
    expect(regEnd.social.some((p) => p.author.kind === 'persona')).toBe(true)
    for (const p of regEnd.social) expect(p.text).not.toMatch(/\{\w+\}/)
  })
  it('keeps fan sentiment and morale in range', () => {
    for (const v of [...Object.values(regEnd.fans.players), ...Object.values(regEnd.fans.teams)]) {
      expect(v).toBeGreaterThanOrEqual(-100)
      expect(v).toBeLessThanOrEqual(100)
    }
    const morale = Object.values(regEnd.players).filter((p) => p.teamId).map((p) => p.morale)
    expect(Math.min(...morale)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...morale)).toBeLessThanOrEqual(100)
    expect(new Set(morale).size).toBeGreaterThan(10)
  })
  it('tracks streaks from results', () => {
    for (const id of Object.keys(regEnd.teams)) expect(Math.abs(streakOf(regEnd, id))).toBeGreaterThan(0)
  })
  it('does not change game results (stories use their own randomness)', () => {
    const a = simDays(fresh(), 10)
    const b = simDays(fresh(), 10)
    expect(a.games.map((g) => g.result?.homeScore)).toEqual(b.games.map((g) => g.result?.homeScore))
    expect(a.social).toEqual(b.social)
  })
})

describe('records', () => {
  it('holds the best single-game marks with previous holders', () => {
    const rec = regEnd.records.league.game.pts!
    const best = Math.max(...regEnd.games.flatMap((g) => (g.playoff ? [] : g.result?.box.map((b) => b.pts) ?? [])))
    expect(rec.value).toBe(best)
    expect(rec.prev).not.toBeNull()
    expect(rec.prev!.value).toBeLessThan(rec.value)
    const team = regEnd.records.teams[regEnd.userTeamId].game.reb!
    expect(team.teamId).toBe(regEnd.userTeamId)
  })
  it('season records come in at the end of the regular season', () => {
    const s = regEnd.records.league.season.pts!
    expect(s.value).toBeGreaterThan(20)
    expect(s.value).toBeLessThan(45)
  })
  it('re-offering the same game breaks nothing', () => {
    const l = structuredClone(regEnd)
    const g = l.games.find((x) => x.result && !x.playoff)!
    expect(gameRecords(l, g)).toEqual([])
    expect(careerRecords(l, 1).length).toBeGreaterThan(0)
    expect(careerRecords(l, 1)).toEqual([])
  })
})

describe('season end', () => {
  it('hands out every award and writes history', () => {
    const a = done.awards.at(-1)!
    expect(a.season).toBe(1)
    expect(a.championId).toBe(done.playoffs!.championId)
    for (const k of ['mvp', 'dpoy', 'smoy', 'finalsMvp'] as const) expect(a[k]).toBeTruthy()
    expect(a.mip).toBeNull() // no previous season to improve on
    expect(a.coy).toBeTruthy()
    expect(a.allLeague).toHaveLength(3)
    for (const t of a.allLeague) expect(t).toHaveLength(5)
    expect(new Set(a.allLeague.flat()).size).toBe(15)
    expect(a.allDefense).toHaveLength(2)
    expect(a.championRoster.every((id) => done.players[id].teamId === a.championId || done.players[id].retired)).toBe(true)
    expect(a.championRoster).toContain(a.finalsMvp)
    const h = done.history.at(-1)!
    expect(h.championId).toBe(a.championId)
    expect(h.standings).toHaveLength(30)
    expect(h.leaders.length).toBe(6)
    expect(done.news.some((n) => n.kind === 'champion')).toBe(true)
    expect(done.offseason!.step).toBe('awards')
  })
  it('scores careers for the Hall of Fame', () => {
    const l = structuredClone(done)
    const mvp = l.awards[0].mvp!
    expect(careerScore(l, mvp)).toBeGreaterThan(careerScore(l, Object.values(l.players).find((p) => !p.teamId && !p.retired)!.id))
    // Fake a long career: induction is all about the score.
    l.awards.push(...Array.from({ length: 10 }, (_, i) => ({ ...l.awards[0], season: 10 + i })))
    expect(careerScore(l, mvp)).toBeGreaterThanOrEqual(HOF_SCORE)
    expect(induct(l, [mvp])).toEqual([mvp])
    expect(induct(l, [mvp])).toEqual([])
    expect(l.hof).toHaveLength(1)
  })
})

describe('AI trade offers', () => {
  // Team quality varies by seed, so use a franchise whose players other GMs actually want.
  const withOffer = (): League | null => {
    let l = simDays(createLeague({ seed: 777, userTeamIndex: 0, name: 'Offers' }), 6)
    for (let i = 0; i < 10; i++) {
      l = structuredClone(l)
      l.day += 1
      if (maybeAiOffer(l, 1)) return l
    }
    return null
  }
  it('arrive in the inbox and can be accepted or declined', () => {
    const l = withOffer()
    expect(l).not.toBeNull()
    const item = l!.inbox.find((i) => i.offer?.status === 'open')!
    const declined = structuredClone(l!)
    respondToOffer(declined, item.id, false)
    expect(declined.inbox.find((i) => i.id === item.id)!.offer!.status).toBe('declined')
    const before = item.offer!.youGive[0].id
    respondToOffer(l!, item.id, true)
    expect(l!.players[before].teamId).toBe(item.offer!.teamId)
    expect(() => respondToOffer(l!, item.id, true)).toThrow()
  })
  it('pause the app’s multi-day sims', () => {
    const l = simUntil(fresh(), 'deadline', { stopOnOffer: true })
    const stopped = l.day < l.tradeDeadlineDay
    if (stopped) expect(l.inbox.some((i) => i.offer?.status === 'open')).toBe(true)
  })
})

describe('next season', () => {
  it('runs the awards step, then prunes old news and carries history over', { timeout: 60_000 }, () => {
    const l = structuredClone(done)
    const rng = new Rng(l.rng)
    while (l.offseason!.step !== 'ready') advanceOffseason(l, rng)
    fillRoster(l, l.userTeamId, 13)
    startNewSeason(l, rng)
    expect(l.season).toBe(2)
    expect(l.history).toHaveLength(1)
    expect(l.news.every((n) => n.season >= 1)).toBe(true)
    const s2 = simUntil(l, 'playoffsEnd')
    expect(s2.awards).toHaveLength(2)
    expect(s2.history).toHaveLength(2)
    expect(s2.news.every((n) => n.season >= 1)).toBe(true)
  })
})
