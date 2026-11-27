import { describe, expect, it } from 'vitest'
import { Rng } from '../../src/engine/rng'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import { BUILD_BUDGET, BUILD_TEMPLATES, START_FRACTION, START_OVR, buildCost, isValidBuild, makeBuild, startRatings } from '../../src/engine/career/build'
import { careerOvr } from '../../src/engine/career/careerOvr'
import type { Player, Position, Ratings } from '../../src/engine/types'

const POS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']

function playerWith(ratings: Ratings, pos: Position, max: Ratings): Player {
  return {
    id: 'c', firstName: 'A', lastName: 'B', age: 19, heightIn: 78, pos, jersey: 1, hometown: 'x', college: 'y', ratings, pot: 99,
    faceSeed: 0, teamId: null, contract: null, injury: null, morale: 70, draft: null, ratingHistory: [], careerBuild: makeBuild(max, pos),
  }
}

/** Random valid allocation: shuffle-spread BUILD_BUDGET points across keys capped at 74 each. */
function randomMax(rng: Rng): Ratings {
  const r = {} as Ratings
  for (const k of RATING_KEYS) r[k] = 25
  let left = BUILD_BUDGET
  let guard = 0
  while (left > 0 && guard++ < 100000) {
    const k = RATING_KEYS[rng.int(0, RATING_KEYS.length - 1)]
    const add = Math.min(left, rng.int(1, 12), 99 - r[k])
    r[k] += add
    left -= add
  }
  return r
}

describe('career build', () => {
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

  it('startRatings is 25 + 0.67 of the way to each max, rounded', () => {
    expect(START_FRACTION).toBe(0.67)
    const max = BUILD_TEMPLATES[1].max
    const s = startRatings(max)
    for (const k of RATING_KEYS) expect(s[k]).toBe(Math.round(25 + 0.67 * (max[k] - 25)))
  })

  it('makeBuild records the fraction, start progress and a live archetype', () => {
    const t = BUILD_TEMPLATES[2]
    const b = makeBuild(t.max, t.pos)
    expect(b.startFraction).toBe(0.67)
    expect(b.startProgress).toBeGreaterThan(0.5)
    expect(b.startProgress).toBeLessThan(0.8)
    expect(b.archetype.length).toBeGreaterThan(0)
  })
})
