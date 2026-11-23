import type { Player, Team } from '../../engine/types'
import type { RecapRow } from './QuarterBreak'
import { benchLine, type ReplayState } from './replay'

/**
 * Recap rows for one side: the starters (by role, even while sitting), then one bench row totalling every non-starter
 * whose children list each of them, whether or not he is on the floor right now.
 */
export function recapRows(
  rs: ReplayState,
  side: { starters: string[]; bench: string[] },
  team: Team,
  players: Record<string, Player>,
  favs: Set<string>,
): RecapRow[] {
  const row = (id: string): RecapRow => ({
    key: id, name: players[id]?.lastName ?? '?', playerId: id, team, fav: favs.has(id), line: benchLine(rs, [id]),
  })
  return [
    ...side.starters.map(row),
    { key: `bench-${team.id}`, name: `${team.abbrev} bench`, playerId: null, team, fav: false, line: benchLine(rs, side.bench), children: side.bench.map(row) },
  ]
}
