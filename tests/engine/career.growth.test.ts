import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES, startRatings } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { ageCareerPlayer, growPlayer, rewardShare } from '../../src/engine/career/growth'
import { applyEffects } from '../../src/engine/events/effects'
import { startOffseason } from '../../src/engine/gm/offseason'
import { progressTick } from '../../src/engine/player/progress'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import type { League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[0]
function active(seed = 5): League {
  const l = createCareerLeague({ seed, name: 'G', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
  resolveCareerDraft(l, new Rng(l.rng))
  return l
}
const me = (l: League) => l.players[l.career!.playerId]
const KEY = 'threePointShot' as const

describe('career growth', () => {
  it('never exceeds his max build, however big the grant', () => {
    const l = active()
    growPlayer(l, me(l).id, [{ key: KEY, amount: 500 }], 'test')
    expect(me(l).ratings[KEY]).toBe(me(l).careerBuild!.max[KEY])
    for (const k of RATING_KEYS) expect(me(l).ratings[k]).toBeLessThanOrEqual(me(l).careerBuild!.max[k])
  })

  it('a simmed career grants half of a played one (same grant, same seed)', () => {
    const a = active(), b = active()
    a.career!.played = 10
    b.career!.simmed = 10
    expect(rewardShare(a.career!)).toBe(1)
    expect(rewardShare(b.career!)).toBe(0.5)
    expect(rewardShare({ ...a.career!, played: 0, simmed: 0 })).toBe(1)
    const k = KEY
    const start = me(a).ratings[k]
    growPlayer(a, me(a).id, [{ key: k, amount: 4 }], 'x')
    growPlayer(b, me(b).id, [{ key: k, amount: 4 }], 'x')
    expect(me(a).ratings[k] - start).toBe(4)
    expect(me(b).ratings[k] - start).toBe(2)
  })

  it('growth follows the age curve: 22 > 28 > 33', () => {
    const gain = (age: number) => {
      const l = active()
      me(l).age = age
      const before = me(l).ratings[KEY]
      growPlayer(l, me(l).id, [{ key: KEY, amount: 10 }], 'x')
      return me(l).ratings[KEY] - before
    }
    expect(gain(22)).toBeGreaterThan(gain(28))
    expect(gain(28)).toBeGreaterThan(gain(33))
    expect(gain(33)).toBe(0)
  })

  it('an injured player grows less than a healthy one', () => {
    const a = active(), b = active()
    me(b).injury = { type: 'Knee', gamesRemaining: 30, severity: 'long' }
    growPlayer(a, me(a).id, [{ key: KEY, amount: 8 }], 'x')
    growPlayer(b, me(b).id, [{ key: KEY, amount: 8 }], 'x')
    expect(me(a).ratings[KEY]).toBeGreaterThan(me(b).ratings[KEY])
  })

  it('logs every change and the log matches the rating deltas', () => {
    const l = active()
    const before = { ...me(l).ratings }
    const entries = growPlayer(l, me(l).id, [{ key: KEY, amount: 3 }, { key: 'layup', amount: 2 }], 'gym night')
    expect(l.career!.growth).toEqual(entries)
    for (const k of RATING_KEYS) {
      const logged = l.career!.growth.filter((e) => e.key === k).reduce((s, e) => s + e.delta, 0)
      expect(me(l).ratings[k] - before[k]).toBe(logged)
    }
    for (const e of entries) { expect(e.source).toBe('gym night'); expect(e.season).toBe(l.season); expect(e.delta).toBeGreaterThan(0) }
  })

  it('the grow effect applies through applyEffects and returns readable lines', () => {
    const l = active()
    const lines = applyEffects(l, [{ kind: 'grow', player: me(l).id, grants: [{ key: KEY, amount: 3 }], source: 'gym' }])
    expect(lines.join(' ')).toMatch(/three-point/i)
    expect(me(l).ratings[KEY]).toBeGreaterThan(startRatings(t.max)[KEY])
  })

  it('progressTick and the offseason leave his ratings alone while he is young; POT stays 99 until 30', () => {
    const l = active()
    const before = { ...me(l).ratings }
    const rng = new Rng({ s: 99 })
    for (let i = 0; i < 20; i++) progressTick(l, rng)
    expect(me(l).ratings).toEqual(before)
    startOffseason(l, new Rng({ s: 7 }))
    expect(me(l).age).toBe(20)
    expect(me(l).ratings).toEqual(before)
    expect(me(l).pot).toBe(99)
    expect(me(l).retired).toBeFalsy()
  })

  it('ageCareerPlayer: POT 99 through 29, follows his ceiling from 30, and decline begins after 31', () => {
    const l = active()
    const p = me(l)
    p.age = 29
    ageCareerPlayer(l, p, new Rng({ s: 1 }))
    expect(p.pot).toBe(99)
    p.age = 30
    ageCareerPlayer(l, p, new Rng({ s: 1 }))
    expect(p.pot).toBeLessThan(99)
    const sum = () => RATING_KEYS.reduce((s, k) => s + p.ratings[k], 0)
    p.age = 25
    const before = sum()
    ageCareerPlayer(l, p, new Rng({ s: 1 }))
    expect(sum()).toBe(before)
    p.age = 34
    ageCareerPlayer(l, p, new Rng({ s: 1 }))
    expect(sum()).toBeLessThan(before)
  })
})

describe('bulk sims still grow him (review finding)', () => {
  it('simming a stretch without day-by-day events grants some growth, logged', async () => {
    const { simDays } = await import('../../src/engine/season/advance')
    const l = simDays(active(9), 40)
    expect(l.career!.growth.length).toBeGreaterThan(0)
    expect(l.career!.growth.every((g) => g.delta > 0)).toBe(true)
    for (const k of RATING_KEYS) expect(me(l).ratings[k]).toBeLessThanOrEqual(me(l).careerBuild!.max[k])
  })
})
