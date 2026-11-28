import { describe, expect, it } from 'vitest'
import { ovrOf } from '../../src/engine/career/careerOvr'
import { createLeague } from '../../src/engine/league/create'
import { BOOSTED_KEYS, boostedRatings, smartBump, smartIqOf, STYLE_BOOST, type PlayStyle } from '../../src/engine/player/playStyle'
import { RATING_KEYS, SKILL_KEYS, computeOvr } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import type { Player, Ratings, Team } from '../../src/engine/types'

const flat = (v: number): Ratings => Object.fromEntries(RATING_KEYS.map((k) => [k, v])) as unknown as Ratings
const mk = (style: PlayStyle, ratings: Ratings): Player => ({
  id: 'x', firstName: 'A', lastName: 'B', age: 25, heightIn: 80, pos: 'C', jersey: 1, hometown: '', college: '', ratings, pot: 70,
  faceSeed: 0, playStyle: style, teamId: null, contract: null, injury: null, morale: 60, draft: null, ratingHistory: [],
})

describe('boostedRatings', () => {
  it('power gets its bump on its keys only and never mutates the stored ratings', () => {
    const p = mk('power', flat(70))
    const copy = structuredClone(p.ratings)
    const b = boostedRatings(p, 0, false)
    expect(b.strength).toBe(70 + STYLE_BOOST.power)
    expect(b.postFade).toBe(70 + STYLE_BOOST.power)
    expect(b.threePointShot).toBe(70)
    expect(p.ratings).toEqual(copy)
    expect(b).not.toBe(p.ratings)
  })

  it('caps at 99 and lifts all-25 ratings on the style keys', () => {
    for (const s of ['smart', 'offense', 'allAround', 'power', 'defensive'] as PlayStyle[]) {
      const hi = boostedRatings(mk(s, flat(99)), 99, true)
      for (const k of RATING_KEYS) expect(hi[k]).toBe(99)
    }
    const lo = boostedRatings(mk('power', flat(25)), 0, false)
    for (const k of BOOSTED_KEYS.power) expect(lo[k]).toBe(25 + STYLE_BOOST.power)
  })

  it('allAround gets +2 on every skill, intangibles untouched', () => {
    const b = boostedRatings(mk('allAround', flat(60)), 0, false)
    for (const k of SKILL_KEYS) expect(b[k]).toBe(62)
    expect(b.intangibles).toBe(60)
  })

  it('smart bump scales with the smartest Smart player; teammates get +1 shotIQ/passIQ', () => {
    const p = mk('smart', flat(60))
    expect(boostedRatings(p, 70, true).passVision).toBe(63)
    expect(boostedRatings(p, 85, true).passVision).toBe(65)
    expect(boostedRatings(p, 100, true).passVision).toBe(66)
    const mate = boostedRatings(mk('defensive', flat(60)), 85, true)
    expect(mate.shotIQ).toBe(61)
    expect(mate.passIQ).toBe(61)
    expect(mate.passVision).toBe(60)
    expect(boostedRatings(mk('offense', flat(60)), 85, false).shotIQ).toBe(60)
    expect(smartIqOf({ ...flat(60), passVision: 90, passIQ: 60, shotIQ: 90 })).toBe(80)
  })
})

