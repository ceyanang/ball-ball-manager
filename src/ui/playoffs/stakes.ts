import type { Series } from '../../engine/types'

export type Stake = 'sweep' | 'elimination' | 'decider'

export const STAKE_LABEL: Record<Stake, string> = {
  sweep: 'sweep watch 🧹',
  elimination: 'elimination game',
  decider: 'winner takes all',
}

/** What the next game of an undecided series is worth, or null for an ordinary game. */
export function seriesStake(s: Series): Stake | null {
  const need = s.bestOf === 7 ? 4 : 3
  const hi = s.highWins
  const lo = s.lowWins
  if (hi === need - 1 && lo === need - 1) return 'decider'
  if (hi === need - 1 || lo === need - 1) return Math.min(hi, lo) === 0 ? 'sweep' : 'elimination'
  return null
}
