import type { League } from '../engine/types'
import { SaveImportError } from './errors'

export const CURRENT_VERSION = 2

/** Upgrades an older save to the current shape. v1 → v2 adds in-season progress events. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateLeague(raw: any): League {
  if (raw?.version === 1) raw = { ...raw, version: 2, progress: [] }
  if (raw?.version !== CURRENT_VERSION)
    throw new SaveImportError(`This save is version ${String(raw?.version)}, but this app reads versions 1–${CURRENT_VERSION}.`)
  if (!Array.isArray(raw.progress)) raw = { ...raw, progress: [] }
  return raw as League
}
