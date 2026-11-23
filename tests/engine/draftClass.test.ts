import { describe, expect, it } from 'vitest'
import { generateProspects, prospectTargets, PROSPECTS } from '../../src/engine/gm/draft'
import { createLeague } from '../../src/engine/league/create'
import { computeOvr } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const classes = SEEDS.map((s) => prospectTargets(Rng.fromSeed(s)))

describe('prospectTargets', () => {
  it('returns a full class sorted best-first', () => {
    for (const c of classes) {
      expect(c).toHaveLength(PROSPECTS)
      for (let i = 1; i < c.length; i++) expect(c[i - 1].target).toBeGreaterThanOrEqual(c[i].target)
    }
  })

  it('keeps every first-rounder at 68+ and round 2 between 42 and 62', () => {
    for (const c of classes) {
      for (const e of c.slice(0, 30)) expect(e.target).toBeGreaterThanOrEqual(68)
      for (const e of c.slice(30)) { expect(e.target).toBeLessThanOrEqual(62); expect(e.target).toBeGreaterThanOrEqual(42) }
    }
  })

  it('makes the top pick around 80 and never above 84', () => {
    expect(mean(classes.map((c) => c[0].target))).toBeGreaterThan(77)
    expect(mean(classes.map((c) => c[0].target))).toBeLessThan(82)
    for (const c of classes) expect(c[0].target).toBeLessThanOrEqual(84)
  })

  it('rolls a generational player in a fair share of classes, not all', () => {
    const share = classes.filter((c) => c.some((e) => e.generational)).length / classes.length
    expect(share).toBeGreaterThan(0.4)
    expect(share).toBeLessThan(0.9)
  })

  it('shapes the lottery band and the late-first band', () => {
    expect(mean(classes.flatMap((c) => c.slice(5, 14).map((e) => e.target)))).toBeGreaterThan(70)
    expect(mean(classes.flatMap((c) => c.slice(5, 14).map((e) => e.target)))).toBeLessThan(75)
    expect(mean(classes.flatMap((c) => c.slice(14, 30).map((e) => e.target)))).toBeGreaterThan(68)
    expect(mean(classes.flatMap((c) => c.slice(14, 30).map((e) => e.target)))).toBeLessThan(71.5)
  })
})

describe('generateProspects', () => {
  it('builds real players: first-rounders 67+ OVR, POT within ovr+3..97', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'T' })
    const { ids } = generateProspects(l, Rng.fromSeed(7))
    expect(ids).toHaveLength(PROSPECTS)
    ids.forEach((id, i) => {
      const p = l.players[id]
      const o = computeOvr(p.ratings, p.pos)
      if (i < 30) expect(o).toBeGreaterThanOrEqual(67)
      expect(p.pot).toBeGreaterThanOrEqual(o + 3)
      expect(p.pot).toBeLessThanOrEqual(97)
    })
  })
})
