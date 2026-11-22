import type { League } from '../types'

/**
 * Per-league memo for expensive derived data (standings, form, team strength). Entries are keyed by a stamp
 * that changes whenever the inputs can change, so a stale value is never served. Leagues are cloned for every
 * sim and action, so the WeakMap never outlives the object it describes.
 */
const caches = new WeakMap<League, Map<string, { stamp: string; v: unknown }>>()

export function memo<T>(l: League, key: string, stamp: string, fn: () => T): T {
  let m = caches.get(l)
  if (!m) caches.set(l, (m = new Map()))
  const hit = m.get(key)
  if (hit && hit.stamp === stamp) return hit.v as T
  const v = fn()
  m.set(key, { stamp, v })
  return v
}

/** Changes whenever a game result can have been added. */
export const resultsStamp = (l: League) => `${l.season}|${l.phase}|${l.day}|${l.games.length}|${l.playoffs?.series.length ?? 0}`
/** Also changes on every roster move (each one is logged). */
export const rosterStamp = (l: League) => `${resultsStamp(l)}|${l.transactions.length}|${l.offseason?.step ?? ''}`
