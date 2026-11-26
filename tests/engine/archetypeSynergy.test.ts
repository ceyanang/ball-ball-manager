import { describe, expect, it } from 'vitest'
import { generateProspects, scoutProspect } from '../../src/engine/gm/draft'
import { analyzeUnitSynergy } from '../../src/engine/gm/synergy'
import { createLeague } from '../../src/engine/league/create'
import { generatePlayerArchetype } from '../../src/engine/player/archetype'
import { generatePlayer } from '../../src/engine/player/generate'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import type { Player, Position, Ratings, Team } from '../../src/engine/types'

function make(id: string, pos: Position, base: number, over: Partial<Ratings>): Player {
  const p = generatePlayer(Rng.fromSeed(1), { season: 1, pos })
  p.id = id
  for (const k of Object.keys(p.ratings) as (keyof Ratings)[]) p.ratings[k] = base
  Object.assign(p.ratings, over)
  return p
}

function buildTeam(base: Team, id: string, starters: Player[], benchBase = 68): { team: Team; players: Record<string, Player> } {
  const players: Record<string, Player> = {}
  starters.forEach((p, i) => {
    const copy = structuredClone(p)
    copy.id = `${id}_s${i}`
    copy.teamId = id
    players[copy.id] = copy
  })
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF']
  positions.forEach((pos, i) => {
    const b = make(`${id}_b${i}`, pos, benchBase, {})
    b.teamId = id
    players[b.id] = b
  })
  const sIds = starters.map((_, i) => `${id}_s${i}`)
  const bIds = positions.map((_, i) => `${id}_b${i}`)
  const team: Team = {
    ...base,
    id,
    rotation: {
      starters: sIds,
      bench: bIds,
      inactive: [],
      minutes: Object.fromEntries([...sIds.map((x) => [x, 42]), ...bIds.map((x, i) => [x, i < 3 ? 10 : 0])]),
    },
  }
  return { team, players }
}

describe('analyzeUnitSynergy', () => {
  it('detects spacing bonus, playmaker link, rim anchor, and lockdown clamp', () => {
    const pg = make('pg', 'PG', 72, {
      passAccuracy: 90,
      passVision: 92,
      passIQ: 88,
      ballHandle: 88,
      speedWithBall: 86,
      perimeterDefense: 62,
    })
    const sg = make('sg', 'SG', 72, {
      threePointShot: 90,
      midRangeShot: 82,
      freeThrow: 86,
      shotIQ: 85,
      perimeterDefense: 88,
      steal: 86,
      passPerception: 84,
      agility: 84,
      defensiveConsistency: 84,
    })
    const sf = make('sf', 'SF', 72, {
      threePointShot: 86,
      midRangeShot: 78,
      shotIQ: 82,
      freeThrow: 82,
      perimeterDefense: 88,
      steal: 86,
      passPerception: 84,
      agility: 84,
      defensiveConsistency: 84,
    })
    const pf = make('pf', 'PF', 72, {
      threePointShot: 86,
      midRangeShot: 82,
      shotIQ: 82,
      freeThrow: 80,
    })
    const c = make('c', 'C', 72, {
      interiorDefense: 90,
      block: 92,
      helpDefenseIQ: 88,
      hands: 86,
      standingDunk: 88,
      strength: 86,
      vertical: 84,
      threePointShot: 55,
    })

    const syn = analyzeUnitSynergy([pg, sg, sf, pf, c])
    const active = Object.fromEntries(syn.items.map((x) => [x.id, x.active]))
    expect(active.spacing).toBe(true)
    expect(active.playmakerLink).toBe(true)
    expect(active.rimAnchor).toBe(true)
    expect(active.lockdownClamp).toBe(true)
    expect(active.paintClutter).toBe(false)
    expect(syn.effects.spacingRimBonus).toBeGreaterThan(0)
    expect(syn.effects.lockdownTovBoost).toBeGreaterThan(0)
  })

  it('flags paint clutter warning when 3+ non-shooters share the floor', () => {
    const unit = [
      make('1', 'PG', 74, { threePointShot: 64 }),
      make('2', 'SG', 74, { threePointShot: 65 }),
      make('3', 'SF', 74, { threePointShot: 66 }),
      make('4', 'PF', 74, { threePointShot: 84 }),
      make('5', 'C', 74, { threePointShot: 50 }),
    ]
    const syn = analyzeUnitSynergy(unit)
    const clutter = syn.items.find((x) => x.id === 'paintClutter')!
    expect(clutter.active).toBe(true)
    expect(syn.effects.clutterPaintPenalty).toBeGreaterThan(0)
  })
})

