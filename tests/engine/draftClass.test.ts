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

  it('keeps every first-rounder at 69+ and round 2 between 56 and 70', () => {
    for (const c of classes) {
      for (const e of c.slice(0, 30)) expect(e.target).toBeGreaterThanOrEqual(69)
      for (const e of c.slice(30)) { expect(e.target).toBeLessThanOrEqual(70); expect(e.target).toBeGreaterThanOrEqual(56) }
    }
  })

  it('makes the top pick around 80-84 and never above 86', () => {
    expect(mean(classes.map((c) => c[0].target))).toBeGreaterThan(79)
    expect(mean(classes.map((c) => c[0].target))).toBeLessThan(85)
    for (const c of classes) expect(c[0].target).toBeLessThanOrEqual(86)
  })

  it('rolls a generational player in a fair share of classes, not all', () => {
    const share = classes.filter((c) => c.some((e) => e.generational)).length / classes.length
    expect(share).toBeGreaterThan(0.4)
    expect(share).toBeLessThan(0.95)
  })

  it('shapes the lottery band and the late-first band', () => {
    expect(mean(classes.flatMap((c) => c.slice(5, 14).map((e) => e.target)))).toBeGreaterThan(71.5)
    expect(mean(classes.flatMap((c) => c.slice(5, 14).map((e) => e.target)))).toBeLessThan(76.5)
    expect(mean(classes.flatMap((c) => c.slice(14, 30).map((e) => e.target)))).toBeGreaterThan(69)
    expect(mean(classes.flatMap((c) => c.slice(14, 30).map((e) => e.target)))).toBeLessThan(73)
  })
})

describe('generateProspects', () => {
  it('builds real players: first-rounders 68+ OVR, POT within ovr+3..98', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'T' })
    const { ids } = generateProspects(l, Rng.fromSeed(7))
    expect(ids).toHaveLength(PROSPECTS)
    ids.forEach((id, i) => {
      const p = l.players[id]
      const o = computeOvr(p.ratings, p.pos)
      if (i < 30) expect(o).toBeGreaterThanOrEqual(68)
      expect(p.pot).toBeGreaterThanOrEqual(o + 3)
      expect(p.pot).toBeLessThanOrEqual(98)
    })
  })

  it('produces high-potential sleepers outside the top 5 across classes', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'T' })
    let lateGems = 0
    for (let s = 1; s <= 25; s++) {
      const { ids } = generateProspects(l, Rng.fromSeed(s))
      for (const id of ids.slice(5)) if (l.players[id].pot >= 86) lateGems++
    }
    expect(lateGems).toBeGreaterThanOrEqual(12)
  })
})
