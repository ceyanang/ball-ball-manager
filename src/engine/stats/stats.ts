import type { BoxLine, Game, League, StatLine } from '../types'

export const statKey = (season: number, playoffs: boolean, playerId: string, teamId: string) =>
  `${season}|${playoffs ? 'p' : 'r'}|${playerId}|${teamId}`

const SUM_KEYS = ['min', 'pts', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'pm'] as const

const blank = (season: number, playoffs: boolean, playerId: string, teamId: string): StatLine => ({
  playerId, teamId, season, playoffs, gp: 0, gs: 0, min: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
  pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
})

export function addBoxToStatLines(statLines: Record<string, StatLine>, game: Game): void {
  if (!game.result) return
  const playoffs = game.playoff !== null
  for (const b of game.result.box) {
    if (b.min <= 0) continue
    const k = statKey(game.season, playoffs, b.playerId, b.teamId)
    const s = (statLines[k] ??= blank(game.season, playoffs, b.playerId, b.teamId))
    s.gp++
    if (b.gs) s.gs++
    for (const key of SUM_KEYS) s[key] += (b as BoxLine)[key]
  }
}

/** All lines for a player's season merged across teams; teamId is his current team when he played for it. */
export function playerSeasonStats(league: League, playerId: string, season: number, playoffs: boolean): StatLine | null {
  const prefix = `${season}|${playoffs ? 'p' : 'r'}|${playerId}|`
  const lines = Object.entries(league.statLines).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v)
  if (!lines.length) return null
  const current = league.players[playerId]?.teamId
  const teamId = lines.some((l) => l.teamId === current) ? current! : lines[lines.length - 1].teamId
  const out = blank(season, playoffs, playerId, teamId)
  for (const l of lines) {
    out.gp += l.gp
    out.gs += l.gs
    for (const key of SUM_KEYS) out[key] += l[key]
  }
  return out
}

export type PerGame = Record<'min' | 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tov' | 'fgPct' | 'tpPct' | 'ftPct', number>

export function perGame(s: StatLine): PerGame {
  const g = s.gp || 1
  const pct = (m: number, a: number) => (a > 0 ? m / a : 0)
  return {
    min: s.min / g, pts: s.pts / g, reb: (s.oreb + s.dreb) / g, ast: s.ast / g, stl: s.stl / g, blk: s.blk / g,
    tov: s.tov / g, fgPct: pct(s.fgm, s.fga), tpPct: pct(s.tpm, s.tpa), ftPct: pct(s.ftm, s.fta),
  }
}

export type LeaderStat = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tpm' | 'fgPct' | 'tpPct' | 'ftPct'
const MIN_ATTEMPTS: Partial<Record<LeaderStat, ['fga' | 'tpa' | 'fta', number]>> = {
  fgPct: ['fga', 5], tpPct: ['tpa', 1.5], ftPct: ['fta', 1.5],
}

export function leaders(league: League, season: number, stat: LeaderStat, n: number): { playerId: string; value: number }[] {
  const teamGames: Record<string, number> = {}
  for (const g of league.games)
    if (g.season === season && !g.playoff && g.result)
      for (const id of [g.homeId, g.awayId]) teamGames[id] = (teamGames[id] ?? 0) + 1
  const minGp = 0.7 * Math.max(0, ...Object.values(teamGames))
  const ids = new Set(
    Object.values(league.statLines).filter((s) => s.season === season && !s.playoffs).map((s) => s.playerId),
  )
  const rows: { playerId: string; value: number }[] = []
  for (const id of ids) {
    const s = playerSeasonStats(league, id, season, false)!
    if (s.gp < minGp || s.gp === 0) continue
    const att = MIN_ATTEMPTS[stat]
    if (att && s[att[0]] / s.gp < att[1]) continue
    const pg = perGame(s)
    const value = stat === 'tpm' ? s.tpm / s.gp : pg[stat as keyof PerGame]
    rows.push({ playerId: id, value })
  }
  return rows.sort((a, b) => b.value - a.value).slice(0, n)
}
