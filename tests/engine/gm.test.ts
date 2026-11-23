import { describe, expect, it } from 'vitest'
import { ROSTER_MAX, ROSTER_MIN, SALARY_CAP } from '../../src/engine/constants'
import { capProblem, committed, isFreeAgent, ovr, payroll, tradesOpen } from '../../src/engine/gm/cap'
import { autoPick, currentSlot, LOTTERY_DRAWS } from '../../src/engine/gm/draft'
import { advanceOffseason, seasonStartProblem } from '../../src/engine/gm/offseason'
import { claimWaiver, currentAsk, fillRoster, offerFreeAgent, processWaivers, releasePlayer } from '../../src/engine/gm/roster'
import { aiVerdict, findOffers, findTargets, proposeTrade, suggestPackage, tradeProblem, type Asset } from '../../src/engine/gm/trade'
import { askYears, playerValue } from '../../src/engine/gm/value'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simDays, simUntil } from '../../src/engine/season/advance'
import { validateRotation } from '../../src/engine/sim/rotation'
import type { League } from '../../src/engine/types'

const fresh = () => createLeague({ seed: 21, userTeamIndex: 3, name: 'GM' })
const user = (l: League) => l.userTeamId
const other = (l: League) => Object.keys(l.teams).find((id) => id !== l.userTeamId)!
const best = (l: League, teamId: string) => committed(l, teamId).sort((a, b) => ovr(b) - ovr(a))
const P = (id: string): Asset => ({ kind: 'player', id })

describe('cap and reserve rule', () => {
  it('every created team is legal', () => {
    const l = fresh()
    for (const id of Object.keys(l.teams)) {
      expect(payroll(l, id)).toBeLessThanOrEqual(SALARY_CAP)
      expect(capProblem(l, id, {})).toBeNull()
    }
  })
  it('explains the roster-fill reserve when a move leaves too little room', () => {
    const l = fresh()
    const id = user(l)
    const room = SALARY_CAP - payroll(l, id)
    const n = committed(l, id).length
    const msg = capProblem(l, id, { addSalary: room - 500, removeCount: n - 5 })
    expect(msg).toMatch(/needed to fill out 10/)
    expect(capProblem(l, id, { addCount: ROSTER_MAX })).toMatch(/over 15/)
  })
})

describe('trades', () => {
  it('rejects a lopsided ask, the same way every time', () => {
    const l = fresh()
    const them = other(l)
    const star = best(l, them)[0]
    const scrub = best(l, user(l)).at(-1)!
    const t = { a: user(l), b: them, aGives: [P(scrub.id)], bGives: [P(star.id)] }
    for (let i = 0; i < 3; i++) expect(aiVerdict(l, them, t.aGives, t.bGives).ok).toBe(false)
  })
  it('suggests a package the AI accepts, and proposing it executes the trade with valid rotations', () => {
    const l = fresh()
    const them = other(l)
    const target = best(l, them)[4]
    const give = suggestPackage(l, user(l), them, [P(target.id)])
    expect(give).not.toBeNull()
    const v = proposeTrade(l, { a: user(l), b: them, aGives: give!, bGives: [P(target.id)] })
    expect(v.ok).toBe(true)
    expect(l.players[target.id].teamId).toBe(user(l))
    for (const id of [user(l), them]) {
      const ids = committed(l, id).map((p) => p.id)
      expect(validateRotation(l.teams[id].rotation, ids)).toEqual([])
    }
    expect(l.transactions.at(-1)!.type).toBe('trade')
  })
  it('trade finder returns legal offers the CPU accepts, best first', () => {
    const l = fresh()
    const mine = best(l, user(l))[1]
    const t0 = performance.now()
    const offers = findOffers(l, user(l), [P(mine.id)])
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(offers.length).toBeGreaterThan(0)
    for (let i = 1; i < offers.length; i++) expect(offers[i - 1].value).toBeGreaterThanOrEqual(offers[i].value)
    const picksOnly = findOffers(l, user(l), [P(mine.id)], { want: (a) => a.kind === 'pick' })
    for (const o of picksOnly) expect(o.gives.every((a) => a.kind === 'pick')).toBe(true)
    const top = offers[0]
    const v = proposeTrade(l, { a: user(l), b: top.teamId, aGives: [P(mine.id)], bGives: top.gives })
    expect(v.ok).toBe(true)
    expect(l.players[mine.id].teamId).toBe(top.teamId)
  })
  it('values young high-potential players more for rebuilders, and closes at the deadline', () => {
    const l = fresh()
    const kid = Object.values(l.players).filter((p) => p.age <= 22 && p.pot - ovr(p) >= 10)[0]
    if (kid) expect(playerValue(l, kid, 'rebuild')).toBeGreaterThan(playerValue(l, kid, 'contend'))
    const later = simUntil(l, 'deadline')
    expect(later.day).toBe(later.tradeDeadlineDay)
    expect(tradesOpen(later)).toBe(true)
    const after = simDays(later, 1)
    expect(tradesOpen(after)).toBe(false)
  })
})

