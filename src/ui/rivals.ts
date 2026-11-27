import { isRivalGame, rivalsOf, startingRivals } from '../engine/rivals/rivalry'
import type { League } from '../engine/types'

/** How `otherId` is a rival of `teamId`: a fixed starting rival, a heat-driven one, or not at all (either side listing the other counts). */
export function rivalLabel(l: League, teamId: string, otherId: string): 'starting' | 'dynamic' | null {
  if (startingRivals(teamId).includes(otherId) || startingRivals(otherId).includes(teamId)) return 'starting'
  return rivalsOf(l, teamId).includes(otherId) || rivalsOf(l, otherId).includes(teamId) ? 'dynamic' : null
}

/** Every team that counts as a rival of `teamId` (starting rivals first), including teams that list it themselves. */
export function allRivals(l: League, teamId: string): string[] {
  return Object.keys(l.teams)
    .filter((id) => id !== teamId && isRivalGame(l, { homeId: teamId, awayId: id }))
    .sort((a, b) => Number(rivalLabel(l, teamId, a) !== 'starting') - Number(rivalLabel(l, teamId, b) !== 'starting'))
}
