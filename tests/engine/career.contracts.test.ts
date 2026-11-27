import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { acceptOffer, contractOffers, rollSuddenMove, suddenMoveChance } from '../../src/engine/career/contracts'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { careerAdvanceOffseason } from '../../src/engine/career/offseason'
import { MAX_SALARY, MIN_SALARY, ROSTER_MAX } from '../../src/engine/constants'
import { teamPlayers } from '../../src/engine/gm/cap'
import { Rng } from '../../src/engine/rng'
import { simDays, simUntil } from '../../src/engine/season/advance'
import type { League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[0]
function active(seed = 14): League {
  const l = createCareerLeague({ seed, name: 'C', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
  resolveCareerDraft(l, new Rng(l.rng))
  return l
}
const me = (l: League) => l.players[l.career!.playerId]
/** Plays the season out, answering any mid-season cut by taking the first offer, with his contract ending this season. */
function expiring(seed = 14): League {
  let l = active(seed)
  me(l).contract!.expires = l.season
  for (let i = 0; i < 400 && l.phase !== 'offseason'; i++) {
    l = simUntil(l, 'playoffsEnd', { stopOnOffer: true })
    if (l.career!.offers && l.phase === 'regular') {
      acceptOffer(l, l.career!.offers[0])
      me(l).contract!.expires = l.season
    }
  }
  expect(l.phase).toBe('offseason')
  return l
}

describe('career contracts', () => {
  it('expiry creates a pending choice at the start of the offseason, and sims do not move past it', () => {
    const l = expiring()
    expect(l.phase).toBe('offseason')
    expect(l.career!.offers!.length).toBeGreaterThanOrEqual(1)
    const after = careerAdvanceOffseason(l)
    expect(after.status).toBe('paused')
    expect(after.league.offseason!.step).toBe(l.offseason!.step)
  })

  it('in season, a pending choice freezes the calendar', () => {
    const l = active()
    l.career!.offers = contractOffers(l)
    const day = l.day
    expect(simDays(l, 10).day).toBe(day)
    expect(simUntil(l, 'regularEnd').day).toBe(day)
  })

  it('always has at least one offer, including a minimum deal, even when every team is over the cap', () => {
    const l = active()
    for (const p of Object.values(l.players)) if (p.teamId && p.contract && !p.careerBuild) p.contract.salary = MAX_SALARY
    me(l).teamId = null
    me(l).contract = null
    const offers = contractOffers(l)
    expect(offers.length).toBeGreaterThanOrEqual(1)
    const min = offers.find((o) => o.salary === MIN_SALARY && o.years === 1)
    expect(min).toBeDefined()
    expect(offers.every((o) => o.salary >= MIN_SALARY && o.salary <= MAX_SALARY && o.years >= 1 && o.years <= 5)).toBe(true)
  })

  it('accepting an offer moves him, the league follows him and rosters stay legal', () => {
    const l = expiring()
    const offer = l.career!.offers!.find((o) => o.teamId !== me(l).teamId) ?? l.career!.offers![0]
    const oldTeam = me(l).teamId
    acceptOffer(l, offer)
    expect(me(l).teamId).toBe(offer.teamId)
    expect(l.userTeamId).toBe(offer.teamId)
    expect(me(l).contract!.salary).toBe(offer.salary)
    expect(l.career!.offers).toBeNull()
    const rot = l.teams[offer.teamId].rotation
    expect([...rot.starters, ...rot.bench, ...rot.inactive]).toContain(me(l).id)
    expect(teamPlayers(l, offer.teamId).length).toBeLessThanOrEqual(ROSTER_MAX)
    if (oldTeam) expect([...l.teams[oldTeam].rotation.starters, ...l.teams[oldTeam].rotation.bench, ...l.teams[oldTeam].rotation.inactive]).not.toContain(me(l).id)
  })

  it('a cut player with no real offers still gets the minimum deal and a new season starts', () => {
    const l = expiring()
    for (const p of Object.values(l.players)) if (p.teamId && p.contract && !p.careerBuild) p.contract.salary = MAX_SALARY
    l.career!.offers = contractOffers(l)
    const min = l.career!.offers!.find((o) => o.salary === MIN_SALARY)!
    acceptOffer(l, min)
    const res = careerAdvanceOffseason(l)
    expect(res.status).toBe('newSeason')
    expect(res.league.season).toBe(2)
    expect(res.league.phase).toBe('regular')
    expect(me(res.league).teamId).toBe(min.teamId)
    expect(res.league.userTeamId).toBe(min.teamId)
    for (const team of Object.keys(res.league.teams)) expect(teamPlayers(res.league, team).length).toBeLessThanOrEqual(ROSTER_MAX)
  })

  it('the AI never trades, waives or re-signs the followed player on its own', () => {
    let l = active()
    const team = me(l).teamId
    for (let i = 0; i < 400 && l.phase !== 'offseason'; i++) {
      l = simUntil(l, 'playoffsEnd', { stopOnOffer: true })
      if (l.career!.offers && l.phase === 'regular') break
    }
    // Only the career's own weekly roll (logged) can move him; nothing else does.
    const moves = l.career!.log.filter((e) => /Traded|Cut/.test(e.text))
    if (!moves.length) {
      expect(me(l).teamId).toBe(team)
      expect(me(l).contract).not.toBeNull()
    }
  })

  it('trade and cut chances rise with bad play (and the roll actually fires more)', () => {
    const good = active(), bad = active()
    me(good).careerBuild = { ...me(good).careerBuild!, startProgress: 0.1 }
    for (const p of teamPlayers(bad, me(bad).teamId!)) if (p.id !== me(bad).id) p.ratings = { ...p.ratings, shotIQ: 99, threePointShot: 99, layup: 99, perimeterDefense: 99, passVision: 99, ballHandle: 99, steal: 99, interiorDefense: 99, midRangeShot: 99, closeShot: 99 }
    me(bad).morale = 10
    const a = suddenMoveChance(good), b = suddenMoveChance(bad)
    expect(b.trade + b.cut).toBeGreaterThan(a.trade + a.cut)
    let goodHits = 0, badHits = 0
    for (let i = 0; i < 400; i++) {
      if (rollSuddenMove(structuredClone(good), Rng.fromSeed(i))) goodHits++
      if (rollSuddenMove(structuredClone(bad), Rng.fromSeed(i))) badHits++
    }
    expect(badHits).toBeGreaterThan(goodHits)
  })

  it('a cut leaves him unsigned with a pending choice; a trade moves him and userTeamId together', () => {
    const base = active()
    for (const p of teamPlayers(base, me(base).teamId!)) if (p.id !== me(base).id) p.ratings = { ...p.ratings, shotIQ: 99, threePointShot: 99, layup: 99, perimeterDefense: 99, passVision: 99, ballHandle: 99, steal: 99, interiorDefense: 99, midRangeShot: 99, closeShot: 99 }
    me(base).morale = 5
    let sawCut = false, sawTrade = false
    for (let i = 0; i < 4000 && !(sawCut && sawTrade); i++) {
      const l = structuredClone(base)
      const before = me(l).teamId
      const kind = rollSuddenMove(l, Rng.fromSeed(i))
      if (kind === 'cut') {
        sawCut = true
        expect(me(l).teamId).toBeNull()
        expect(l.career!.offers!.length).toBeGreaterThanOrEqual(1)
      } else if (kind === 'trade') {
        sawTrade = true
        expect(me(l).teamId).not.toBe(before)
        expect(l.userTeamId).toBe(me(l).teamId)
        expect(teamPlayers(l, me(l).teamId!).length).toBeLessThanOrEqual(ROSTER_MAX)
      }
    }
    expect(sawCut && sawTrade).toBe(true)
  })
})
