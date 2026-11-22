import { createPicks } from '../engine/gm/draft'
import { tradeDeadline } from '../engine/schedule/schedule'
import type { League } from '../engine/types'
import { SaveImportError } from './errors'

export const CURRENT_VERSION = 3

/**
 * Upgrades an older save to the current shape.
 * v1 → v2 adds in-season progress events. v2 → v3 adds the GM layer (picks, draft, waivers, free agency, offseason).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateLeague(raw: any): League {
  if (raw?.version === 1) raw = { ...raw, version: 2, progress: [] }
  if (raw?.version === 2) {
    const teams = raw.teams && typeof raw.teams === 'object' ? Object.values(raw.teams) : []
    const games = Array.isArray(raw.games) ? raw.games.filter((g: { season?: number }) => g?.season === raw.season) : []
    raw = {
      ...raw,
      version: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      picks: createPicks(teams as any, [raw.season, raw.season + 1]),
      draft: null,
      draftRights: {},
      transactions: [],
      deadMoney: [],
      waivers: [],
      faOffers: [],
      offseason: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tradeDeadlineDay: games.length ? tradeDeadline(games, teams as any) : 0,
    }
  }
  if (raw?.version !== CURRENT_VERSION)
    throw new SaveImportError(`This save is version ${String(raw?.version)}, but this app reads versions 1–${CURRENT_VERSION}.`)
  if (!Array.isArray(raw.progress)) raw = { ...raw, progress: [] }
  return raw as League
}