describe('waivers and free agents', () => {
  it('an unclaimed release leaves dead money; a claim moves the whole contract', () => {
    const l = fresh()
    const worst = best(l, user(l)).at(-1)!
    const before = payroll(l, user(l))
    releasePlayer(l, worst.id)
    expect(l.waivers).toHaveLength(1)
    claimWaiver(l, other(l), worst.id)
    expect(l.players[worst.id].teamId).toBe(other(l))
    expect(payroll(l, user(l))).toBe(before - worst.contract!.salary)

    const next = best(l, user(l)).at(-1)!
    releasePlayer(l, next.id)
    processWaivers(l)
    const claimed = l.players[next.id].teamId !== null
    if (!claimed) {
      expect(l.deadMoney.some((d) => d.playerId === next.id)).toBe(true)
      expect(isFreeAgent(l, l.players[next.id])).toBe(true)
    }
  })
  it('in season, free agents sign on the spot at their ask and refuse lowballs', () => {
    const l = fresh()
    releasePlayer(l, best(l, user(l)).at(-1)!.id)
    processWaivers(l)
    const fa = Object.values(l.players).filter((p) => isFreeAgent(l, p)).sort((a, b) => ovr(b) - ovr(a))[0]
    const ask = currentAsk(l, fa)
    if (ask >= 2000) expect(offerFreeAgent(l, user(l), fa.id, Math.floor(ask / 200) * 100, 2)).toBe('rejected')
    expect(offerFreeAgent(l, user(l), fa.id, ask, 2)).toBe('signed')
    expect(l.players[fa.id].teamId).toBe(user(l))
  })
  it('once free agency is over (step "ready"), a short roster can still sign free agents on the spot', () => {
    const l = fresh()
    l.phase = 'offseason'
    l.offseason = { step: 'ready', faDay: 15, report: { retired: [], changes: [], coaching: [] }, resignTries: {} }
    const fa = Object.values(l.players).find((p) => !p.teamId && !p.retired && !l.draftRights[p.id] && !(l.draft?.prospects.includes(p.id) ?? false))
      ?? (() => { const p = l.players[committed(l, user(l))[0]?.id ?? best(l, user(l))[0].id]; p.teamId = null; p.contract = null; return p })()
    const before = committed(l, user(l)).length
    const ask = Math.max(currentAsk(l, fa), 1_000)
    expect(offerFreeAgent(l, user(l), fa.id, ask, askYears(fa))).toBe('signed')
    expect(l.players[fa.id].teamId).toBe(user(l))
    expect(committed(l, user(l)).length).toBe(before + 1)
  })
  it('free agency has not opened before re-signing ends', () => {
    const l = fresh()
    l.phase = 'offseason'
    l.offseason = { step: 'resign', faDay: 0, report: { retired: [], changes: [], coaching: [] }, resignTries: {} }
    const fa = best(l, user(l))[0]
    fa.teamId = null
    fa.contract = null
    expect(() => offerFreeAgent(l, user(l), fa.id, 1_000, 1)).toThrow(/Free agency opens/)
  })
})

