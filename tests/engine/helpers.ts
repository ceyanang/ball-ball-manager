export { committed, payroll } from '../../src/engine/gm/cap'
import type { League } from '../../src/engine/types'
/** Test helper: instantly make a player a free agent. */
export function releasePlayerNow(l: League, id: string): void {
  const p = l.players[id]
  p.teamId = null
  p.contract = null
}
