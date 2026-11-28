import { describe, expect, it } from 'vitest'
import { generateProspects, scoutProspect } from '../../src/engine/gm/draft'
import { rosterSynergy } from '../../src/engine/gm/synergy'
import { createLeague } from '../../src/engine/league/create'
import { generatePlayer } from '../../src/engine/player/generate'
import { RATING_GROUPS, RATING_KEYS, computeOvr } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { rollInjuries } from '../../src/engine/sim/injury'
import { autoRotation } from '../../src/engine/sim/rotation'
import type { Player, Position, Team } from '../../src/engine/types'

/** Quarter-variance comparison needs a big sample: the consistency effect is small next to game noise. */
const N_GAMES = 1500
describe('36-attribute schema & OVR', () => {
  it('defines exactly 36 attributes across 7 groups', () => {
    expect(RATING_GROUPS).toHaveLength(7)
    expect(RATING_KEYS).toHaveLength(36)
    expect(new Set(RATING_KEYS).size).toBe(36)
  })

  it('intangibles nudges OVR without inflating raw box-score stats', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'Intangibles' })
    const teams = Object.values(l.teams)
    const pLow = generatePlayer(Rng.fromSeed(2), { season: 1, pos: 'PG', targetOvr: 78 })
    pLow.ratings.intangibles = 35
    const pHigh = structuredClone(pLow)
    pHigh.ratings.intangibles = 98
    expect(computeOvr(pHigh.ratings, 'PG')).toBeGreaterThan(computeOvr(pLow.ratings, 'PG'))

    // Swap a starter's intangibles between 35 and 98 (keeping same usage-adjacent ratings via equal team)
    const clone = (intang: number, id: string, base: Team) => {
      const ps: Record<string, Player> = {}
      ;(['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF'] as Position[]).forEach((pos, i) => {
        const p = generatePlayer(Rng.fromSeed(50 + i), { season: 1, pos, targetOvr: 75 })
        p.id = `${id}_${i}`
        p.teamId = id
        p.ratings.intangibles = intang
        ps[p.id] = p
      })
      return { team: { ...base, id, rotation: autoRotation(Object.values(ps)) }, ps }
    }
    const a = clone(30, 't_low', teams[0])
    const b = clone(99, 't_high', teams[1])
    const players = { ...a.ps, ...b.ps }
    const rng = Rng.fromSeed(99)
    let diff = 0
    for (let i = 0; i < 400; i++) {
      const flip = i % 2 === 0
      const r = simGame(flip ? a.team : b.team, flip ? b.team : a.team, players, l.coaches, rng)
      diff += flip ? r.homeScore - r.awayScore : r.awayScore - r.homeScore
    }
    // Nearly zero score differential (no artificial stat boost from intangibles)
    expect(Math.abs(diff / 400)).toBeLessThan(1.5)
  })
})

describe('quarter-by-quarter consistency & durability', () => {
  it('low offensiveConsistency creates wider quarter-to-quarter scoring swings', () => {
    const l = createLeague({ seed: 2, userTeamIndex: 0, name: 'Cons' })
    const teams = Object.values(l.teams)
    const mk = (cons: number, id: string, base: Team) => {
      const ps: Record<string, Player> = {}
      ;(['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF'] as Position[]).forEach((pos, i) => {
        const p = generatePlayer(Rng.fromSeed(10 + i), { season: 1, pos, targetOvr: 76 })
        p.id = `${id}_${i}`
        p.teamId = id
        p.ratings.offensiveConsistency = cons
        ps[p.id] = p
      })
      return { team: { ...base, id, rotation: autoRotation(Object.values(ps)) }, ps }
    }
    const steady = mk(98, 'steady', teams[0])
    const streaky = mk(28, 'streaky', teams[1])
    const opp = mk(75, 'opp', teams[2])
    const players = { ...steady.ps, ...streaky.ps, ...opp.ps }
    const qVariance = (team: Team) => {
      const rng = Rng.fromSeed(17)
      const qs: number[] = []
      for (let i = 0; i < N_GAMES; i++) {
        const r = simGame(team, opp.team, players, l.coaches, rng)
        qs.push(...r.quarters.home.slice(0, 4))
      }
      const m = qs.reduce((s, x) => s + x, 0) / qs.length
      return qs.reduce((s, x) => s + (x - m) ** 2, 0) / qs.length
    }
    expect(qVariance(streaky.team)).toBeGreaterThan(qVariance(steady.team))
  })

  it('overallDurability reduces injury frequency', () => {
    const l = createLeague({ seed: 3, userTeamIndex: 0, name: 'Dur' })
    const t = Object.values(l.teams)[0]
    const opp = Object.values(l.teams)[1]
    const sample = simGame(t, opp, l.players, l.coaches, Rng.fromSeed(1))
    const count = (dur: number) => {
      const ps = structuredClone(l.players)
      for (const p of Object.values(ps)) { p.injury = null; p.ratings.overallDurability = dur }
      const rng = Rng.fromSeed(44)
      let hits = 0
      for (let i = 0; i < 800; i++) hits += rollInjuries(sample, ps, rng).length
      return hits
    }
    expect(count(30)).toBeGreaterThan(count(95) * 1.5)
  })
})

describe('GM synergy & scouting', () => {
  it('rewards spacing and playmaking-finisher roster synergy', () => {
    const rng = Rng.fromSeed(5)
    const makeTeam = (three: number, vis: number, hands: number) =>
      Array.from({ length: 9 }, (_, i) => {
        const p = generatePlayer(rng, { season: 1, pos: (['PG', 'SG', 'SF', 'PF', 'C'] as Position[])[i % 5], targetOvr: 78 })
        p.ratings.threePointShot = three
        p.ratings.passVision = vis
        p.ratings.passIQ = vis
        p.ratings.hands = hands
        p.ratings.standingDunk = hands
        return p
      })
    const cohesive = rosterSynergy(makeTeam(86, 86, 86))
    const clunky = rosterSynergy(makeTeam(45, 50, 50))
    expect(cohesive.overall).toBeGreaterThanOrEqual(clunky.overall + 20)
    expect(cohesive.pillars).toHaveLength(4)
  })

  it('scoutProspect returns 7 category estimates and top 3 traits', () => {
    const l = createLeague({ seed: 8, userTeamIndex: 0, name: 'Draft' })
    const { ids, scout } = generateProspects(l, Rng.fromSeed(9))
    const p = l.players[ids[0]]
    const rep = scoutProspect(p, scout[p.id])
    expect(rep.categories).toHaveLength(7)
    expect(rep.strengths).toHaveLength(3)
    for (const c of rep.categories) {
      expect(c.lo).toBeLessThanOrEqual(c.est)
      expect(c.est).toBeLessThanOrEqual(c.hi)
    }
  })
})
