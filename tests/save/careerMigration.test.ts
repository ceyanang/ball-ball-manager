import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { CURRENT_VERSION, migrateLeague } from '../../src/save/migrate'
import { RATING_KEYS, computeOvr } from '../../src/engine/player/ratings'
import { BUILD_BUDGET, BUILD_TEMPLATES, buildCost } from '../../src/engine/career/build'
import { ovrOf } from '../../src/engine/career/careerOvr'
import type { Ratings } from '../../src/engine/types'

const mk = () => JSON.parse(JSON.stringify(createLeague({ seed: 13, userTeamIndex: 2, name: 'T' })))

describe('v13 → v15 career migration', () => {
  it('adds career: null and changes nothing else', () => {
    const raw = mk()
    raw.version = 13
    delete raw.career
    const before = JSON.parse(JSON.stringify(raw))
    const m = migrateLeague(raw)
    expect(CURRENT_VERSION).toBe(15)
    expect(m.version).toBe(15)
    expect(m.career).toBeNull()
    const { version: _v, career: _c, ...rest } = m as unknown as Record<string, unknown>
    const { version: _bv, ...bRest } = before
    void _v; void _c; void _bv
    expect(rest).toEqual(bRest)
  })
  it('keeps an existing career block', () => {
    const raw = mk()
    raw.career = { playerId: 'x', status: 'active' }
    expect(migrateLeague(raw).career).toEqual({ playerId: 'x', status: 'active' })
  })
  it('new leagues have career null', () => {
    expect(createLeague({ seed: 1, userTeamIndex: 0, name: 'N' }).career).toBeNull()
  })
})

describe('v14 → v15 intangibles migration', () => {
  it('sets the followed player intangibles and max to 99', () => {
    const raw = mk()
    const id = Object.keys(raw.players)[0]
    raw.version = 14
    raw.career = { playerId: id, status: 'active' }
    const p = raw.players[id]
    p.ratings.intangibles = 50
    p.careerBuild = { max: { ...p.ratings, intangibles: 60 }, startFraction: 0.67, startProgress: 0, floor: 40, archetype: 'x' }
    const m = migrateLeague(raw)
    expect(m.version).toBe(15)
    expect(m.players[id].ratings.intangibles).toBe(99)
    expect(m.players[id].careerBuild!.max.intangibles).toBe(99)
  })
})

describe('MyCareer build rebudget migration', () => {
  it('stretches an old 960-budget career onto the current budget so his real OVR goes up and the display is honest', () => {
    const raw = mk()
    const id = Object.keys(raw.players)[0]
    raw.version = 14
    raw.career = { playerId: id, status: 'active' }
    const p = raw.players[id]
    // An old-style build: a real template squeezed back onto the old 960 budget, and he is 80% of the way there.
    const tpl = BUILD_TEMPLATES[4]
    p.pos = tpl.pos
    const max = {} as Ratings
    for (const k of RATING_KEYS) max[k] = k === 'intangibles' ? 66 : Math.round(40 + (tpl.max[k] - 40) * (960 / BUILD_BUDGET))
    const ratings = {} as Ratings
    for (const k of RATING_KEYS) ratings[k] = Math.round(40 + 0.8 * (max[k] - 40))
    p.ratings = ratings
    p.careerBuild = { max, startFraction: 0.67, startProgress: 0.67, floor: 40, archetype: 'x' }
    const before = computeOvr(ratings, p.pos)
    const m = migrateLeague(raw)
    const me = m.players[id]
    expect(buildCost(me.careerBuild!.max)).toBeGreaterThan(BUILD_BUDGET - 40)
    expect(computeOvr(me.ratings, me.pos)).toBeGreaterThan(before)
    expect(Math.abs(ovrOf(me) - computeOvr(me.ratings, me.pos))).toBeLessThanOrEqual(5)
    expect(me.careerBuild!.budget).toBe(BUILD_BUDGET)
    // Idempotent: a second pass changes nothing.
    const again = migrateLeague(JSON.parse(JSON.stringify(m)))
    expect(again.players[id].ratings).toEqual(me.ratings)
  })
})
