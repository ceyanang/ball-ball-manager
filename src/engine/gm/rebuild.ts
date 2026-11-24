import type { League } from '../types'
import { GmError, committed } from './cap'
import { type Asset, executeTrade, findOffers } from './trade'
import { playerValue } from './value'

/** Players this age or older are up for sale; younger ones are the core you keep. */
export const REBUILD_SELL_AGE = 26
/** Youngsters coming back must be this age or younger. */
export const REBUILD_YOUTH_AGE = 24
/** At most this many sell-off trades per rebuild. */
export const REBUILD_MAX_DEALS = 8

export interface RebuildDeal { teamId: string; gave: Asset[]; got: Asset[] }

/** Why the emergency rebuild can't run right now, or null if it can. */
export function rebuildProblem(l: League): string | null {
  if (l.phase !== 'offseason' || !l.offseason) return 'The emergency rebuild is only open in the offseason.'
  if (l.offseason.rebuilt) return 'You already blew it up this offseason.'
  return null
}

/** Vets the rebuild would shop, most valuable to a contender first. */
export function rebuildCandidates(l: League, teamId = l.userTeamId, keep: readonly string[] = []) {
  return committed(l, teamId)
    .filter((p) => p.age >= REBUILD_SELL_AGE && !keep.includes(p.id))
    .sort((a, b) => playerValue(l, b, 'contend') - playerValue(l, a, 'contend'))
}

/**
 * Emergency rebuild for the user's team: shops every vet (26+), best first, and takes the best
 * package of youngsters (24 and under) and draft picks a CPU team will pay, judged the way a
 * rebuilding team would. A vet is only sold if the return is worth at least as much to a rebuilder
 * as he is. `keep` lists franchise icons who are never shopped (and auto-sign keeps them afterwards).
 * Usable once per offseason; deterministic (no randomness). Mutates `l`.
 */
export function emergencyRebuild(l: League, keep: readonly string[] = []): RebuildDeal[] {
  const problem = rebuildProblem(l)
  if (problem) throw new GmError(problem)
  const me = l.userTeamId
  const young = (a: Asset) => a.kind === 'pick' || l.players[a.id].age <= REBUILD_YOUTH_AGE
  const deals: RebuildDeal[] = []
  for (const p of rebuildCandidates(l, me, keep)) {
    if (deals.length >= REBUILD_MAX_DEALS) break
    if (p.teamId !== me) continue
    const offered: Asset[] = [{ kind: 'player', id: p.id }]
    const best = findOffers(l, me, offered, { want: young, mode: 'rebuild' })[0]
    if (!best || best.value < Math.max(1, playerValue(l, p, 'rebuild'))) continue
    executeTrade(l, { a: me, b: best.teamId, aGives: offered, bGives: best.gives })
    deals.push({ teamId: best.teamId, gave: offered, got: best.gives })
  }
  l.offseason!.rebuilt = true
  if (keep.length) l.offseason!.rebuildKept = [...keep]
  return deals
}
