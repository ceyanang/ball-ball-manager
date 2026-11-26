import { RATING_GROUPS } from '../engine/player/ratings'
import type { Player, Position } from '../engine/types'
import { fullName, ovrOf } from './util'

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
export type PosFilter = Position | 'All'

export interface PlayerFilter {
  /** Team id, or 'All' for every rostered player. */
  team?: string
  pos?: PosFilter
  /** Case-insensitive substring of the player's full name. */
  q?: string
}

/** Rostered (non-free-agent, non-retired) players matching the filter, best OVR first. */
export function filterPlayers(players: Iterable<Player>, f: PlayerFilter): Player[] {
  const q = f.q?.trim().toLowerCase() ?? ''
  const out: Player[] = []
  for (const p of players) {
    if (!p.teamId || p.retired) continue
    if (f.team && f.team !== 'All' && p.teamId !== f.team) continue
    if (f.pos && f.pos !== 'All' && p.pos !== f.pos) continue
    if (q && !fullName(p).toLowerCase().includes(q)) continue
    out.push(p)
  }
  return out.sort((a, b) => ovrOf(b) - ovrOf(a))
}

export { RATING_GROUPS }
