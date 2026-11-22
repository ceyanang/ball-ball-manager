import type { Rotation } from '../engine/types'

export type Section = keyof Rotation

/**
 * Moves a player within a rotation. Moves into or out of the starting five swap with the player in the
 * target slot (so there are always 5 starters when possible); other moves remove and insert.
 */
export function moveInRotation(rot: Rotation, playerId: string, to: { section: Section; index: number }): Rotation {
  const next: Rotation = { starters: [...rot.starters], bench: [...rot.bench], inactive: [...rot.inactive] }
  const from = (Object.keys(next) as Section[]).find((s) => next[s].includes(playerId))
  if (!from) return rot
  const fromIdx = next[from].indexOf(playerId)
  const swap = from !== to.section && (from === 'starters' || to.section === 'starters') && to.index < next[to.section].length
  if (swap) {
    const other = next[to.section][to.index]
    next[to.section][to.index] = playerId
    next[from][fromIdx] = other
    return next
  }
  next[from].splice(fromIdx, 1)
  next[to.section].splice(Math.min(to.index, next[to.section].length), 0, playerId)
  return next
}
