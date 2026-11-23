import { describe, expect, it } from 'vitest'
import { advanceOffseason, startNewSeason } from '../../src/engine/gm/offseason'
import { fillRoster } from '../../src/engine/gm/roster'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simDays, simUntil } from '../../src/engine/season/advance'
import { HOF_SCORE, careerScore, computeAwards, induct, preLeagueCredit } from '../../src/engine/stories/awards'
import { isRookie, isSophomore } from '../../src/engine/stories/highlights'
import type { InboxItem, League, Player } from '../../src/engine/types'

const done = simUntil(createLeague({ seed: 777, userTeamIndex: 5, name: 'Fixes' }), 'playoffsEnd')

const item = (l: League, over: Partial<InboxItem>): InboxItem => ({
  id: `test-${l.inbox.length}`, season: 1, day: 10, phase: 'regular', kind: 'injury', key: `test:${l.inbox.length}`,
  title: 't', body: 'b', read: false, dismissed: false, ...over,
})

describe('Hall of Fame', () => {
  /** A veteran who arrived with the original rosters at `age0` and `ovr0`, retiring after `seasons` league seasons. */
  const vet = (l: League, age0: number, ovr0: number, seasons = 1): Player => {
    const p = structuredClone(Object.values(l.players).find((x) => !x.draft && x.teamId)!)
    p.id = `vet-${age0}-${ovr0}`
    p.age = age0 + seasons
    p.ratingHistory = Array.from({ length: seasons + 1 }, (_, i) => ({ season: 1 + i, ovr: ovr0 }))
    l.players[p.id] = p
    return p
  }

  it('credits original-roster veterans for the career they had before the league', () => {
    const l = structuredClone(done)
    expect(preLeagueCredit(vet(l, 22, 92))).toBe(0)
    expect(preLeagueCredit(vet(l, 30, 68))).toBe(0)
    const star = vet(l, 32, 92)
    expect(preLeagueCredit(star)).toBeGreaterThan(0)
    expect(preLeagueCredit(star)).toBeGreaterThan(preLeagueCredit(vet(l, 28, 92)))
    expect(preLeagueCredit(star)).toBeGreaterThan(preLeagueCredit(vet(l, 32, 82)))
    // Same arrival, but drafted into the league: his whole career is in the books already.
    const rookie = structuredClone(star)
    rookie.draft = { season: 0, round: 1, pick: 1, teamId: l.userTeamId }
    expect(preLeagueCredit(rookie)).toBe(0)
  })

  it('inducts true greats from the original rosters, not journeymen', () => {
    const l = structuredClone(done)
    const great = vet(l, 33, 93)
    const starter = vet(l, 33, 76)
    expect(careerScore(l, great.id)).toBeGreaterThanOrEqual(HOF_SCORE)
    expect(careerScore(l, starter.id)).toBeLessThan(HOF_SCORE / 2)
    expect(induct(l, [great.id, starter.id])).toEqual([great.id])
  })

  it('keeps the Hall selective across the real league', () => {
    const qualified = Object.values(done.players).filter((p) => careerScore(done, p.id) >= HOF_SCORE)
    expect(qualified.length).toBeLessThanOrEqual(12)
    for (const p of qualified) expect(p.ratingHistory[0].ovr).toBeGreaterThanOrEqual(85)
  })
})

describe('awards', () => {
  it('never gives Sixth Man and Most Improved to the same player', () => {
    const l = structuredClone(done)
    const first = computeAwards(l)
    expect(first.smoy).toBeTruthy()
    // Invent a dreadful "season 0" for the Sixth Man and one other regular, so both look massively improved.
    const other = Object.values(l.statLines).find((s) => s.season === 1 && !s.playoffs && s.playerId !== first.smoy && s.gp >= 40)!.playerId
    for (const [k, s] of Object.entries(l.statLines)) {
      if (s.season !== 1 || s.playoffs || (s.playerId !== first.smoy && s.playerId !== other)) continue
      const zero = { ...s, season: 0, pts: 0, fgm: 0, ast: 0, oreb: 0, dreb: 0, stl: 0, blk: 0, fga: s.fga + 50 }
      l.statLines[k.replace(/^1\|/, '0|')] = zero
    }
    const a = computeAwards(l)
    expect(a.smoy).toBe(first.smoy)
    expect(a.mip).toBeTruthy()
    expect(a.mip).not.toBe(a.smoy)
  })
})

describe('season 2', () => {
  const s2 = (() => {
    const l = structuredClone(done)
    l.inbox.push(
      item(l, { kind: 'injury', title: 'X is healthy' }),
      item(l, { kind: 'award', key: 'allstar:1', title: 'All-Star rosters are set' }),
      item(l, { kind: 'coach', phase: 'offseason', title: 'Coach underperforming' }),
      item(l, { kind: 'contract', phase: 'offseason', title: 'Y is slipping' }),
    )
    const rng = new Rng(l.rng)
    while (l.offseason!.step !== 'ready') advanceOffseason(l, rng)
    fillRoster(l, l.userTeamId, 13)
    startNewSeason(l, rng)
    return l
  })()

  it('starts with a clean inbox: last season’s time-bound items are dismissed', () => {
    expect(s2.season).toBe(2)
    const live = s2.inbox.filter((i) => !i.dismissed)
    expect(live.filter((i) => i.season < 2 && !(i.phase === 'offseason' && (i.kind === 'contract' || i.key.startsWith('hof:') || i.key.startsWith('breakout:'))))).toEqual([])
    expect(live.some((i) => i.title === 'Y is slipping')).toBe(true)
    for (const t of ['X is healthy', 'All-Star rosters are set', 'Coach underperforming'])
      expect(s2.inbox.find((i) => i.title === t)!.dismissed).toBe(true)
  })

  it('counts last season’s undrafted rookies as sophomores', () => {
    const originals = Object.values(s2.players).filter((p) => !p.draft && !p.retired && p.ratingHistory[0].season === 1)
    const sophs = originals.filter((p) => isSophomore(s2, p))
    expect(sophs.length).toBeGreaterThan(0)
    for (const p of sophs) {
      expect(isRookie(s2, p, 1)).toBe(true)
      expect(p.age).toBeLessThanOrEqual(22)
    }
    expect(originals.filter((p) => isRookie(s2, p, 1)).every((p) => isSophomore(s2, p))).toBe(true)
  })

  it('holds a Rising Stars game', { timeout: 120_000 }, () => {
    let l = s2
    for (let i = 0; i < 40 && !l.allStars.some((e) => e.season === 2); i++) l = simDays(l, 7, { stopOnOffer: true })
    const rising = l.allStars.find((e) => e.season === 2 && e.kind === 'rising')
    expect(rising).toBeTruthy()
    const sophIds = [...rising!.teams[1].rotation.starters, ...rising!.teams[1].rotation.bench, ...rising!.teams[1].rotation.inactive]
    for (const id of sophIds) expect(isSophomore(l, l.players[id])).toBe(true)
  })
})
