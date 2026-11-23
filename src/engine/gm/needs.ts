import type { League, Position } from '../types'
import { committed, ovr } from './cap'

export type NeedLevel = 'green' | 'yellow' | 'red'
export interface Slot { id?: string; pos: Position; ovr: number }
export interface NeedThresholds { excellent: number; good: number; solid: number }

export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const ADJ_PENALTY = 6

/** "Excellent / good / solid" are relative to the league: the 80th / 55th / 45th percentile of rostered OVR. */
export function needThresholds(l: League): NeedThresholds {
  const all = Object.values(l.players).filter((p) => p.teamId && !p.retired).map(ovr).sort((a, b) => a - b)
  const at = (q: number) => all[Math.min(all.length - 1, Math.floor(all.length * q))] ?? 60
  return { excellent: at(0.8), good: at(0.55), solid: at(0.45) }
}

export function needLevels(slots: Slot[], th: NeedThresholds): Record<Position, NeedLevel> {
  const out = {} as Record<Position, NeedLevel>
  POSITIONS.forEach((pos, i) => {
    const same = slots.filter((s) => s.pos === pos).map((s) => s.ovr).sort((a, b) => b - a)
    if (!same.length) { out[pos] = 'red'; return }
    const starter = same[0]
    const backup = same[1]
    const adj = slots.filter((s) => s.pos === POSITIONS[i - 1] || s.pos === POSITIONS[i + 1]).map((s) => s.ovr - ADJ_PENALTY)
    const adjCover = adj.length > 0 && Math.max(...adj) >= th.solid
    const excellent = starter >= th.excellent
    const good = starter >= th.good
    if (excellent && backup !== undefined && backup >= th.solid) out[pos] = 'green'
    else if (excellent) out[pos] = 'yellow'
    else if (good && (backup !== undefined || adjCover)) out[pos] = 'yellow'
    else out[pos] = 'red'
  })
  return out
}

export const slotsOf = (l: League, teamId: string): Slot[] => committed(l, teamId).map((p) => ({ id: p.id, pos: p.pos, ovr: ovr(p) }))

/** Position needs for a team, optionally after hypothetically adding slots and/or removing players by id. */
export function teamNeeds(l: League, teamId: string, ch: { add?: Slot[]; removeIds?: string[] } = {}, th: NeedThresholds = needThresholds(l)): Record<Position, NeedLevel> {
  const rm = new Set(ch.removeIds ?? [])
  const slots = slotsOf(l, teamId).filter((s) => !rm.has(s.id!)).concat(ch.add ?? [])
  return needLevels(slots, th)
}

export const needRank: Record<NeedLevel, number> = { red: 0, yellow: 1, green: 2 }

/** The position this team most needs help at (lowest need rank; ties go to the earlier position). */
export function neediestPosition(l: League, teamId: string): Position {
  const needs = teamNeeds(l, teamId)
  return POSITIONS.reduce((best, p) => (needRank[needs[p]] < needRank[needs[best]] ? p : best), POSITIONS[0])
}
