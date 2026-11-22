import type { League } from '../engine/types'

export type SimCommand = { type: 'simDays'; days: number } | { type: 'simUntil'; target: 'regularEnd' | 'playoffsEnd' | 'deadline' }
export interface SimRequest { id: number; cmd: SimCommand; league: League }
export type SimResponse = { id: number; league: League } | { id: number; error: string }
