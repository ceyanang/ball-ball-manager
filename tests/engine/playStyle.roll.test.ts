import { describe, expect, it } from 'vitest'
import { POSITION_ODDS, PLAY_STYLES, rollPlayStyle, styleOdds, type PlayStyle } from '../../src/engine/player/playStyle'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import type { Position, Ratings } from '../../src/engine/types'

const POS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const flat = (v: number): Ratings => Object.fromEntries(RATING_KEYS.map((k) => [k, v])) as unknown as Ratings
const top2 = (row: Record<PlayStyle, number>) => [...PLAY_STYLES].sort((a, b) => row[b] - row[a]).slice(0, 2)

const powerProfile = (): Ratings => {
  const r = flat(60)
  for (const k of ['strength', 'vertical', 'standingDunk', 'drivingDunk', 'postControl', 'layup'] as const) r[k] = 90
  return r
}
const lockdownProfile = (): Ratings => {
  const r = flat(60)
  for (const k of ['perimeterDefense', 'interiorDefense', 'steal', 'block', 'defensiveRebound', 'offensiveRebound'] as const) r[k] = 90
  return r
}

describe('play style roll', () => {
  it("odds table rows sum to 100 and keep the owner's ordering", () => {
    for (const p of POS) expect(PLAY_STYLES.reduce((s, k) => s + POSITION_ODDS[p][k], 0)).toBe(100)
    expect(top2(POSITION_ODDS.PG)).toEqual(['smart', 'offense'])
    // SG: offense on top, defensive tied with allAround for second in the owner's chart
    expect(top2(POSITION_ODDS.SG)[0]).toBe('offense')
    expect(POSITION_ODDS.SG.defensive).toBe(Math.max(POSITION_ODDS.SG.smart, POSITION_ODDS.SG.allAround, POSITION_ODDS.SG.power, POSITION_ODDS.SG.defensive))
    const sf = POSITION_ODDS.SF
    expect(top2(sf)[0]).toBe('allAround')
    expect(new Set([sf.smart, sf.offense, sf.power, sf.defensive]).size).toBe(1)
    expect(top2(POSITION_ODDS.PF)).toEqual(['power', 'defensive'])
    expect(top2(POSITION_ODDS.C)).toEqual(['defensive', 'power'])
  })

  it('styleOdds sums to 1 and is finite for all-99 and all-25 ratings', () => {
    for (const v of [99, 25]) {
      for (const p of POS) {
        const o = styleOdds(p, flat(v))
        let sum = 0
        for (const s of PLAY_STYLES) {
          expect(Number.isFinite(o[s])).toBe(true)
          expect(o[s]).toBeGreaterThanOrEqual(0)
          sum += o[s]
        }
        expect(sum).toBeCloseTo(1, 9)
      }
    }
  })

  it('rollPlayStyle is deterministic', () => {
    const r = powerProfile()
    for (let s = 1; s < 50; s++) expect(rollPlayStyle('SF', r, s)).toBe(rollPlayStyle('SF', r, s))
  })

  it('roll frequencies match styleOdds', () => {
    const r = flat(70)
    const odds = styleOdds('C', r)
    const n = 20000
    const count = Object.fromEntries(PLAY_STYLES.map((s) => [s, 0])) as Record<PlayStyle, number>
    for (let s = 1; s <= n; s++) count[rollPlayStyle('C', r, s)]++
    for (const s of PLAY_STYLES) expect(Math.abs(count[s] / n - odds[s])).toBeLessThan(0.02)
  })

  it('a power-profile center is mostly Power', () => {
    expect(styleOdds('C', powerProfile()).power).toBeGreaterThanOrEqual(0.6)
  })

  it('a lockdown-profile center is mostly Defensive', () => {
    expect(styleOdds('C', lockdownProfile()).defensive).toBeGreaterThanOrEqual(0.6)
  })

  it('every style keeps a chance at every position', () => {
    const r = powerProfile()
    for (const p of POS) for (const s of PLAY_STYLES) expect(styleOdds(p, r)[s]).toBeGreaterThanOrEqual(0.005)
  })
})
