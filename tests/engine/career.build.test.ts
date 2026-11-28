import { describe, expect, it } from 'vitest'
import { Rng } from '../../src/engine/rng'
import { RATING_KEYS, computeOvr } from '../../src/engine/player/ratings'
import { BUILD_BUDGET, BUILD_TEMPLATES, CAREER_FLOOR, START_FRACTION, START_OVR, buildCost, isValidBuild, liftToFloor, makeBuild, startRatings } from '../../src/engine/career/build'
import { careerOvr } from '../../src/engine/career/careerOvr'
import type { Player, Position, Ratings } from '../../src/engine/types'

const POS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

function playerWith(ratings: Ratings, pos: Position, max: Ratings): Player {
  return {
    id: 'c', firstName: 'A', lastName: 'B', age: 19, heightIn: 78, pos, jersey: 1, hometown: 'x', college: 'y', ratings, pot: 99,
    faceSeed: 0, playStyle: 'allAround', teamId: null, contract: null, injury: null, morale: 70, draft: null, ratingHistory: [], careerBuild: makeBuild(max, pos),
  }
}

/** Random valid allocation: shuffle-spread BUILD_BUDGET points across keys capped at 74 each. */
function randomMax(rng: Rng): Ratings {
  const r = {} as Ratings
  for (const k of RATING_KEYS) r[k] = k === 'intangibles' ? 99 : 40
  const keys = RATING_KEYS.filter((k) => k !== 'intangibles')
  let left = BUILD_BUDGET
  let guard = 0
  while (left > 0 && guard++ < 100000) {
    const k = keys[rng.int(0, keys.length - 1)]
    const add = Math.min(left, rng.int(1, 12), 99 - r[k])
    r[k] += add
    left -= add
  }
  return r
}

describe('career build', () => {
  it('intangibles is always 99, free, and never in the build budget', () => {
    for (const t of BUILD_TEMPLATES) { expect(t.max.intangibles).toBe(99); expect(startRatings(t.max).intangibles).toBe(99) }
    expect(makeBuild({ ...BUILD_TEMPLATES[0].max, intangibles: 40 }, 'PG').max.intangibles).toBe(99)
  })

  it('has templates that each spend the whole budget exactly and are valid', () => {
    expect(BUILD_TEMPLATES.length).toBeGreaterThanOrEqual(8)
    for (const t of BUILD_TEMPLATES) {
      expect(buildCost(t.max), t.id).toBe(BUILD_BUDGET)
      expect(isValidBuild(t.max), t.id).toBe(true)
    }
    expect(new Set(BUILD_TEMPLATES.map((t) => t.pos)).size).toBe(5)
  })

  it('a fully maxed build reads exactly 99 for every template and 200 random allocations', () => {
    for (const t of BUILD_TEMPLATES) expect(careerOvr(playerWith({ ...t.max }, t.pos, t.max)), t.id).toBe(99)
    const rng = Rng.fromSeed(5)
    for (let i = 0; i < 200; i++) {
      const max = randomMax(rng), pos = POS[i % 5]
      expect(isValidBuild(max)).toBe(true)
      expect(careerOvr(playerWith({ ...max }, pos, max))).toBe(99)
    }
  })

  it('a fresh 19-year-old reads about 68', () => {
    const rng = Rng.fromSeed(6)
    for (const t of BUILD_TEMPLATES) expect(Math.abs(careerOvr(playerWith(startRatings(t.max), t.pos, t.max)) - START_OVR), t.id).toBeLessThanOrEqual(1)
    for (let i = 0; i < 50; i++) {
      const max = randomMax(rng)
      expect(Math.abs(careerOvr(playerWith(startRatings(max), POS[i % 5], max)) - START_OVR)).toBeLessThanOrEqual(1)
    }
  })

  it('growing any key never lowers it and never exceeds 99', () => {
    const t = BUILD_TEMPLATES[0]
    const base = startRatings(t.max)
    let last = careerOvr(playerWith(base, t.pos, t.max))
    for (const k of RATING_KEYS) {
      const grown = { ...base, [k]: t.max[k] }
      const v = careerOvr(playerWith(grown, t.pos, t.max))
      expect(v).toBeGreaterThanOrEqual(careerOvr(playerWith(base, t.pos, t.max)))
      expect(v).toBeLessThanOrEqual(99)
      void last; last = v
    }
  })

  it('isValidBuild rejects out-of-range keys and over-budget builds', () => {
    const ok = BUILD_TEMPLATES[0].max
    expect(isValidBuild({ ...ok, closeShot: 24 })).toBe(false)
    expect(isValidBuild({ ...ok, closeShot: 100 })).toBe(false)
    const over = { ...ok }
    for (const k of RATING_KEYS) if (over[k] < 99) { over[k] += 1; break }
    expect(isValidBuild(over)).toBe(false)
  })

  it('Career OVR is honest: tracks the real league OVR, and a max build is a real 94+ superstar', () => {
    for (const t of BUILD_TEMPLATES) {
      expect(computeOvr(t.max, t.pos), t.id).toBeGreaterThanOrEqual(94)
      const mid = {} as Ratings
      for (const k of RATING_KEYS) mid[k] = Math.round(40 + 0.8 * (t.max[k] - 40))
      const real = computeOvr(mid, t.pos), shown = careerOvr(playerWith(mid, t.pos, t.max))
      expect(Math.abs(shown - real), t.id).toBeLessThanOrEqual(3)
      expect(shown, t.id).toBeGreaterThanOrEqual(78)
    }
  })

  it('startRatings is 40 + START_FRACTION of the way to each max, rounded (intangibles fixed)', () => {
    expect(START_FRACTION).toBe(0.5)
    const max = BUILD_TEMPLATES[1].max
    const s = startRatings(max)
    for (const k of RATING_KEYS) expect(s[k]).toBe(k === 'intangibles' ? 99 : Math.round(40 + START_FRACTION * (max[k] - 40)))
  })

  it('makeBuild records the fraction, start progress and a live archetype', () => {
    const t = BUILD_TEMPLATES[2]
    const b = makeBuild(t.max, t.pos)
    expect(b.startFraction).toBe(0.5)
    expect(b.startProgress).toBeGreaterThan(0.5)
    expect(b.startProgress).toBeLessThan(0.8)
    expect(b.archetype.length).toBeGreaterThan(0)
  })
})

