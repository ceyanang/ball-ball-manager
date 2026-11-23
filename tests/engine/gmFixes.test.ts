import { describe, expect, it } from 'vitest'
import { MAX_SALARY, TEAM_MINUTES } from '../../src/engine/constants'
import { committed, ovr, payroll, refreshRotation, syncRotation } from '../../src/engine/gm/cap'
import { makePick, setupDraft } from '../../src/engine/gm/draft'
import { aiResign, currentAsk, freeAgencyDay, offerFreeAgent, releasePlayer } from '../../src/engine/gm/roster'
import { aiTrades, executeTrade, tradeProblem } from '../../src/engine/gm/trade'
import { askYears, playerValue } from '../../src/engine/gm/value'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { gameLineup, minutesTargets } from '../../src/engine/sim/rotation'
import type { League, Player } from '../../src/engine/types'

const fresh = (seed = 21) => createLeague({ seed, userTeamIndex: 3, name: 'Fixes' })
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const freeAgents = (l: League) => Object.values(l.players).filter((p) => !p.teamId && !p.retired).sort((a, b) => ovr(b) - ovr(a))

describe('draft picks traded after the order is set', () => {
  it('the new owner uses the pick, and a used pick cannot be traded', () => {
    const l = fresh()
    setupDraft(l, Rng.fromSeed(5))
    l.phase = 'offseason'
    l.offseason = { step: 'draft', faDay: 0, report: { retired: [], changes: [], coaching: [] }, resignTries: {} }
    const slot = l.draft!.order[0]
    const from = slot.teamId
    const to = Object.keys(l.teams).find((id) => id !== from && id !== l.userTeamId)!
    executeTrade(l, { a: from, b: to, aGives: [{ kind: 'pick', id: slot.pickId }], bGives: [] })
    expect(l.draft!.order[0].teamId).toBe(to)
    makePick(l, l.draft!.prospects[0])
    expect(l.players[l.draft!.order[0].playerId!].draft!.teamId).toBe(to)
    const problem = tradeProblem(l, { a: to, b: from, aGives: [{ kind: 'pick', id: slot.pickId }], bGives: [] })
    expect(problem).toMatch(/can't be traded/)
  })
})

describe('free-agent offers', () => {
  const setup = () => {
    const l = fresh()
    releasePlayer(l, committed(l, l.userTeamId).sort((a, b) => ovr(a) - ovr(b))[0].id)
    l.waivers = []
    return l
  }
  it('rejects salaries over the max and fractional salaries', () => {
    const l = setup()
    const fa = freeAgents(l)[0]
    expect(() => offerFreeAgent(l, l.userTeamId, fa.id, MAX_SALARY + 1000, askYears(fa))).toThrow(/max/i)
    expect(() => offerFreeAgent(l, l.userTeamId, fa.id, 1500.5, askYears(fa))).toThrow(/whole/i)
  })
  it('a contract far from his preferred length costs more', () => {
    const l = setup()
    const fa = freeAgents(l)[0]
    const ask = currentAsk(l, fa)
    const far = askYears(fa) >= 3 ? 1 : 5
    expect(offerFreeAgent(l, l.userTeamId, fa.id, ask, far)).toBe('rejected')
    expect(offerFreeAgent(l, l.userTeamId, fa.id, ask, askYears(fa))).toBe('signed')
  })
})

describe('short rosters', () => {
  it('simGame throws a clear error when a team cannot field five players', () => {
    const l = fresh()
    const [a, b] = Object.values(l.teams)
    const short = structuredClone(a)
    const ids = [...short.rotation.starters, ...short.rotation.bench].slice(0, 4)
    short.rotation = { starters: ids, bench: [], inactive: [] }
    expect(() => simGame(short, b, l.players, l.coaches, Rng.fromSeed(1))).toThrow(/fewer than 5|at least 5/)
  })
  it('in season, a team cannot release or trade itself below five players', () => {
    const l = fresh()
    const me = l.userTeamId
    while (committed(l, me).length > 5) releasePlayer(l, committed(l, me)[0].id)
    expect(() => releasePlayer(l, committed(l, me)[0].id)).toThrow(/five|5/)
    const other = Object.keys(l.teams).find((id) => id !== me)!
    expect(tradeProblem(l, { a: me, b: other, aGives: [{ kind: 'player', id: committed(l, me)[0].id }], bGives: [] })).toMatch(/five|5/)
  })
})

describe('minutes targets', () => {
  it('always total 240 when an injured planned starter is replaced by a zero-minute bench player', () => {
    const l = fresh()
    const t = l.teams[l.userTeamId]
    const plan: Record<string, number> = {}
    t.rotation.starters.forEach((id) => (plan[id] = 48))
    t.rotation.bench.forEach((id) => (plan[id] = 0))
    const injured = l.players[t.rotation.starters[0]]
    injured.injury = { type: 'Sprained ankle', gamesRemaining: 5, severity: 'short' } as Player['injury']
    const lu = gameLineup(t, l.players)
    const m = minutesTargets(lu, l.players, 0, plan)
    expect(sum(Object.values(m))).toBeCloseTo(TEAM_MINUTES, 6)
    expect(m[lu.starters[0]]).toBeGreaterThan(20)
  })
})

describe('user rotation and newcomers', () => {
  it('a new league starts the user on the auto coach', () => {
    expect(fresh().teams[fresh().userTeamId].rotation.auto).toBe(true)
  })
  it('a manual rotation slots a newcomer by OVR on the bench, and a minutes plan gives him a real share', () => {
    const l = fresh()
    const t = l.teams[l.userTeamId]
    t.rotation = { ...t.rotation, auto: undefined }
    delete t.rotation.auto
    const roster = Object.values(l.players).filter((p) => p.teamId === t.id)
    const plan: Record<string, number> = {}
    t.rotation.starters.forEach((id) => (plan[id] = 34))
    t.rotation.bench.forEach((id, i) => (plan[id] = [20, 18, 12, 10, 0, 0, 0][i] ?? 0))
    t.rotation.minutes = plan
    const starters = [...t.rotation.starters]
    const star = freeAgents(l)[0]
    for (const k of Object.keys(star.ratings) as (keyof Player['ratings'])[]) star.ratings[k] = 95
    star.teamId = t.id
    const next = syncRotation(t.rotation, [...roster, star])
    expect(next.starters).toEqual(starters)
    expect(next.bench[0]).toBe(star.id)
    expect(next.minutes).toBeDefined()
    expect(next.minutes![star.id]).toBeGreaterThanOrEqual(15)
    const active = [...next.starters, ...next.bench]
    expect(sum(active.map((id) => next.minutes![id] ?? 0))).toBe(TEAM_MINUTES)
    for (const id of active) expect(Number.isInteger(next.minutes![id])).toBe(true)
  })
  it('a mediocre newcomer lands mid-bench, not at the end', () => {
    const l = fresh()
    const t = l.teams[l.userTeamId]
    delete t.rotation.auto
    const roster = Object.values(l.players).filter((p) => p.teamId === t.id)
    const benchOvr = t.rotation.bench.map((id) => ovr(l.players[id]))
    const fa = freeAgents(l).find((p) => ovr(p) > Math.min(...benchOvr) && ovr(p) < Math.max(...benchOvr))
    if (!fa) return
    fa.teamId = t.id
    const next = syncRotation(t.rotation, [...roster, fa])
    const idx = next.bench.indexOf(fa.id)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(ovr(l.players[next.bench[idx + 1] ?? fa.id])).toBeLessThanOrEqual(ovr(fa))
  })
})

describe('league creation', () => {
  it('rating history starts at the shifted ratings (no fake day-1 changes)', () => {
    const l = fresh()
    for (const p of Object.values(l.players)) expect(p.ratingHistory.at(-1)!.ovr).toBe(ovr(p))
  })
})

describe('player value with age', () => {
  it('contenders value an elite 33-year-old much more gently than rebuilders do', () => {
    const l = fresh()
    const p = structuredClone(Object.values(l.players).sort((a, b) => ovr(b) - ovr(a))[0])
    for (const k of Object.keys(p.ratings) as (keyof Player['ratings'])[]) p.ratings[k] = Math.max(p.ratings[k], 93)
    p.age = 33
    const young = { ...p, age: 29 }
    expect(playerValue(l, p, 'contend') / playerValue(l, young, 'contend')).toBeGreaterThan(0.75)
    expect(playerValue(l, p, 'rebuild') / playerValue(l, young, 'rebuild')).toBeLessThan(0.7)
  })
})

describe('CPU re-signing after the draft', () => {
  it('a CPU team with a full roster of rookies still keeps its wanted star', () => {
    const l = fresh()
    l.phase = 'offseason'
    l.offseason = { step: 'resign', faDay: 0, report: { retired: [], changes: [], coaching: [] }, resignTries: {} }
    const team = Object.keys(l.teams).find((id) => id !== l.userTeamId)!
    const roster = Object.values(l.players).filter((p) => p.teamId === team).sort((a, b) => ovr(b) - ovr(a))
    const star = roster[0]
    star.age = 27
    star.morale = 70
    star.contract!.expires = l.season
    // Everyone else signed through next season, plus cheap rookies up to 15 committed.
    for (const p of roster.slice(1)) p.contract!.expires = l.season + 2
    for (const fa of freeAgents(l)) {
      if (committed(l, team).length >= 15) break
      fa.teamId = team
      fa.contract = { salary: 1000, expires: l.season + 2 }
    }
    const pay = committed(l, team).reduce((s, p) => s + p.contract!.salary, 0)
    if (pay + 45_000 > 150_000) for (const p of committed(l, team)) p.contract!.salary = 1000
    // Run many seeds: the 85% coin aside, a roster crunch must not be what stops it.
    let kept = 0
    for (let s = 0; s < 10; s++) {
      const c = structuredClone(l)
      aiResign(c, Rng.fromSeed(s))
      if (c.players[star.id].contract!.expires > l.season) kept++
      expect(committed(c, team).length).toBeLessThanOrEqual(15)
    }
    expect(kept).toBeGreaterThanOrEqual(6)
  })
})

describe('refreshRotation keeps valid user rotations', () => {
  it('works for a manual rotation after a signing', () => {
    const l = fresh()
    delete l.teams[l.userTeamId].rotation.auto
    refreshRotation(l, l.userTeamId)
    expect(l.teams[l.userTeamId].rotation.starters).toHaveLength(5)
  })
})

describe('CPU markets', () => {
  it('CPU teams trade with each other, and every deal leaves legal rosters', () => {
    const l = fresh()
    const made = aiTrades(l, Rng.fromSeed(9), 20)
    expect(made).toBeGreaterThan(0)
    for (const id of Object.keys(l.teams)) {
      expect(committed(l, id).length).toBeLessThanOrEqual(15)
      expect(payroll(l, id)).toBeLessThanOrEqual(150_000)
    }
  })
  it('a star free agent draws offers from more than one CPU team on day one', () => {
    const l = fresh()
    l.phase = 'offseason'
    l.offseason = { step: 'freeAgency', faDay: 1, report: { retired: [], changes: [], coaching: [] }, resignTries: {} }
    const star = freeAgents(l)[0]
    for (const k of Object.keys(star.ratings) as (keyof Player['ratings'])[]) star.ratings[k] = 92
    star.age = 27
    // Give every CPU team cap room so money isn't what stops them.
    for (const p of Object.values(l.players)) if (p.contract) p.contract.salary = 1000
    const seen = new Set<string>()
    const orig = l.faOffers.push.bind(l.faOffers)
    l.faOffers.push = (...os) => {
      for (const o of os) if (o.playerId === star.id) seen.add(o.teamId)
      return orig(...os)
    }
    freeAgencyDay(l, Rng.fromSeed(4))
    expect(seen.size).toBeGreaterThan(1)
    expect(l.players[star.id].teamId).not.toBeNull()
  })
})
