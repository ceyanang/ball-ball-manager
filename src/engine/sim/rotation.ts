import { ACTIVE_MAX, OT_MIN, STARTERS, TEAM_MINUTES } from '../constants'
import { computeOvr } from '../player/ratings'
import type { Player, Position, Rotation, Team } from '../types'

const ovr = (p: Player) => computeOvr(p.ratings, p.pos)

/** Starting-five slot order: starters[i] plays SLOTS[i]. */
export const SLOTS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
export const SLOT_IDX: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 }
/** OVR cost of playing 0..4 spots away from a player's natural position. Adjacent spots are cheap. */
export const OFF_POS_PENALTY = [0, 2.5, 8, 16, 26]

/** How good `p` is when playing `slot`: their OVR re-weighted for that spot, minus an out-of-position cost. */
export function slotFit(p: Player, slot: Position): number {
  return computeOvr(p.ratings, slot) - OFF_POS_PENALTY[Math.abs(SLOT_IDX[p.pos] - SLOT_IDX[slot])]
}

/**
 * Best PG/SG/SF/PF/C assignment (max total slot fit) from the top candidates. Returns players in slot order,
 * so a much better SG can start at PG, or two great bigs can share the frontcourt.
 */
export function bestStartingFive(players: Player[]): Player[] {
  const cands = [...players].sort((a, b) => ovr(b) - ovr(a)).slice(0, 12)
  if (cands.length <= STARTERS) return cands
  const n = cands.length
  const fit = cands.map((p) => SLOTS.map((s) => slotFit(p, s)))
  const best = new Map<number, { v: number; prev: number; pick: number }>([[0, { v: 0, prev: -1, pick: -1 }]])
  let layer = [0]
  for (let slot = 0; slot < STARTERS; slot++) {
    const next: number[] = []
    for (const mask of layer) {
      const base = best.get(mask)!.v
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) continue
        const m = mask | (1 << j)
        const v = base + fit[j][slot]
        const cur = best.get(m)
        if (!cur) next.push(m)
        if (!cur || v > cur.v) best.set(m, { v, prev: mask, pick: j })
      }
    }
    layer = next
  }
  let top = layer[0]
  for (const m of layer) if (best.get(m)!.v > best.get(top)!.v) top = m
  const out: Player[] = []
  for (let m = top; m; m = best.get(m)!.prev) out.unshift(cands[best.get(m)!.pick])
  return out
}

/** Best five by slot (PG, SG, SF, PF, C), the next 7 on the bench, the rest inactive. */
export function autoRotation(players: Player[]): Rotation {
  const starters = bestStartingFive(players)
  const rest = players.filter((p) => !starters.includes(p)).sort((a, b) => ovr(b) - ovr(a))
  const active = rest.slice(0, ACTIVE_MAX - STARTERS)
  // Keep at least one backup guard and one backup big dressed when possible.
  const isGuard = (p: Player) => p.pos === 'PG' || p.pos === 'SG'
  const isBig = (p: Player) => p.pos === 'PF' || p.pos === 'C'
  for (const want of [isGuard, isBig]) {
    if (active.some(want)) continue
    const j = rest.findIndex((p, i) => i >= active.length && want(p))
    if (j >= 0 && active.length) active[active.length - 1] = rest[j]
  }
  const ids = (ps: Player[]) => ps.map((p) => p.id)
  return { starters: ids(starters), bench: ids(active), inactive: ids(rest.filter((p) => !active.includes(p))) }
}

/**
 * The coach's optimal depth chart for tonight (the "let the coach handle it" setting): best lineup from the healthy
 * players, the hurt parked inactive (unless that would leave too few to play), and no minutes plan, so the sim uses
 * the coach's suggested minutes.
 */
export function coachRotation(roster: Player[]): Rotation {
  const healthy = roster.filter((p) => !p.injury)
  if (healthy.length < STARTERS + 3) return { ...autoRotation(roster), auto: true }
  const rot = autoRotation(healthy)
  return { ...rot, inactive: [...rot.inactive, ...roster.filter((p) => p.injury).map((p) => p.id)], auto: true }
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
  problems.push(...validateMinutes(rot))
  return problems
}

/** Minutes a player can be planned for, and the total a minutes plan must hit. */
export const MAX_PLAN_MIN = 48
/** A minutes plan (if any) covers the active players, 0–48 each, summing to exactly 240. */
export function validateMinutes(rot: Rotation): string[] {
  if (!rot.minutes) return []
  const active = [...rot.starters, ...rot.bench]
  const vals = active.map((id) => rot.minutes![id] ?? 0)
  if (vals.some((m) => !Number.isFinite(m) || m < 0 || m > MAX_PLAN_MIN)) return [`Each player plays 0–${MAX_PLAN_MIN} minutes.`]
  const left = TEAM_MINUTES - Math.round(vals.reduce((a, b) => a + b, 0))
  if (left > 0) return [`Hand out ${left} more minute${left === 1 ? '' : 's'} (the plan must total ${TEAM_MINUTES}).`]
  if (left < 0) return [`Cut ${-left} minute${left === -1 ? '' : 's'} (the plan must total ${TEAM_MINUTES}).`]
  return []
}

/** Rounds minute shares to whole minutes that still sum exactly to `total` (largest remainders get the extra). */
function roundTo(raw: Record<string, number>, total: number): Record<string, number> {
  const ids = Object.keys(raw)
  const out: Record<string, number> = {}
  for (const id of ids) out[id] = Math.floor(raw[id])
  let left = total - ids.reduce((s, id) => s + out[id], 0)
  const byRem = [...ids].sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])) || ids.indexOf(a) - ids.indexOf(b))
  for (let k = 0; left > 0 && byRem.length; k = (k + 1) % byRem.length, left--) out[byRem[k]]++
  return out
}

