import type { WatchCapture } from '../engine/season/advance'
import type { League } from '../engine/types'

export type SimCommand =
  | { type: 'simDays'; days: number }
  | { type: 'simUntil'; target: 'regularEnd' | 'playoffsEnd' | 'deadline' | 'seriesEnd' | 'event' }
  | { type: 'watchDay' }
  | { type: 'offseason' }
  | { type: 'faDays'; days: number }
export interface SimRequest { id: number; cmd: SimCommand; league: League }
export type SimResponse = { id: number; league: League; watch?: WatchCapture | null } | { id: number; error: string }

/**
 * Only the step-by-step sims roll pop-up events: one day, "sim to next event" and watching a game. Sim week, sim to
 * the deadline / end of season / end of playoffs / end of series fly straight through without any.
 */
export const simRollsEvents = (cmd: SimCommand): boolean =>
  cmd.type === 'watchDay' || (cmd.type === 'simDays' && cmd.days <= 1) || (cmd.type === 'simUntil' && cmd.target === 'event')