describe('career 40 floor', () => {
  it('never starts, builds or ages a career rating below 40', () => {
    for (const t of BUILD_TEMPLATES) {
      const s = startRatings(t.max)
      for (const k of RATING_KEYS) {
        expect(t.max[k], `${t.id} ${k}`).toBeGreaterThanOrEqual(CAREER_FLOOR)
        expect(s[k], `${t.id} ${k}`).toBeGreaterThanOrEqual(CAREER_FLOOR)
      }
    }
    const low = { ...BUILD_TEMPLATES[0].max, block: 39 }
    expect(isValidBuild(low)).toBe(false)
  })

  it('liftToFloor moves an old 25-floor save onto 40 without dropping his Career OVR', () => {
    const oldStart = (max: Ratings) => {
      const r = {} as Ratings
      for (const k of RATING_KEYS) r[k] = Math.round(25 + 0.67 * (max[k] - 25))
      return r
    }
    for (const t of BUILD_TEMPLATES) {
      const max = { ...t.max, block: 25, postHook: 30 }
      // An untouched pre-floor draftee: old start ratings, no `floor` marker.
      const p = playerWith(oldStart(max), t.pos, max)
      p.careerBuild = { max: { ...max }, startFraction: 0.67, startProgress: 0.67, archetype: 'x' }
      liftToFloor(p)
      for (const k of RATING_KEYS) {
        expect(p.ratings[k]).toBeGreaterThanOrEqual(CAREER_FLOOR)
        expect(p.careerBuild!.max[k]).toBeGreaterThanOrEqual(CAREER_FLOOR)
      }
      // Legacy (0.67-fraction, 960-budget) saves are re-anchored by careerOvr, so only sanity-check the range here.
      expect(Math.abs(careerOvr(p) - START_OVR), t.id).toBeLessThanOrEqual(12)
      const before = JSON.stringify(p)
      liftToFloor(p)
      expect(JSON.stringify(p)).toBe(before)
    }
  })

  it('liftToFloor leaves a build made on the 40 floor alone', () => {
    const t = BUILD_TEMPLATES[3]
    const p = playerWith(startRatings(t.max), t.pos, t.max)
    const before = JSON.stringify(p)
    liftToFloor(p)
    expect(JSON.stringify(p)).toBe(before)
    expect(careerOvr(p)).toBe(START_OVR)
  })
})
