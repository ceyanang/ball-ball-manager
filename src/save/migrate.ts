import { createPicks } from '../engine/gm/draft'
import { allStarDayFor } from '../engine/allstar/allstar'
import { tradeDeadline } from '../engine/schedule/schedule'
import type { League } from '../engine/types'
import { SaveImportError } from './errors'
import { backfillRecords } from '../engine/stories/records'
import { emptyStories } from '../engine/stories/state'
import { backfillJerseys } from '../engine/stories/jerseys'
import { recomputeFanBase } from '../engine/stories/sentiment'
import { emptyEvents } from '../engine/events/state'

export const CURRENT_VERSION = 10

/**
 * Upgrades an older save to the current shape.
 * v1 → v2 adds in-season progress events. v2 → v3 adds the GM layer (picks, draft, waivers, free agency, offseason).
 * v3 → v4 adds stories (news, social, inbox, awards, history, records, Hall of Fame, fan sentiment).
 * v4 → v5 adds the user's favorite players. v5 → v6 adds All-Star Weekend and development slots.
 * v6 → v7 adds minutes plans and auto-rotation to depth charts (both optional, so nothing to fill in).
 * v7 → v8 adds random events and team chemistry. v8 → v9 adds long-term fan base. v9 → v10 adds retired jerseys.
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
  if (raw?.version === 3) {
    raw = { ...raw, version: 4, ...emptyStories() }
    // Only a structurally sound save can be scanned; parseImport reports anything broken afterwards.
    if (Array.isArray(raw.games) && raw.statLines && typeof raw.statLines === 'object' && raw.players && typeof raw.players === 'object')
      backfillRecords(raw as League)
  }
  if (raw?.version === 4) raw = { ...raw, version: 5, favoritePlayerIds: [] }
  if (raw?.version === 5) {
    // A save already past the break just never had its weekend; otherwise the break lands at mid-season.
    const games = Array.isArray(raw.games) ? raw.games.filter((g: { season?: number }) => g?.season === raw.season) : []
    raw = { ...raw, version: 6, allStarDay: raw.phase === 'regular' && games.length ? allStarDayFor(games, raw.season) : 0, allStars: [], training: [] }
  }
  if (raw?.version === 6) raw = { ...raw, version: 7 }
  if (raw?.version === 7) raw = { ...raw, version: 8, events: emptyEvents(), chemistry: Object.fromEntries(Object.keys(raw.teams ?? {}).map((id) => [id, 50])) }
  if (raw?.version === 8) {
    raw = { ...raw, version: 9, fans: { players: {}, teams: {}, ...raw.fans, base: {} } }
    if (raw.statLines && typeof raw.statLines === 'object' && raw.players && typeof raw.players === 'object' && Array.isArray(raw.awards) && Array.isArray(raw.allStars))
      recomputeFanBase(raw as League)
  }
  if (raw?.version === 9) {
    raw = { ...raw, version: 10, retiredJerseys: [] }
    if (raw.statLines && typeof raw.statLines === 'object' && raw.players && typeof raw.players === 'object' && raw.teams && typeof raw.teams === 'object' && Array.isArray(raw.awards))
      backfillJerseys(raw as League)
  }
  if (raw?.version !== CURRENT_VERSION)
    throw new SaveImportError(`This save is version ${String(raw?.version)}, but this app reads versions 1–${CURRENT_VERSION}.`)
  if (!Array.isArray(raw.favoritePlayerIds)) raw = { ...raw, favoritePlayerIds: [] }
  if (!Array.isArray(raw.progress)) raw = { ...raw, progress: [] }
  return raw as League
}
