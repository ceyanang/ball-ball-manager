import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { ageCareerPlayer } from '../../src/engine/career/growth'
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

describe('career growth', () => {
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

describe('bulk sims still earn him skill points', () => {
  it('simming a stretch pays at least 1 SP for every game he played, and never touches his ratings', async () => {
    const { simDays } = await import('../../src/engine/season/advance')
    const start = active(9)
    const before = { ...me(start).ratings }
    const l = simDays(start, 40)
    const c = l.career!
    const games = c.played + c.simmed
    expect(games).toBeGreaterThan(10)
    expect(c.sp!).toBeGreaterThanOrEqual(games)
    expect(c.spEarned).toBe(c.sp)
    expect(me(l).ratings).toEqual(before)
  })
})
