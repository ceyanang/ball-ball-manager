import type { WatchCapture } from '../engine/season/advance'
import type { MomentAnswer, MomentPrompt } from '../engine/sim/moments'
import type { League } from '../engine/types'

export type SimCommand =
  | { type: 'simDays'; days: number }
  | { type: 'simUntil'; target: 'regularEnd' | 'playoffsEnd' | 'deadline' | 'seriesEnd' | 'event' }
  | { type: 'watchDay' }
  | { type: 'offseason' }
  | { type: 'faDays'; days: number }
  /** MyCareer: one day. `play` stops at each moment; `careerAnswer` locks one in and re-runs the day. */
  | { type: 'careerDay'; mode: 'play' | 'sim' }
  | { type: 'careerAnswer'; answer: MomentAnswer }
  /** MyCareer: runs the whole offseason (stops if he owes a contract decision). */
  | { type: 'careerOffseason' }
export interface SimRequest { id: number; cmd: SimCommand; league: League }
export type SimResponse = { id: number; league: League; watch?: WatchCapture | null; moment?: MomentPrompt | null } | { id: number; error: string }

/**
 * Only the step-by-step sims roll pop-up events: one day, "sim to next event" and watching a game. Sim week, sim to
 * the deadline / end of season / end of playoffs / end of series fly straight through without any.
 */
export const simRollsEvents = (cmd: SimCommand): boolean =>
  cmd.type === 'watchDay' || cmd.type === 'careerDay' || cmd.type === 'careerAnswer' || (cmd.type === 'simDays' && cmd.days <= 1) || (cmd.type === 'simUntil' && cmd.target === 'event')
