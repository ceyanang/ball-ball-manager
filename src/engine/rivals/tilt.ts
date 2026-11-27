import type { League, Player } from '../types'

/** Completed seasons (before this one) each player has appeared for `teamId`, in one pass over the stat lines. */
export function tenureMap(l: League, teamId: string): Map<string, number> {
  const seen = new Map<string, Set<number>>()
  for (const s of Object.values(l.statLines)) {
    if (s.teamId !== teamId || s.playoffs || s.gp <= 0 || s.season >= l.season) continue
    let set = seen.get(s.playerId)
    if (!set) seen.set(s.playerId, (set = new Set()))
    set.add(s.season)
  }
  return new Map([...seen].map(([id, set]) => [id, set.size]))
}

/** Vets (3+ seasons with the team) burst in rival games (+1); rookies and new arrivals struggle (−1). A founding league has no tenure yet (0). */
export function tiltFor(l: League, p: Player, tenure: Map<string, number>): -1 | 0 | 1 {
  if (l.history.length === 0) return 0
  const n = tenure.get(p.id) ?? 0
  return n >= 3 ? 1 : n === 0 ? -1 : 0
}

export const rivalTilt = (l: League, p: Player, teamId: string): -1 | 0 | 1 => tiltFor(l, p, tenureMap(l, teamId))
