import { playerSeasonStats } from '../stats/stats'
import type { BoxLine, Game, League, RecordBook, RecordEntry, RecordHolder, RecordScope, RecordStat, StatLine } from '../types'
import { emptyBook } from './state'

export const RECORD_STATS: RecordStat[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm']
export const RECORD_LABEL: Record<RecordStat, string> = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', stl: 'Steals', blk: 'Blocks', tpm: '3-pointers' }

const statOf = (b: Pick<BoxLine, 'pts' | 'oreb' | 'dreb' | 'ast' | 'stl' | 'blk' | 'tpm'>, s: RecordStat) => (s === 'reb' ? b.oreb + b.dreb : b[s])

export const teamBook = (l: League, teamId: string): RecordBook => (l.records.teams[teamId] ??= emptyBook())

/** Puts a holder in the book if it beats the current mark. Returns the new entry when it did. */
function offer(book: RecordBook, scope: RecordScope, stat: RecordStat, h: RecordHolder): RecordEntry | null {
  const cur = book[scope][stat]
  if (cur && h.value <= cur.value) return null
  // Season and career marks are filled in one pass per season: a mark set earlier in the same pass (or the same
  // player raising his own mark) isn't a real previous holder, so the older one carries over.
  const carry = cur && scope !== 'game' && (cur.playerId === h.playerId || cur.season === h.season)
  const prev = !cur ? null : carry ? cur.prev : { value: cur.value, playerId: cur.playerId, teamId: cur.teamId, season: cur.season, gameId: cur.gameId }
  const entry: RecordEntry = { ...h, prev }
  book[scope][stat] = entry
  return entry
}

export interface Broken { scope: RecordScope; stat: RecordStat; teamId: string | null; entry: RecordEntry }

/** Single-game records after a regular-season game. */
export function gameRecords(l: League, g: Game): Broken[] {
  if (!g.result || g.playoff) return []
  const out: Broken[] = []
  for (const b of g.result.box) {
    if (b.min <= 0) continue
    for (const stat of RECORD_STATS) {
      const v = statOf(b, stat)
      if (v <= 0) continue
      const h: RecordHolder = { value: v, playerId: b.playerId, teamId: b.teamId, season: g.season, gameId: g.id }
      const lg = offer(l.records.league, 'game', stat, h)
      if (lg) out.push({ scope: 'game', stat, teamId: null, entry: lg })
      const tm = offer(teamBook(l, b.teamId), 'game', stat, h)
      if (tm) out.push({ scope: 'game', stat, teamId: b.teamId, entry: tm })
    }
  }
  return out
}

/** Season per-game marks (players who played ≥70% of their team's games). */
export function seasonRecords(l: League, season: number): Broken[] {
  const teamGames: Record<string, number> = {}
  for (const g of l.games)
    if (g.season === season && !g.playoff && g.result) for (const id of [g.homeId, g.awayId]) teamGames[id] = (teamGames[id] ?? 0) + 1
  const maxGames = Math.max(0, ...Object.values(teamGames))
  if (!maxGames) return []
  const ids = new Set(Object.values(l.statLines).filter((s) => s.season === season && !s.playoffs).map((s) => s.playerId))
  const out: Broken[] = []
  for (const id of ids) {
    const s = playerSeasonStats(l, id, season, false)!
    if (s.gp < 0.7 * maxGames) continue
    for (const stat of RECORD_STATS) {
      const value = Math.round((statOf(s, stat) / s.gp) * 10) / 10
      if (value <= 0) continue
      const h: RecordHolder = { value, playerId: id, teamId: s.teamId, season }
      const lg = offer(l.records.league, 'season', stat, h)
      if (lg) out.push({ scope: 'season', stat, teamId: null, entry: lg })
      const tm = offer(teamBook(l, s.teamId), 'season', stat, h)
      if (tm) out.push({ scope: 'season', stat, teamId: s.teamId, entry: tm })
    }
  }
  return out
}

/** Career regular-season totals (league-wide, and with each franchise). */
export function careerRecords(l: League, season: number): Broken[] {
  const total: Record<string, StatLine> = {}
  const withTeam: Record<string, StatLine> = {}
  const add = (m: Record<string, StatLine>, k: string, s: StatLine) => {
    const t = (m[k] ??= { ...s, gp: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 })
    t.gp += s.gp; t.pts += s.pts; t.oreb += s.oreb; t.dreb += s.dreb; t.ast += s.ast; t.stl += s.stl; t.blk += s.blk; t.tpm += s.tpm
  }
  for (const s of Object.values(l.statLines)) {
    if (s.playoffs || s.season > season) continue
    add(total, s.playerId, s)
    add(withTeam, `${s.playerId}|${s.teamId}`, s)
  }
  const out: Broken[] = []
  for (const [pid, s] of Object.entries(total))
    for (const stat of RECORD_STATS) {
      const value = statOf(s, stat)
      if (value <= 0) continue
      const lg = offer(l.records.league, 'career', stat, { value, playerId: pid, teamId: l.players[pid]?.teamId ?? s.teamId, season })
      if (lg) out.push({ scope: 'career', stat, teamId: null, entry: lg })
    }
  for (const [k, s] of Object.entries(withTeam)) {
    const [pid, teamId] = k.split('|')
    if (!l.teams[teamId]) continue
    for (const stat of RECORD_STATS) {
      const value = statOf(s, stat)
      if (value <= 0) continue
      const tm = offer(teamBook(l, teamId), 'career', stat, { value, playerId: pid, teamId, season })
      if (tm) out.push({ scope: 'career', stat, teamId, entry: tm })
    }
  }
  return out
}

/** Fills the record book from whatever an older save still has. */
export function backfillRecords(l: League): void {
  for (const g of l.games) if (g.result?.box.length) gameRecords(l, g)
  const seasons = [...new Set(Object.values(l.statLines).map((s) => s.season))].sort((a, b) => a - b)
  for (const s of seasons) if (s < l.season || l.phase !== 'regular') seasonRecords(l, s)
  if (seasons.length) careerRecords(l, Math.max(...seasons))
}