describe('boosts inside simGame', () => {
  const league = createLeague({ seed: 4, userTeamIndex: 0, name: 'B' })
  const tIds = Object.keys(league.teams)
  const home = league.teams[tIds[0]]
  const away = league.teams[tIds[1]]
  const roster = (t: Team) => [...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive]
  const withStyle = (t: Team, s: PlayStyle) => {
    const ps: Record<string, Player> = { ...league.players }
    for (const id of roster(t)) ps[id] = { ...ps[id], playStyle: s }
    return ps
  }

  it('all-Smart and no-Smart teams sim without NaN', () => {
    for (const s of ['smart', 'defensive'] as PlayStyle[]) {
      const r = simGame(home, away, withStyle(home, s), league.coaches, Rng.fromSeed(3))
      expect(Number.isFinite(r.homeScore) && Number.isFinite(r.awayScore)).toBe(true)
      for (const b of r.box) for (const v of Object.values(b)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
    }
  })

  it('stored ratings and OVR are untouched by a game', () => {
    const before = structuredClone(league.players)
    const ovr = Object.fromEntries(Object.values(league.players).map((p) => [p.id, ovrOf(p)]))
    simGame(home, away, league.players, league.coaches, Rng.fromSeed(5))
    for (const p of Object.values(league.players)) {
      expect(p.ratings).toEqual(before[p.id].ratings)
      expect(ovrOf(p)).toBe(ovr[p.id])
    }
  })

  it('a Power team scores more inside than the same team as All-Around', () => {
    const inside = (s: PlayStyle) => {
      const ps = withStyle(home, s)
      let two = 0, fga = 0
      for (let g = 1; g <= 300; g++) {
        for (const b of simGame(home, away, ps, league.coaches, Rng.fromSeed(g)).box) if (b.teamId === home.id) { two += b.fga - b.tpa; fga += b.fga }
      }
      return two / fga
    }
    expect(inside('power')).toBeGreaterThan(inside('allAround'))
  })

  it.each(['power', 'defensive', 'offense', 'smart'] as PlayStyle[])('balance: a 70-OVR all-%s team does not beat an 80-OVR team in most games', (style) => {
    // Same squad shape, ratings shifted so the gap is ~10 OVR; the weak side gets the style's boost.
    const shift = (t: Team, d: number, s: PlayStyle) => {
      const ps: Record<string, Player> = {}
      for (const id of roster(t)) {
        const p = league.players[id]
        const r = { ...p.ratings }
        for (const k of SKILL_KEYS) r[k] = Math.max(25, Math.min(99, r[k] + d))
        ps[id] = { ...p, ratings: r, playStyle: s }
      }
      return ps
    }
    const strong = shift(away, 0, 'allAround')
    const strongOvr = avgOvr(Object.values(strong))
    let d = 0
    let weak = shift(home, d, style)
    while (avgOvr(Object.values(weak)) > strongOvr - 10 && d > -40) weak = shift(home, --d, style)
    // Every player has a style, so the strong side takes the mildest one (All-Around +2); the boosted weak side must still lose most games.
    const ps = { ...league.players, ...strong, ...weak }
    let weakWins = 0
    for (let g = 1; g <= 200; g++) {
      const r = simGame(home, away, ps, league.coaches, Rng.fromSeed(g))
      if (r.homeScore > r.awayScore) weakWins++
    }
    expect(weakWins).toBeLessThan(100)
  })
})

function avgOvr(ps: Player[]): number {
  const top = ps.map((p) => computeOvr(p.ratings, p.pos)).sort((a, b) => b - a).slice(0, 8)
  return top.reduce((a, b) => a + b, 0) / top.length
}

describe('effectiveRatings (the per-game sim ratings)', () => {
  it('boosts every rostered player once per game, Smart scaling from the top-8 only', async () => {
    const { effectiveRatings } = await import('../../src/engine/sim/game')
    const { gameLineup } = await import('../../src/engine/sim/rotation')
    const l = createLeague({ seed: 6, userTeamIndex: 0, name: 'E' })
    const [h, a] = Object.values(l.teams)
    const ps: Record<string, Player> = { ...l.players }
    const lu = gameLineup(h, ps)
    const top8 = [...lu.starters, ...lu.bench].slice(0, 8)
    const outside = [...h.rotation.starters, ...h.rotation.bench, ...h.rotation.inactive].filter((id) => !top8.includes(id))
    for (const id of Object.keys(ps)) if (ps[id].teamId === h.id) ps[id] = { ...ps[id], playStyle: 'defensive' }
    // A genius Smart player outside the top 8 must not set the Smart scaling or lift teammates.
    ps[outside[0]] = { ...ps[outside[0]], playStyle: 'smart', ratings: { ...ps[outside[0]].ratings, passVision: 99, passIQ: 99, shotIQ: 99 } }
    let eff = effectiveRatings(h, a, ps)
    expect(eff[top8[0]].shotIQ).toBe(ps[top8[0]].ratings.shotIQ)
    expect(eff[top8[0]].steal).toBe(Math.min(99, ps[top8[0]].ratings.steal + STYLE_BOOST.defensive))
    // Inside the top 8 he lifts his teammates.
    ps[top8[7]] = { ...ps[top8[7]], playStyle: 'smart' }
    eff = effectiveRatings(h, a, ps)
    expect(eff[top8[0]].shotIQ).toBe(Math.min(99, ps[top8[0]].ratings.shotIQ + 1))
    expect(eff[top8[7]].passVision).toBe(Math.min(99, ps[top8[7]].ratings.passVision + smartBump(smartIqOf(ps[top8[7]].ratings))))
  })
})
