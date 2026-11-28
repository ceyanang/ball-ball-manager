import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { careerPlayDay } from '../../src/engine/career/play'
import {
  TRAINING_GROUPS, TRAINING_TIERS, awardSp, buyTraining, canTrain, gameSp, groupRoom, PERF_STEP,
} from '../../src/engine/career/training'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import type { BoxLine, League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[1]
function active(seed = 5): League {
  const l = createCareerLeague({ seed, name: 'G', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
  resolveCareerDraft(l, new Rng(l.rng))
  return l
}
const me = (l: League) => l.players[l.career!.playerId]
const [T3, T7, T12] = TRAINING_TIERS
const box = (id: string, over: Partial<BoxLine> = {}): BoxLine => ({
  playerId: id, teamId: 't', gs: true, min: 30, pts: 10, oreb: 1, dreb: 3, ast: 2, stl: 1, blk: 0, tov: 2, pf: 2,
  fgm: 4, fga: 9, tpm: 1, tpa: 3, ftm: 1, fta: 2, pm: 0, ...over,
})

describe('training tiers', () => {
  it('3 SP = 1 point, 7 SP = 3 points, 12 SP = 6 points, all inside the chosen group', () => {
    for (const [tier, pts] of [[T3, 1], [T7, 3], [T12, 6]] as const) {
      const l = active()
      awardSp(l, 20, 'test')
      const g = TRAINING_GROUPS.find((x) => x.id === 'shooting')!
      const before = { ...me(l).ratings }
      const out = buyTraining(l, 'shooting', tier)
      expect(l.career!.sp).toBe(20 - tier.cost)
      expect(out.reduce((s, e) => s + e.delta, 0)).toBe(pts)
      for (const k of RATING_KEYS) {
        const d = me(l).ratings[k] - before[k]
        if (!g.keys.includes(k)) expect(d).toBe(0)
        expect(me(l).ratings[k]).toBeLessThanOrEqual(me(l).careerBuild!.max[k])
      }
      expect(l.career!.growth.slice(-out.length)).toEqual(out)
    }
  })

  it('only grows skills that still have room, and refuses a maxed group', () => {
    const l = active()
    awardSp(l, 100, 'test')
    const p = me(l)
    p.ratings.offensiveRebound = p.careerBuild!.max.offensiveRebound
    p.ratings.defensiveRebound = p.careerBuild!.max.defensiveRebound - 1
    const reb = TRAINING_GROUPS.find((x) => x.id === 'rebounding')!
    expect(groupRoom(p, reb)).toBe(1)
    expect(canTrain(l, 'rebounding', T7).ok).toBe(false)
    expect(canTrain(l, 'rebounding', T3).ok).toBe(true)
    buyTraining(l, 'rebounding', T3)
    expect(p.ratings.defensiveRebound).toBe(p.careerBuild!.max.defensiveRebound)
    expect(p.ratings.offensiveRebound).toBe(p.careerBuild!.max.offensiveRebound)
    const check = canTrain(l, 'rebounding', T3)
    expect(check.ok).toBe(false)
    expect(() => buyTraining(l, 'rebounding', T3)).toThrow(/maxed/)
  })

  it('needs enough SP', () => {
    const l = active()
    awardSp(l, 11, 'test')
    expect(canTrain(l, 'defense', T12).ok).toBe(false)
    expect(canTrain(l, 'defense', T7).ok).toBe(true)
  })

  it('two trainings on the same day roll differently but replay identically from the same save', () => {
    const run = () => {
      const l = active()
      awardSp(l, 24, 'test')
      return [buyTraining(l, 'athleticism', T12), buyTraining(l, 'athleticism', T12)].map((o) => o.map((e) => `${e.key}${e.delta}`).join())
    }
    expect(run()).toEqual(run())
  })
})

describe('earning SP', () => {
  it('every game is worth at least 1; beating his average earns more, capped', () => {
    const l = active()
    const id = me(l).id
    expect(gameSp(l, box(id)).total).toBe(1) // no average yet
    // Give him an average to beat.
    l.statLines['x'] = { season: l.season, playoffs: false, playerId: id, teamId: 't', gp: 10, gs: 10, min: 300, pts: 100, oreb: 10, dreb: 30, ast: 20, stl: 10, blk: 0, tov: 20, pf: 20, fgm: 40, fga: 90, tpm: 10, tpa: 30, ftm: 10, fta: 20, pm: 0 }
    expect(gameSp(l, box(id, { pts: 2, fgm: 1, fga: 10 })).total).toBe(1)
    expect(gameSp(l, box(id, { pts: 10 + PERF_STEP * 2 })).perf).toBe(2)
    expect(gameSp(l, box(id, { pts: 80 })).perf).toBe(4)
    expect(gameSp(l, box(id), 6).moments).toBe(2)
  })

  it('playing a day by hand pays SP for his game (and the box score is unchanged by it)', () => {
    let l = active(3)
    let sp = 0
    for (let d = 0; d < 6; d++) {
      let r = careerPlayDay(l, 'play')
      let guard = 0
      while (r.kind === 'moment' && guard++ < 50) r = careerPlayDay(r.league, 'play', r.prompt.options[0].answer)
      l = r.league
      sp = l.career!.sp ?? 0
    }
    const games = l.career!.played + l.career!.simmed
    expect(games).toBeGreaterThan(0)
    expect(sp).toBeGreaterThanOrEqual(games)
  })
})
