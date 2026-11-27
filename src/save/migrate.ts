import { createPicks } from '../engine/gm/draft'
import { allStarDayFor } from '../engine/allstar/allstar'
import { tradeDeadline } from '../engine/schedule/schedule'
import { RATING_KEYS, RATING_MAX, RATING_MIN } from '../engine/player/ratings'
import type { League, Position, Ratings } from '../engine/types'
import { SaveImportError } from './errors'
import { backfillRecords } from '../engine/stories/records'
import { emptyStories } from '../engine/stories/state'
import { backfillJerseys } from '../engine/stories/jerseys'
import { recomputeFanBase } from '../engine/stories/sentiment'
import { emptyEvents } from '../engine/events/state'
import { emptyRivalry } from '../engine/rivals/state'
import { backfillHeritage } from '../engine/face/backfill'

export const CURRENT_VERSION = 14

const clampRating = (v: number) => Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(v)))
const numOr = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/**
 * Cleanly maps any legacy rating object (the old 15-rating schema and/or legacy keys like
 * `lateralQuickness` or `acceleration`) into the exact 36-attribute NBA 2K schema (25–99).
 * Strips all dead attributes so only the 36 keys remain.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateRatings(rawRatings: any, pos: Position = 'SF'): Ratings {
  const r = rawRatings && typeof rawRatings === 'object' ? rawRatings : {}
  const keys = Object.keys(r)
  const hasAll36 = RATING_KEYS.every((k) => typeof r[k] === 'number' && Number.isFinite(r[k]))
  if (hasAll36 && keys.length === RATING_KEYS.length) {
    const out = {} as Ratings
    for (const k of RATING_KEYS) out[k] = clampRating(r[k])
    return out
  }

  const ins = numOr(r.ins, 70)
  const mid = numOr(r.mid, 70)
  const three = numOr(r.three, 68)
  const ft = numOr(r.ft, 74)
  const pass = numOr(r.pass, 68)
  const handle = numOr(r.handle, 68)
  const oreb = numOr(r.oreb, 60)
  const perD = numOr(r.perD, 68)
  const intD = numOr(r.intD, 65)
  const stl = numOr(r.stl, 66)
  const blk = numOr(r.blk, 60)
  const dreb = numOr(r.dreb, 68)
  const ath = numOr(r.ath, 72)
  const stam = numOr(r.stam, 75)
  const iq = numOr(r.iq, 72)

  const big = pos === 'C' || pos === 'PF'
  const guard = pos === 'PG' || pos === 'SG'
  const pick = (key: keyof Ratings, fallback: number) =>
    clampRating(typeof r[key] === 'number' && Number.isFinite(r[key]) ? r[key] : fallback)

  const latQuick = typeof r.lateralQuickness === 'number' && Number.isFinite(r.lateralQuickness) ? r.lateralQuickness : undefined
  const accel = typeof r.acceleration === 'number' && Number.isFinite(r.acceleration) ? r.acceleration : undefined
  const agilityFallback =
    latQuick !== undefined && accel !== undefined ? (latQuick + accel) / 2
    : latQuick !== undefined ? latQuick * 0.65 + ath * 0.35
    : accel !== undefined ? accel * 0.55 + ath * 0.45
    : ath + (guard ? 3 : big ? -5 : 0)
  const speedFallback =
    accel !== undefined ? accel * 0.65 + ath * 0.35 : ath + (guard ? 4 : big ? -6 : 0)

  return {
    // Outside Scoring
    closeShot: pick('closeShot', ins * 0.75 + mid * 0.25),
    midRangeShot: pick('midRangeShot', mid),
    threePointShot: pick('threePointShot', three),
    freeThrow: pick('freeThrow', ft),
    shotIQ: pick('shotIQ', iq * 0.75 + (mid + three) * 0.125),
    offensiveConsistency: pick('offensiveConsistency', iq * 0.6 + (ins + mid + three) * 0.133),
    // Inside Scoring
    layup: pick('layup', ins * 0.75 + ath * 0.25 + (guard ? 4 : big ? -4 : 0)),
    standingDunk: pick('standingDunk', ins * 0.7 + ath * 0.3 + (pos === 'C' ? 10 : pos === 'PF' ? 5 : -24)),
    drivingDunk: pick('drivingDunk', ins * 0.5 + ath * 0.5 + (guard ? -4 : 2)),
    postHook: pick('postHook', ins * 0.8 + mid * 0.2 + (big ? 4 : -22)),
    postFade: pick('postFade', mid * 0.7 + ins * 0.3 + (big ? 2 : -10)),
    postControl: pick('postControl', ins * 0.75 + iq * 0.25 + (big ? 6 : -16)),
    drawFoul: pick('drawFoul', ins * 0.65 + iq * 0.35),
    hands: pick('hands', (ins + iq + handle) / 3 + (big ? 4 : 0)),
    // Playmaking
    passAccuracy: pick('passAccuracy', pass),
    ballHandle: pick('ballHandle', handle),
    speedWithBall: pick('speedWithBall', handle * 0.6 + speedFallback * 0.4),
    passIQ: pick('passIQ', pass * 0.55 + iq * 0.45),
    passVision: pick('passVision', pass * 0.7 + iq * 0.3),
    // Defense
    interiorDefense: pick('interiorDefense', intD),
    perimeterDefense: pick('perimeterDefense', perD),
    steal: pick('steal', stl),
    block: pick('block', blk),
    helpDefenseIQ: pick('helpDefenseIQ', (intD + perD + iq * 2) / 4),
    passPerception: pick('passPerception', stl * 0.55 + iq * 0.45),
    defensiveConsistency: pick('defensiveConsistency', (perD + intD + iq * 2) / 4),
    // Rebounding
    offensiveRebound: pick('offensiveRebound', oreb),
    defensiveRebound: pick('defensiveRebound', dreb),
    // Athleticism
    speed: pick('speed', speedFallback),
    agility: pick('agility', agilityFallback),
    strength: pick('strength', ath * 0.45 + intD * 0.55 + (big ? 8 : -8)),
    vertical: pick('vertical', ath),
    stamina: pick('stamina', stam),
    hustle: pick('hustle', (stam + ath + oreb + iq) / 4),
    overallDurability: pick('overallDurability', Math.max(55, (stam * 0.6 + ath * 0.4))),
    // Mental / Misc
    intangibles: pick('intangibles', iq),
  }
}

/**
 * Upgrades an older save to the current shape.
 * v1 → v2 adds in-season progress events. v2 → v3 adds the GM layer (picks, draft, waivers, free agency, offseason).
 * v3 → v4 adds stories (news, social, inbox, awards, history, records, Hall of Fame, fan sentiment).
 * v4 → v5 adds the user's favorite players. v5 → v6 adds All-Star Weekend and development slots.
 * v6 → v7 adds minutes plans and auto-rotation to depth charts (both optional, so nothing to fill in).
 * v7 → v8 adds random events and team chemistry. v8 → v9 adds long-term fan base. v9 → v10 adds retired jerseys.
 * v10 → v11 migrates player ratings to the 36-attribute NBA 2K schema (25–99) and removes dead rating/fatigue fields.
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
  if (raw?.version === 10) {
    raw = { ...raw, version: 11 }
    if (raw.players && typeof raw.players === 'object' && !Array.isArray(raw.players)) {
      const players: Record<string, unknown> = {}
      for (const [id, p] of Object.entries(raw.players)) {
        if (p && typeof p === 'object' && 'ratings' in p && p.ratings && typeof p.ratings === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { fatigue: _fatigue, ...rest } = p as any
          void _fatigue
          players[id] = { ...rest, ratings: migrateRatings(rest.ratings, rest.pos) }
        } else {
          players[id] = p
        }
      }
      raw = { ...raw, players }
    }
  }
  if (raw?.version === 11) {
    // Deep-copy the people so tagging their seeds never mutates the caller's object.
    raw = { ...raw, version: 12 }
    if (raw.players && typeof raw.players === 'object') raw.players = Object.fromEntries(Object.entries(raw.players).map(([id, p]) => [id, p && typeof p === 'object' ? { ...(p as object) } : p]))
    if (raw.coaches && typeof raw.coaches === 'object') raw.coaches = Object.fromEntries(Object.entries(raw.coaches).map(([id, c]) => [id, c && typeof c === 'object' ? { ...(c as object) } : c]))
    backfillHeritage(raw)
  }
  if (raw?.version === 12) raw = { ...raw, version: 13, rivalry: emptyRivalry() }
  if (raw?.version === 13) raw = { ...raw, version: 14, career: null }
  if (raw?.version !== CURRENT_VERSION)
    throw new SaveImportError(`This save is version ${String(raw?.version)}, but this app reads versions 1–${CURRENT_VERSION}.`)
  if (!Array.isArray(raw.favoritePlayerIds)) raw = { ...raw, favoritePlayerIds: [] }
  if (!Array.isArray(raw.progress)) raw = { ...raw, progress: [] }
  if (raw.career === undefined) raw = { ...raw, career: null }
  raw = { ...raw, rivalry: { ...emptyRivalry(), ...(raw.rivalry ?? {}) } }
  return raw as League
}
