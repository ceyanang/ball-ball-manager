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

export type DropTarget = { section: Section; index: number } | { section: Section; append: true }

/**
 * Drag-and-drop semantics: dropping on another section's player swaps the two; dropping on a player in the same
 * section moves into that spot (others shift); dropping on a section's open space moves to its end.
 */
export function dropInRotation(rot: Rotation, playerId: string, target: DropTarget): Rotation {
  const next: Rotation = { starters: [...rot.starters], bench: [...rot.bench], inactive: [...rot.inactive] }
  const from = (Object.keys(next) as Section[]).find((s) => next[s].includes(playerId))
  if (!from) return rot
  const fromIdx = next[from].indexOf(playerId)
  const list = next[target.section]
  if ('append' in target) {
    if (from === 'starters' && target.section !== 'starters') return rot // keep the starting five full: swap instead
    next[from].splice(fromIdx, 1)
    next[target.section].push(playerId)
    return next
  }
  if (target.index >= list.length) return dropInRotation(rot, playerId, { section: target.section, append: true })
  if (from !== target.section) {
    const other = list[target.index]
    list[target.index] = playerId
    next[from][fromIdx] = other
    return next
  }
  if (from === 'starters') {
    // Starters are position slots, so a same-section drop swaps slots rather than shifting everyone.
    ;[list[fromIdx], list[target.index]] = [list[target.index], list[fromIdx]]
    return next
  }
  list.splice(fromIdx, 1)
  list.splice(target.index, 0, playerId)
  return next
}
