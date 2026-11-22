import { ACTIVE_MAX, OT_MIN, STARTERS, TEAM_MINUTES } from '../constants'
import { computeOvr } from '../player/ratings'
import type { Player, Rotation, Team } from '../types'

const ovr = (p: Player) => computeOvr(p.ratings, p.pos)
const isGuard = (p: Player) => p.pos === 'PG' || p.pos === 'SG'
const isBig = (p: Player) => p.pos === 'PF' || p.pos === 'C'

/** Best 5 (with at least one guard and one big when available), next 7 bench, rest inactive. */
export function autoRotation(players: Player[]): Rotation {
  const sorted = [...players].sort((a, b) => ovr(b) - ovr(a))
  const starters = sorted.slice(0, STARTERS)
  const rest = sorted.slice(STARTERS)
  const ensure = (want: (p: Player) => boolean, keep: (p: Player) => boolean) => {
    if (starters.some(want)) return
    const j = rest.findIndex(want)
    if (j < 0) return
    let k = -1
    for (let i = starters.length - 1; i >= 0; i--) if (!keep(starters[i])) { k = i; break }
    if (k < 0) return
    const out = starters[k]
    starters[k] = rest[j]
    rest.splice(j, 1)
    rest.push(out)
    rest.sort((a, b) => ovr(b) - ovr(a))
  }
  ensure(isGuard, () => false)
  ensure(isBig, (p) => isGuard(p) && starters.filter(isGuard).length === 1)
  starters.sort((a, b) => ovr(b) - ovr(a))
  const ids = (ps: Player[]) => ps.map((p) => p.id)
  return { starters: ids(starters), bench: ids(rest.slice(0, ACTIVE_MAX - STARTERS)), inactive: ids(rest.slice(ACTIVE_MAX - STARTERS)) }
}

export function validateRotation(rot: Rotation, rosterIds: string[]): string[] {
  const problems: string[] = []
  if (rot.starters.length !== STARTERS) problems.push(`Pick exactly ${STARTERS} starters (you have ${rot.starters.length}).`)
  const active = rot.starters.length + rot.bench.length
  if (active > ACTIVE_MAX) problems.push(`Only ${ACTIVE_MAX} players can be active (you have ${active}). Move someone to inactive.`)
  const all = [...rot.starters, ...rot.bench, ...rot.inactive]
  if (new Set(all).size !== all.length) problems.push('A player is listed more than once.')
  const roster = new Set(rosterIds)
  if (all.some((id) => !roster.has(id))) problems.push('A listed player is not on this roster.')
  const listed = new Set(all)
  if (rosterIds.some((id) => !listed.has(id))) problems.push('Every rostered player must be a starter, on the bench, or inactive.')
  return problems
}

/** The game-day 12. Injured players sit unless fewer than 5 are healthy. */
export function gameLineup(team: Team, players: Record<string, Player>): { starters: string[]; bench: string[] } {
  const { starters, bench, inactive } = team.rotation
  const healthy = (id: string) => !players[id]?.injury
  const lineup = starters.filter(healthy)
  const reserves = [...bench, ...inactive].filter(healthy)
  while (lineup.length < STARTERS && reserves.length) lineup.push(reserves.shift()!)
  if (lineup.length < STARTERS) {
    const hurt = [...starters, ...bench, ...inactive]
      .filter((id) => players[id] && !healthy(id))
      .sort((a, b) => players[a].injury!.gamesRemaining - players[b].injury!.gamesRemaining)
    while (lineup.length < STARTERS && hurt.length) lineup.push(hurt.shift()!)
  }
  return { starters: lineup, bench: reserves.slice(0, ACTIVE_MAX - lineup.length) }
}

const STARTER_BASE = [35, 34, 33, 32, 31]
const BENCH_BASE = [22, 18, 14, 10, 4, 2, 0]

/** Target minutes per player; sums exactly to 240 + 25·OT and caps each player at 48 + 5·OT. */
export function minutesTargets(
  lineup: { starters: string[]; bench: string[] },
  players: Record<string, Player>,
  otPeriods: number,
): Record<string, number> {
  const total = TEAM_MINUTES + STARTERS * OT_MIN * otPeriods
  const cap = 48 + OT_MIN * otPeriods
  const raw: Record<string, number> = {}
  const stamina = (id: string) => 0.9 + 0.2 * ((players[id]?.ratings.stam ?? 50) / 99)
  lineup.starters.forEach((id, i) => (raw[id] = (STARTER_BASE[i] ?? 30) * stamina(id)))
  lineup.bench.forEach((id, i) => (raw[id] = (BENCH_BASE[i] ?? 0) * stamina(id)))
  const ids = Object.keys(raw)
  const capped = new Set<string>()
  const out: Record<string, number> = {}
  for (let iter = 0; iter < 10; iter++) {
    const free = ids.filter((id) => !capped.has(id))
    const left = total - capped.size * cap
    const sum = free.reduce((s, id) => s + raw[id], 0)
    for (const id of free) out[id] = sum > 0 ? (raw[id] * left) / sum : 0
    for (const id of capped) out[id] = cap
    const over = free.filter((id) => out[id] > cap)
    if (!over.length) break
    over.forEach((id) => capped.add(id))
  }
  return out
}