/** The coach's suggested whole-minute plan for a depth chart (healthy or not): what the sim uses with no plan set. */
export function suggestedMinutes(rot: Rotation, players: Record<string, Player>): Record<string, number> {
  return roundTo(minutesTargets({ starters: rot.starters, bench: rot.bench }, players, 0), TEAM_MINUTES)
}

/**
 * Comfortable minutes for a player before fatigue really bites, from his stamina rating
 * (≈ 30 for a 40-stamina big, ≈ 40 for a 90-stamina iron man).
 */
export const comfortMinutes = (p: Player): number => Math.round(22 + 20 * (p.ratings.stam / 99))

/**
 * The game-day 12. Injured players sit unless fewer than 5 are healthy; an injured starter's slot goes to the
 * healthy bench player who fits that position best (inactive players only if the bench runs dry).
 */
export function gameLineup(team: Team, players: Record<string, Player>): { starters: string[]; bench: string[] } {
  const { starters, bench, inactive } = team.rotation
  const healthy = (id: string) => !!players[id] && !players[id].injury
  const benchPool = bench.filter(healthy)
  const deepPool = inactive.filter(healthy)
  const lineup: (string | null)[] = starters.map((id) => (healthy(id) ? id : null))
  lineup.forEach((id, i) => {
    if (id) return
    const pool = benchPool.length ? benchPool : deepPool
    if (!pool.length) return
    const slot = SLOTS[i] ?? 'SF'
    let k = 0
    pool.forEach((c, j) => { if (slotFit(players[c], slot) > slotFit(players[pool[k]], slot)) k = j })
    lineup[i] = pool.splice(k, 1)[0]
  })
  const filled = lineup.filter((id): id is string => !!id)
  if (filled.length < STARTERS) {
    const hurt = [...starters, ...bench, ...inactive]
      .filter((id) => players[id] && !healthy(id) && !filled.includes(id))
      .sort((a, b) => players[a].injury!.gamesRemaining - players[b].injury!.gamesRemaining)
    while (filled.length < STARTERS && hurt.length) filled.push(hurt.shift()!)
  }
  const reserves = [...benchPool, ...deepPool]
  return { starters: filled, bench: reserves.slice(0, ACTIVE_MAX - filled.length) }
}

const STARTER_BASE = [35, 34, 33, 32, 31]
const BENCH_BASE = [22, 18, 14, 10, 4, 2, 0]

/**
 * Target minutes per player; sums exactly to 240 + 25·OT and caps each player at 48 + 5·OT. A `plan` (the GM's
 * minutes) replaces the default shares for the players it covers; anyone it misses (an injury fill-in) gets the
 * default for his spot, and the whole thing is rescaled so the team still plays exactly its minutes.
 */
export function minutesTargets(
  lineup: { starters: string[]; bench: string[] },
  players: Record<string, Player>,
  otPeriods: number,
  plan?: Record<string, number>,
): Record<string, number> {
  const total = TEAM_MINUTES + STARTERS * OT_MIN * otPeriods
  const cap = 48 + OT_MIN * otPeriods
  const raw: Record<string, number> = {}
  const stamina = (id: string) => 0.9 + 0.2 * ((players[id]?.ratings.stam ?? 50) / 99)
  lineup.starters.forEach((id, i) => (raw[id] = (STARTER_BASE[i] ?? 30) * stamina(id)))
  lineup.bench.forEach((id, i) => (raw[id] = (BENCH_BASE[i] ?? 0) * stamina(id)))
  if (plan) for (const id of Object.keys(raw)) if (plan[id] !== undefined) raw[id] = Math.max(0, plan[id])
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

const PERMS: number[][] = (() => {
  const out: number[][] = []
  const rec = (cur: number[], left: number[]) => {
    if (!left.length) return void out.push(cur)
    left.forEach((x, i) => rec([...cur, x], [...left.slice(0, i), ...left.slice(i + 1)]))
  }
  rec([], [0, 1, 2, 3, 4])
  return out
})()

/**
 * Out-of-position cost (OVR points) for each player on the floor. `slotted` players are pinned to SLOTS order
 * (the starting five as the coach set it); otherwise the coach assigns positions to minimise the total cost.
 */
export function courtPenalties(ids: string[], players: Record<string, Player>, slotted: boolean): Record<string, number> {
  const out: Record<string, number> = {}
  const nat = ids.map((id) => SLOT_IDX[players[id].pos])
  const cost = (i: number, slot: number) => OFF_POS_PENALTY[Math.abs(nat[i] - slot)]
  if (slotted || ids.length !== STARTERS) {
    ids.forEach((id, i) => (out[id] = cost(i, Math.min(i, 4))))
    return out
  }
  let best = PERMS[0], bestV = Infinity
  for (const perm of PERMS) {
    let v = 0
    for (let i = 0; i < 5; i++) v += cost(i, perm[i])
    if (v < bestV) { bestV = v; best = perm }
  }
  ids.forEach((id, i) => (out[id] = cost(i, best[i])))
  return out
}

/**
 * Out-of-position costs for whoever is on the floor. While all five starters are out there the coach's set positions
 * (the starters' order) apply; any other group is re-slotted by the coach to minimise the total cost.
 */
export function lineupPenalties(onCourt: string[], starters: string[], players: Record<string, Player>): Record<string, number> {
  const same = onCourt.length === STARTERS && starters.length === STARTERS && starters.every((id) => onCourt.includes(id))
  return same ? courtPenalties(starters, players, true) : courtPenalties(onCourt, players, false)
}
