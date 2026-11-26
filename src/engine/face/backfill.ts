import { heritageOfName } from '../data/names'
import { encodeHeritage } from './heritage'

/** Re-tags every person's faceSeed with the heritage their name implies. Defensive: works on raw save data. */
export function backfillHeritage(l: { players?: unknown; coaches?: unknown }): void {
  for (const group of [l.players, l.coaches]) {
    if (!group || typeof group !== 'object') continue
    for (const p of Object.values(group as Record<string, unknown>)) {
      if (!p || typeof p !== 'object') continue
      const o = p as { firstName?: unknown; lastName?: unknown; faceSeed?: unknown }
      if (typeof o.faceSeed !== 'number' || typeof o.firstName !== 'string' || typeof o.lastName !== 'string') continue
      o.faceSeed = encodeHeritage(o.faceSeed, heritageOfName(o.firstName, o.lastName))
    }
  }
}
