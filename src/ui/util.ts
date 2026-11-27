import { ovrOf } from '../engine/career/careerOvr'
import { playerSeasonStats, perGame } from '../engine/stats/stats'
import type { Game, League, Player, Team } from '../engine/types'

export { ovrOf }
/** Morale (0–100) as a face and a word. */
export const moodOf = (m: number) =>
  m >= 70 ? { emoji: '😄', label: 'Happy' } : m >= 45 ? { emoji: '🙂', label: 'Content' } : m >= 30 ? { emoji: '😕', label: 'Unhappy' } : { emoji: '😠', label: 'Angry' }
export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`
export const teamFull = (t: Team) => `${t.city} ${t.name}`
export const rosterOf = (l: League, teamId: string) => Object.values(l.players).filter((p) => p.teamId === teamId)
/** Money in thousands: "$1.2M" / "$750K"; nothing is just "$0". */
export function money(k: number): string {
  if (k === 0) return '$0'
  const sign = k < 0 ? '-' : ''
  const a = Math.abs(k)
  return a >= 1000 ? `${sign}$${(a / 1000).toFixed(1)}M` : `${sign}$${a}K`
}
export const heightStr = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`
export const pct = (v: number) => (v === 0 ? '.000' : v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, ''))
export const one = (v: number) => v.toFixed(1)
/** Win percentage for a standings row, or "—" before the team has played. */
export const rowPct = (r: { w: number; l: number; pct: number }) => (r.w + r.l === 0 ? '—' : pct(r.pct))
export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

export function teamOvr(l: League, teamId: string): number {
  const top = rosterOf(l, teamId).map(ovrOf).sort((a, b) => b - a).slice(0, 8)
  return top.length ? Math.round(top.reduce((s, x) => s + x, 0) / top.length) : 0
}

export function teamGames(l: League, teamId: string): Game[] {
  // league.games holds every season's games, and `day` restarts each season.
  return l.games.filter((g) => g.homeId === teamId || g.awayId === teamId).sort((a, b) => a.season - b.season || a.day - b.day)
}

/** The team's last `n` played games this season, oldest first. */
export function recentResults(l: League, teamId: string, n: number): Game[] {
  return teamGames(l, teamId).filter((g) => g.result && g.season === l.season).slice(-n)
}

/** Wins and losses in the given games for `teamId` (unplayed games are skipped). */
export function winLoss(games: Game[], teamId: string): { w: number; l: number } {
  let w = 0, l = 0
  for (const g of games) if (g.result) { if (didWin(g, teamId)) w++; else l++ }
  return { w, l }
}

export function nextGame(l: League, teamId: string): Game | undefined {
  return teamGames(l, teamId).find((g) => !g.result)
}

export function didWin(g: Game, teamId: string): boolean {
  const r = g.result!
  return g.homeId === teamId ? r.homeScore > r.awayScore : r.awayScore > r.homeScore
}

export function seasonLine(l: League, p: Player) {
  const s = playerSeasonStats(l, p.id, l.season, false)
  return s ? { s, pg: perGame(s) } : null
}
