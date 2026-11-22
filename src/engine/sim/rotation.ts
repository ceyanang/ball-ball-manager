import { ACTIVE_MAX, OT_MIN, STARTERS, TEAM_MINUTES } from '../constants'
import { computeOvr } from '../player/ratings'
import type { Player, Position, Rotation, Team } from '../types'

const ovr = (p: Player) => computeOvr(p.ratings, p.pos)

/** Starting-five slot order: starters[i] plays SLOTS[i]. */
export const SLOTS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const SLOT_IDX: Record<Position, number> = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 }
/** OVR cost of playing 0..4 spots away from a player's natural position. Adjacent spots are cheap. */
const OFF_POS_PENALTY = [0, 2.5, 8, 16, 26]

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
