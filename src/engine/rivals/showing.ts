import { ovr } from '../gm/cap'
import { breakoutBump } from '../gm/training'
import type { Rng } from '../rng'
import { expectedGameScore, gameScore } from '../stories/sentiment'
import { onBreakout } from '../stories/hooks'
import type { Game, League } from '../types'
import { RIVAL, isRivalGame } from './rivalry'
import { tenureMap, tiltFor } from './tilt'

/** After a rival game: a new player who beat what his rating promises has made a "showing". */
export function recordRivalShowing(l: League, g: Game): void {
  if (!g.result || !isRivalGame(l, g)) return
  const tenure = new Map([g.homeId, g.awayId].map((id) => [id, tenureMap(l, id)]))
  for (const b of g.result.box) {
    const p = l.players[b.playerId]
    if (b.min < 6 || !p) continue
    if (tiltFor(l, p, tenure.get(b.teamId)!) !== -1) continue
    if (gameScore(b) > expectedGameScore(ovr(p), b.min)) l.rivalry.showing[p.id] = (l.rivalry.showing[p.id] ?? 0) + 1
  }
}

/** Offseason: new guys who stepped up in rival games get a small chance at a higher ceiling. The tally resets. */
export function applyRivalBumps(l: League, rng: Rng): void {
  for (const [id, n] of Object.entries(l.rivalry.showing)) {
    const p = l.players[id]
    if (!p || p.retired || p.careerBuild || n < RIVAL.showingMin || p.pot >= 99) continue
    if (!rng.chance(Math.min(RIVAL.bumpChanceCap, RIVAL.bumpChancePerShowing * n))) continue
    const potFrom = p.pot
    p.pot = Math.min(99, p.pot + breakoutBump(p, rng))
    onBreakout(l, p, potFrom, 'rival')
  }
  l.rivalry.showing = {}
}