describe('simGame archetype tendencies and unit synergy', () => {
  const l = createLeague({ seed: 10, userTeamIndex: 0, name: 'ArchSim' })
  const teams = Object.values(l.teams)

  it('gives Sharpshooters more 3PA and Slashers more rim attempts & FTA', () => {
    const sharp = make('sharp', 'SG', 76, { threePointShot: 92, midRangeShot: 78, shotIQ: 84, freeThrow: 86 })
    const slash = make('slash', 'SG', 76, { layup: 92, drivingDunk: 90, closeShot: 88, drawFoul: 88, threePointShot: 68 })
    expect(generatePlayerArchetype(sharp).baseRole).toBe('Sharpshooter')
    expect(generatePlayerArchetype(slash).baseRole).toBe('Slasher')

    const tA = buildTeam(teams[0], 'ta', [
      make('a0', 'PG', 74, { passVision: 84, passAccuracy: 84 }),
      sharp,
      make('a2', 'SF', 74, {}),
      make('a3', 'PF', 74, {}),
      make('a4', 'C', 74, {}),
    ])
    const tB = buildTeam(teams[1], 'tb', [
      make('b0', 'PG', 74, { passVision: 84, passAccuracy: 84 }),
      slash,
      make('b2', 'SF', 74, {}),
      make('b3', 'PF', 74, {}),
      make('b4', 'C', 74, {}),
    ])
    const players = { ...tA.players, ...tB.players }
    const rng = Rng.fromSeed(55)
    let sharp3 = 0, sharpFta = 0, slash3 = 0, slashFta = 0
    for (let i = 0; i < 120; i++) {
      const r = simGame(tA.team, tB.team, players, l.coaches, rng)
      const bSharp = r.box.find((x) => x.playerId === 'ta_s1')!
      const bSlash = r.box.find((x) => x.playerId === 'tb_s1')!
      sharp3 += bSharp.tpa
      sharpFta += bSharp.fta
      slash3 += bSlash.tpa
      slashFta += bSlash.fta
    }
    expect(sharp3).toBeGreaterThan(slash3 * 1.35)
    expect(slashFta).toBeGreaterThan(sharpFta * 1.2)
  })

  it('spaced lineup outperforms cluttered 3-non-shooter lineup', () => {
    const spaced = buildTeam(teams[0], 'spaced', [
      make('s0', 'PG', 75, { threePointShot: 84, midRangeShot: 82, shotIQ: 82, freeThrow: 84, passVision: 84, passAccuracy: 84 }),
      make('s1', 'SG', 75, { threePointShot: 86, midRangeShot: 82, shotIQ: 82, freeThrow: 84 }),
      make('s2', 'SF', 75, { threePointShot: 85, midRangeShot: 80, shotIQ: 82, freeThrow: 82 }),
      make('s3', 'PF', 75, { threePointShot: 82, midRangeShot: 80, shotIQ: 80, freeThrow: 80 }),
      make('s4', 'C', 75, { layup: 84, standingDunk: 88, closeShot: 86, hands: 86, threePointShot: 65 }),
    ])
    const cluttered = buildTeam(teams[1], 'clutter', [
      make('c0', 'PG', 75, { threePointShot: 64, layup: 80, drivingDunk: 78, closeShot: 78, passVision: 84, passAccuracy: 84 }),
      make('c1', 'SG', 75, { threePointShot: 65, layup: 80, drivingDunk: 78, closeShot: 78 }),
      make('c2', 'SF', 75, { threePointShot: 65, layup: 80, drivingDunk: 78, closeShot: 78 }),
      make('c3', 'PF', 75, { threePointShot: 64, standingDunk: 80, closeShot: 78 }),
      make('c4', 'C', 75, { layup: 84, standingDunk: 88, closeShot: 86, hands: 86, threePointShot: 65 }),
    ])
    const players = { ...spaced.players, ...cluttered.players }
    const rng = Rng.fromSeed(77)
    let spacedWins = 0
    for (let i = 0; i < 200; i++) {
      const flip = i % 2 === 0
      const r = simGame(flip ? spaced.team : cluttered.team, flip ? cluttered.team : spaced.team, players, l.coaches, rng)
      const diff = flip ? r.homeScore - r.awayScore : r.awayScore - r.homeScore
      if (diff > 0) spacedWins++
    }
    expect(spacedWins).toBeGreaterThan(110)
  })
})

describe('draft scouting projected archetype', () => {
  it('returns 6 pillar estimates and a projected archetype range', () => {
    const l = createLeague({ seed: 12, userTeamIndex: 0, name: 'ScoutArch' })
    const { ids, scout } = generateProspects(l, Rng.fromSeed(15))
    const p = l.players[ids[0]]
    const rep = scoutProspect(p, scout[p.id])
    expect(rep.pillars).toHaveLength(6)
    expect(rep.projected.primary.length).toBeGreaterThan(0)
    expect(rep.projected.label.length).toBeGreaterThan(0)
  })
})
