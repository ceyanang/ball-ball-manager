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
