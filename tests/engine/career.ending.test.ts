import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { acceptOffer } from '../../src/engine/career/contracts'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { ENDINGS, buildSummary, finishCareer, type CareerSummary } from '../../src/engine/career/endings'
import { careerAdvanceOffseason } from '../../src/engine/career/offseason'
import { careerPlayDay } from '../../src/engine/career/play'
import { answerRetirement, retirementPrompt } from '../../src/engine/career/retirement'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import { simUntil } from '../../src/engine/season/advance'
import type { League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[0]
function active(seed = 17): League {
  const l = createCareerLeague({ seed, name: 'R', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
  resolveCareerDraft(l, new Rng(l.rng))
  return l
}
const me = (l: League) => l.players[l.career!.playerId]
const base: CareerSummary = {
  name: 'A B', age: 33, seasons: 10, titles: 0, finalsMvps: 0, mvps: 0, dpoys: 0, allLeague: 0, peakOvr: 70, finalOvr: 66,
  fans: 10, points: 5000, games: 500, teams: 1, rivalMoments: 0, retiredEarly: false, refusals: 0, hof: false,
}

describe('endings', () => {
  it('are matched in order with a fallback that always matches', () => {
    expect(ENDINGS.at(-1)!.when(base)).toBe(true)
    expect(ENDINGS.at(-1)!.when({ ...base, titles: 9 })).toBe(true)
    const pick = (s: CareerSummary) => ENDINGS.find((e) => e.when(s))!.id
    const ids = ENDINGS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(pick(base)).toBe(ids.at(-1))
    expect(pick({ ...base, titles: 3, mvps: 2, allLeague: 6, peakOvr: 97, finalOvr: 90, fans: 80 })).toBe('legend')
    expect(pick({ ...base, retiredEarly: true, peakOvr: 96, finalOvr: 94, fans: 60, titles: 1 })).toBe('walked-away')
    expect(pick({ ...base, allLeague: 4, peakOvr: 95, fans: 5 })).toBe('forgotten-legend')
    expect(pick({ ...base, fans: 70, peakOvr: 72 })).toBe('bench-guy')
    for (const e of ENDINGS) {
      expect(e.title.length).toBeGreaterThan(2)
      expect(e.lines.length).toBeGreaterThanOrEqual(2)
      for (const f of e.lines) expect(f(base)).not.toMatch(/undefined|NaN|\{/)
    }
  })

  it('summaries are deterministic and read from the league', () => {
    const l = active()
    expect(JSON.stringify(buildSummary(l))).toBe(JSON.stringify(buildSummary(l)))
    const s = buildSummary(l)
    expect(s.name).toBe(`${me(l).firstName} ${me(l).lastName}`)
    expect(s.peakOvr).toBeGreaterThanOrEqual(s.finalOvr)
  })
})

describe('retirement', () => {
  it('a young player is never asked; a veteran is suggested, then forced as he declines', () => {
    const l = active()
    expect(retirementPrompt(l)).toBeNull()
    me(l).age = 35
    expect(retirementPrompt(l)!.kind).toBe('suggest')
    answerRetirement(l, 'refuse')
    expect(l.career!.status).toBe('active')
    expect(l.career!.retirement ?? null).toBeNull()
    expect(l.career!.refusals).toBe(1)
    me(l).age = 40
    expect(retirementPrompt(l)!.kind).toBe('forced')
    l.career!.retirement = retirementPrompt(l)
    expect(() => answerRetirement(l, 'refuse')).toThrow()
    answerRetirement(l, 'accept')
    expect(l.career!.status).toBe('retired')
  })

  it('a decline below the threshold forces the prompt after refusing', () => {
    const l = active()
    me(l).age = 37
    for (const k of RATING_KEYS) me(l).ratings[k] = 25
    expect(retirementPrompt(l)!.kind).toBe('forced')
  })

  it('force-retiring is allowed any time, takes him off every roster and picks an ending', () => {
    const l = active()
    const team = me(l).teamId!
    answerRetirement(l, 'force')
    expect(l.career!.status).toBe('retired')
    expect(me(l).retired).toBe(true)
    expect(me(l).teamId).toBeNull()
    expect([...l.teams[team].rotation.starters, ...l.teams[team].rotation.bench, ...l.teams[team].rotation.inactive]).not.toContain(me(l).id)
    expect(l.career!.ending!.lines.length).toBeGreaterThanOrEqual(2)
    expect(finishCareer).toBeTypeOf('function')
  })

  it('a fully simmed career retires, gets an ending and never gets stuck on a prompt', () => {
    let l = active()
    // exercise the day driver a little, then fly through the seasons
    for (let i = 0; i < 5; i++) l = careerPlayDay(l, 'sim').league
    let guard = 0
    while (l.career!.status === 'active' && guard++ < 400) {
      const c = l.career!
      if (c.retirement) { answerRetirement(l, 'accept'); continue }
      if (c.offers) { acceptOffer(l, c.offers[0]); continue }
      if (l.phase === 'offseason') {
        const r = careerAdvanceOffseason(l)
        expect(r.status === 'idle').toBe(false)
        l = r.league
        continue
      }
      l = simUntil(l, 'playoffsEnd', { stopOnOffer: true })
    }
    expect(l.career!.status).toBe('retired')
    expect(l.career!.ending).not.toBeNull()
    expect(l.career!.ending!.lines.length).toBeGreaterThanOrEqual(2)
    expect(l.season).toBeGreaterThan(5)
    expect(l.career!.played).toBe(0)
    expect(l.career!.simmed).toBeGreaterThan(0)
  }, 280_000)
})
