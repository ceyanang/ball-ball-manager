import { generateCoach } from '../coach/generate'
import { MIN_SALARY, SALARY_CAP } from '../constants'
import { salaryForPlayer } from '../contracts'
import { PARODY_TEAMS } from '../data/teams'
import { generatePlayer } from '../player/generate'
import { computeOvr } from '../player/ratings'
import { Rng } from '../rng'
import { generateSchedule } from '../schedule/schedule'
import { autoRotation } from '../sim/rotation'
import type { League, Player, Team } from '../types'

const PER_TEAM = 14
const FREE_AGENTS = 25
const SUPERSTARS = 8

const isG = (p: Player) => p.pos === 'PG' || p.pos === 'SG'
const isF = (p: Player) => p.pos === 'SF' || p.pos === 'PF'
const isB = (p: Player) => p.pos === 'PF' || p.pos === 'C'
const ovr = (p: Player) => computeOvr(p.ratings, p.pos)

function unmetNeeds(roster: Player[]) {
  const g = roster.filter(isG).length, f = roster.filter(isF).length, b = roster.filter(isB).length
  return { g: Math.max(0, 2 - g), f: Math.max(0, 2 - f), b: Math.max(0, 2 - b) }
}
const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C']
/** Draft bonus for filling a thin spot: none at this position is a big need, an adjacent body helps a bit. */
function positionNeed(roster: Player[], p: Player): number {
  const at = roster.filter((q) => q.pos === p.pos).length
  const i = POS_ORDER.indexOf(p.pos)
  const near = roster.filter((q) => Math.abs(POS_ORDER.indexOf(q.pos) - i) === 1).length
  const base = at === 0 ? 5 : at === 1 ? 2.5 : at === 2 ? 0 : -2.5 * (at - 2)
  return base - (at === 0 && near >= 2 ? 1.5 : 0)
}
const fills = (p: Player, n: { g: number; f: number; b: number }) => (n.g > 0 && isG(p)) || (n.f > 0 && isF(p)) || (n.b > 0 && isB(p))

export function createLeague(opts: { seed: number; userTeamIndex: number; name: string; season?: number }): League {
  const season = opts.season ?? 1
  const rng = Rng.fromSeed(opts.seed)

  const teams: Team[] = PARODY_TEAMS.map((t) => ({
    id: 't_' + t.abbrev.toLowerCase(),
    city: t.city,
    name: t.name,
    abbrev: t.abbrev,
    conf: t.conf,
    colors: { primary: t.primary, secondary: t.secondary },
    coachId: '',
    rotation: { starters: [], bench: [], inactive: [] },
  }))

  // Tiered talent (2K-style): one lead per team (8 of them superstars), 4 starters, 7 bench, 2 deep bench.
  const make = (n: number, target: () => number) =>
    Array.from({ length: n }, () => generatePlayer(rng, { season, targetOvr: target() }))
  const clampT = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))
  const tiers: Player[][] = [
    [
      ...make(1, () => rng.int(94, 97)),
      ...make(SUPERSTARS - 1, () => clampT(rng.normal(92, 2.5), 89, 97)),
      ...make(teams.length - SUPERSTARS, () => clampT(rng.normal(85, 4), 78, 88)),
    ],
    make(teams.length * 4, () => clampT(rng.normal(78, 3), 70, 88)),
    make(teams.length * 7, () => clampT(rng.normal(71, 3), 63, 80)),
    make(teams.length * 2, () => clampT(rng.normal(66, 3), 58, 74)),
  ]

  // Snake draft within each tier, respecting positional needs.
  const rosters: Player[][] = teams.map(() => [])
  let round = 0
  for (const tier of tiers) {
    const pool = tier.sort((a, b) => ovr(b) - ovr(a))
    while (pool.length) {
      const order = round % 2 === 0 ? teams.map((_, i) => i) : teams.map((_, i) => teams.length - 1 - i)
      for (const ti of order) {
        if (!pool.length) break
        const roster = rosters[ti]
        const needs = unmetNeeds(roster)
        const needCount = needs.g + needs.f + needs.b
        const picksLeft = PER_TEAM - roster.length
        let idx = 0
        if (needCount > 0 && picksLeft <= needCount + 1) {
          const j = pool.findIndex((p) => fills(p, needs))
          if (j >= 0) idx = j
        } else {
          // Best available, nudged toward positions the roster is thin at (and away from ones it's stacked at).
          let bestV = -Infinity
          for (let j = 0; j < Math.min(pool.length, 10); j++) {
            const v = ovr(pool[j]) + positionNeed(roster, pool[j])
            if (v > bestV) { bestV = v; idx = j }
          }
        }
        roster.push(pool.splice(idx, 1)[0])
      }
      round++
    }
  }

  const players: Record<string, Player> = {}
  teams.forEach((team, ti) => {
    const used = new Set<number>()
    for (const p of rosters[ti]) {
      p.teamId = team.id
      while (used.has(p.jersey)) p.jersey = rng.int(0, 99)
      used.add(p.jersey)
      p.contract = { salary: salaryForPlayer(p), expires: season + rng.int(0, 4) }
    }
    const payroll = rosters[ti].reduce((s, p) => s + p.contract!.salary, 0)
    if (payroll > SALARY_CAP) {
      const k = SALARY_CAP / payroll
      for (const p of rosters[ti])
        p.contract!.salary = Math.max(MIN_SALARY, Math.floor((p.contract!.salary * k) / 100) * 100)
    }
    team.rotation = autoRotation(rosters[ti])
    for (const p of rosters[ti]) players[p.id] = p
  })

  for (let i = 0; i < FREE_AGENTS; i++) {
    let p: Player
    do p = generatePlayer(rng, { season, targetOvr: clampT(rng.normal(64, 2.5), 60, 68) })
    while (ovr(p) < 60 || ovr(p) > 68)
    players[p.id] = p
  }

  const coaches: League['coaches'] = {}
  for (let i = 0; i < teams.length + 8; i++) {
    const c = generateCoach(rng)
    if (i < teams.length) {
      c.teamId = teams[i].id
      teams[i].coachId = c.id
    }
    coaches[c.id] = c
  }

  const games = generateSchedule(teams, season, rng)

  return {
    version: 2,
    name: opts.name,
    seed: opts.seed,
    rng: { ...rng.state },
    season,
    phase: 'regular',
    day: 1,
    userTeamId: teams[opts.userTeamIndex].id,
    teams: Object.fromEntries(teams.map((t) => [t.id, t])),
    players,
    coaches,
    games,
    statLines: {},
    playoffs: null,
    progress: [],
  }
}
