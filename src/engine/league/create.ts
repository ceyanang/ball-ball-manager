import { generateCoach } from '../coach/generate'
import { MIN_SALARY, SALARY_CAP } from '../constants'
import { salaryForPlayer } from '../contracts'
import { PARODY_TEAMS } from '../data/teams'
import { generatePlayer } from '../player/generate'
import { computeOvr } from '../player/ratings'
import { Rng } from '../rng'
import { generateSchedule } from '../schedule/schedule'
import type { League, Player, Rotation, Team } from '../types'

const PER_TEAM = 14
const FREE_AGENTS = 25
const STARS = 6

const isG = (p: Player) => p.pos === 'PG' || p.pos === 'SG'
const isF = (p: Player) => p.pos === 'SF' || p.pos === 'PF'
const isB = (p: Player) => p.pos === 'PF' || p.pos === 'C'
const ovr = (p: Player) => computeOvr(p.ratings, p.pos)

function unmetNeeds(roster: Player[]) {
  const g = roster.filter(isG).length, f = roster.filter(isF).length, b = roster.filter(isB).length
  return { g: Math.max(0, 2 - g), f: Math.max(0, 2 - f), b: Math.max(0, 2 - b) }
}
const fills = (p: Player, n: { g: number; f: number; b: number }) => (n.g > 0 && isG(p)) || (n.f > 0 && isF(p)) || (n.b > 0 && isB(p))

// Temporary: Task 6 replaces this with autoRotation.
function simpleRotation(players: Player[]): Rotation {
  const ids = [...players].sort((a, b) => ovr(b) - ovr(a)).map((p) => p.id)
  return { starters: ids.slice(0, 5), bench: ids.slice(5, 12), inactive: ids.slice(12) }
}

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

  // Player pool: default-distribution players plus a handful of stars.
  const pool: Player[] = []
  for (let i = 0; i < teams.length * PER_TEAM - STARS; i++) pool.push(generatePlayer(rng, { season }))
  for (let i = 0; i < STARS; i++)
    pool.push(generatePlayer(rng, { season, targetOvr: Math.min(95, Math.round(rng.normal(86, 3))) }))
  pool.sort((a, b) => ovr(b) - ovr(a))

  // Snake draft with positional needs.
  const rosters: Player[][] = teams.map(() => [])
  for (let round = 0; round < PER_TEAM; round++) {
    const order = round % 2 === 0 ? teams.map((_, i) => i) : teams.map((_, i) => teams.length - 1 - i)
    for (const ti of order) {
      const roster = rosters[ti]
      const needs = unmetNeeds(roster)
      const needCount = needs.g + needs.f + needs.b
      const picksLeft = PER_TEAM - roster.length
      let idx = 0
      if (needCount > 0 && picksLeft <= needCount + 1) {
        const j = pool.findIndex((p) => fills(p, needs))
        if (j >= 0) idx = j
      }
      roster.push(pool.splice(idx, 1)[0])
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
    team.rotation = simpleRotation(rosters[ti])
    for (const p of rosters[ti]) players[p.id] = p
  })

  for (let i = 0; i < FREE_AGENTS; i++) {
    const p = generatePlayer(rng, { season, targetOvr: Math.max(40, Math.round(rng.normal(52, 6))) })
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
    version: 1,
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
  }
}
