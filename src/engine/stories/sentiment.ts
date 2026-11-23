import { ovr, teamPlayers } from '../gm/cap'
import { askSalary, standingsOf, strengthOrder } from '../gm/value'
import type { BoxLine, Game, League, Player } from '../types'
import { clamp } from './state'

export const gameScore = (b: Pick<BoxLine, 'pts' | 'fgm' | 'fga' | 'fta' | 'ftm' | 'oreb' | 'dreb' | 'stl' | 'ast' | 'blk' | 'pf' | 'tov'>) =>
  b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.oreb + 0.3 * b.dreb + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov

/** Game score fans expect from a player of this OVR in these minutes. */
export const expectedGameScore = (o: number, min: number) => Math.max(1, (o - 55) * 0.75) * clamp(min / 30, 0.3, 1.2)

export const fanOf = (l: League, playerId: string) => l.fans.players[playerId] ?? 0
export const teamFan = (l: League, teamId: string) => l.fans.teams[teamId] ?? 0

/** Fans react to every game: players vs what their OVR suggests, teams to results (upsets count double). */
export function updateFans(l: League, g: Game): void {
  const r = g.result
  if (!r) return
  for (const b of r.box) {
    if (b.min < 6) continue
    const p = l.players[b.playerId]
    if (!p) continue
    const diff = (gameScore(b) - expectedGameScore(ovr(p), b.min)) / 8
    const cur = fanOf(l, p.id)
    l.fans.players[p.id] = Math.round(clamp(cur * 0.85 + clamp(diff, -1, 1) * 15, -100, 100))
  }
  const order = strengthOrder(l)
  const homeWon = r.homeScore > r.awayScore
  for (const [id, won, opp] of [[g.homeId, homeWon, g.awayId], [g.awayId, !homeWon, g.homeId]] as [string, boolean, string][]) {
    const underdog = order.indexOf(id) > order.indexOf(opp)
    const swing = (won ? 8 : -8) * (won === underdog ? 1.6 : 1) * (g.playoff ? 1.5 : 1)
    l.fans.teams[id] = Math.round(clamp(teamFan(l, id) * 0.9 + swing, -100, 100))
  }
}

/** Minutes per game this season for everyone who has played. */
function mpgThisSeason(l: League): Record<string, number> {
  const min: Record<string, number> = {}, gp: Record<string, number> = {}
  for (const s of Object.values(l.statLines)) {
    if (s.season !== l.season || s.playoffs) continue
    min[s.playerId] = (min[s.playerId] ?? 0) + s.min
    gp[s.playerId] = (gp[s.playerId] ?? 0) + s.gp
  }
  return Object.fromEntries(Object.keys(min).map((id) => [id, min[id] / Math.max(1, gp[id])]))
}

/** Minutes a player expects from his OVR rank on the roster. */
export const expectedMinutes = (rank: number) => Math.max(4, 34 - rank * 2.6)

/**
 * Weekly in-season mood: minutes vs role, winning, the crowd and pay. Moves a quarter of the way to the target.
 * Returns the user's players who are unhappy (below 35).
 */
export function weeklyMorale(l: League): Player[] {
  const mpg = mpgThisSeason(l)
  const pct = Object.fromEntries(standingsOf(l).map((r) => [r.teamId, r.w + r.l ? r.pct : 0.5]))
  const out: Player[] = []
  for (const t of Object.values(l.teams)) {
    const roster = teamPlayers(l, t.id).sort((a, b) => ovr(b) - ovr(a))
    roster.forEach((p, rank) => {
      if (p.injury && p.injury.gamesRemaining > 3) return
      const minutes = mpg[p.id] ?? 0
      let target = 60 + ((pct[t.id] ?? 0.5) - 0.5) * 40 + clamp((minutes - expectedMinutes(rank)) * 1.5, -25, 12) + fanOf(l, p.id) * 0.1
      if (p.contract && p.contract.salary < askSalary(l, p) * 0.7) target -= 8
      p.morale = Math.round(clamp(p.morale + (clamp(target, 0, 100) - p.morale) * 0.25, 0, 100))
      if (t.id === l.userTeamId && p.morale < 35) out.push(p)
    })
  }
  return out
}

/** How much people care about a player: stars and fan favourites get the likes. */
export function popularity(l: League, p: Player | undefined): number {
  if (!p) return 20
  return Math.round(20 + Math.max(0, ovr(p) - 55) ** 2 / 4 + Math.abs(fanOf(l, p.id)) * 0.6)
}
