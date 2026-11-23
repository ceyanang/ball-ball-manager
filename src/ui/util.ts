import { computeOvr } from '../engine/player/ratings'
import { playerSeasonStats, perGame } from '../engine/stats/stats'
import type { Game, League, Player, Team } from '../engine/types'

export const ovrOf = (p: Player) => computeOvr(p.ratings, p.pos)
export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`
export const teamFull = (t: Team) => `${t.city} ${t.name}`
export const rosterOf = (l: League, teamId: string) => Object.values(l.players).filter((p) => p.teamId === teamId)
export const money = (k: number) => (k >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${k}K`)
export const heightStr = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`
export const pct = (v: number) => (v === 0 ? '.000' : v >= 1 ? '1.000' : v.toFixed(3).replace(/^0/, ''))
export const one = (v: number) => v.toFixed(1)

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