describe('full offseason cycle', () => {
  it('plays two seasons end to end with legal rosters, a draft, free agency and a new schedule', { timeout: 60_000 }, () => {
    let l = simUntil(fresh(), 'playoffsEnd')
    expect(l.phase).toBe('offseason')
    expect(l.offseason!.step).toBe('awards')
    expect(l.draft!.prospects).toHaveLength(70)
    expect(l.draft!.lottery).toHaveLength(14)
    expect(new Set(l.draft!.lottery.map((e) => e.pick)).size).toBe(14)
    // Only the top LOTTERY_DRAWS can jump; everyone else slides at most that many spots.
    for (const e of l.draft!.lottery) expect(e.pick).toBeLessThanOrEqual(Math.max(LOTTERY_DRAWS, e.preSlot + LOTTERY_DRAWS))
    const rng = new Rng(l.rng)
    advanceOffseason(l, rng) // → recap
    expect(l.offseason!.step).toBe('recap')
    advanceOffseason(l, rng) // → lottery
    advanceOffseason(l, rng) // → draft, CPU picks up to the user
    expect(l.offseason!.step).toBe('draft')
    expect(currentSlot(l)?.teamId ?? l.userTeamId).toBe(l.userTeamId)
    if (currentSlot(l)) autoPick(l)
    advanceOffseason(l, rng) // finish draft → resign
    expect(l.draft!.order.every((s) => s.playerId)).toBe(true)
    expect(l.offseason!.step).toBe('resign')
    advanceOffseason(l, rng) // → free agency
    expect(l.offseason!.step).toBe('freeAgency')
    advanceOffseason(l, rng) // plays out free agency → ready
    expect(l.offseason!.step).toBe('ready')
    fillRoster(l, l.userTeamId, 13)
    expect(seasonStartProblem(l)).toBeNull()
    advanceOffseason(l, rng) // → new season
    l.rng = rng.state

    expect(l.season).toBe(2)
    expect(l.phase).toBe('regular')
    expect(l.games.filter((g) => g.season === 2)).toHaveLength(600)
    expect(l.picks.some((p) => p.season === 3)).toBe(true)
    expect(l.picks.some((p) => p.season === 1)).toBe(false)
    for (const id of Object.keys(l.teams)) {
      const roster = committed(l, id)
      expect(roster.length).toBeGreaterThanOrEqual(ROSTER_MIN)
      expect(roster.length).toBeLessThanOrEqual(ROSTER_MAX)
      expect(payroll(l, id)).toBeLessThanOrEqual(SALARY_CAP)
      expect(validateRotation(l.teams[id].rotation, roster.map((p) => p.id))).toEqual([])
    }
    const rookies = Object.values(l.players).filter((p) => p.draft?.season === 1 && p.teamId)
    expect(rookies.length).toBeGreaterThan(20)
    for (const p of Object.values(l.players)) if (p.retired) expect(p.teamId).toBeNull()

    l = simUntil(l, 'playoffsEnd')
    expect(l.phase).toBe('offseason')
    expect(l.season).toBe(2)
    expect(l.playoffs!.championId).toBeTruthy()
  })
})

describe('find a player', () => {
  const key = (a: Asset) => `${a.kind}:${a.id}`
  const mineOf = (l: League) => best(l, user(l)).slice(1, 6).map((p) => P(p.id))
  const crit = { pos: 'SG', minOvr: 50 } as const

  it('returns only matching players on other teams, best OVR first', () => {
    const l = fresh()
    const t0 = performance.now()
    const deals = findTargets(l, user(l), crit, mineOf(l))
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(deals.length).toBeGreaterThan(0)
    deals.forEach((d, i) => {
      const p = l.players[d.target.id]
      expect(p.pos).toBe('SG')
      expect(ovr(p)).toBeGreaterThanOrEqual(50)
      expect(p.teamId).not.toBe(user(l))
      expect(p.teamId).toBe(d.teamId)
      if (i) expect(ovr(l.players[deals[i - 1].target.id])).toBeGreaterThanOrEqual(ovr(p))
    })
  })
  it('only spends ticked assets, and every deal is legal and AI-acceptable', () => {
    const l = fresh()
    const mine = mineOf(l)
    const ok = new Set(mine.map(key))
    const deals = findTargets(l, user(l), crit, mine)
    for (const d of deals) {
      expect(d.gives.every((a) => ok.has(key(a)))).toBe(true)
      expect(tradeProblem(l, { a: user(l), b: d.teamId, aGives: d.gives, bGives: [d.target] })).toBeNull()
      expect(aiVerdict(l, d.teamId, d.gives, [d.target]).ok).toBe(true)
    }
    const v = proposeTrade(l, { a: user(l), b: deals[0].teamId, aGives: deals[0].gives, bGives: [deals[0].target] })
    expect(v.ok).toBe(true)
    expect(l.players[deals[0].target.id].teamId).toBe(user(l))
  })
  it('respects maxAge and maxSalary', () => {
    const l = fresh()
    const mine = mineOf(l)
    for (const d of findTargets(l, user(l), { ...crit, maxAge: 24 }, mine)) expect(l.players[d.target.id].age).toBeLessThanOrEqual(24)
    const cap = 3000
    for (const d of findTargets(l, user(l), { ...crit, maxSalary: cap }, mine)) expect(l.players[d.target.id].contract!.salary).toBeLessThanOrEqual(cap)
  })
  it('returns nothing for empty picks, impossible filters, closed trades, and ignores stale assets', () => {
    const l = fresh()
    expect(findTargets(l, user(l), crit, [])).toEqual([])
    expect(findTargets(l, user(l), { pos: 'C', minOvr: 99 }, mineOf(l))).toEqual([])
    const stale = [P(best(l, other(l))[0].id)]
    expect(findTargets(l, user(l), crit, stale)).toEqual([])
    const later = simDays(simUntil(l, 'deadline'), 1)
    expect(findTargets(later, user(later), crit, mineOf(later))).toEqual([])
  })
})
