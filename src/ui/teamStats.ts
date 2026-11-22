import { computeStandings } from '../engine/standings'
import type { League } from '../engine/types'

export interface TeamStatRow { teamId: string; gp: number; pts: number; opp: number; reb: number; ast: number; stl: number; blk: number; tov: number; fgPct: number; tpPct: number; ftPct: number }

/** Per-game team stats for a regular season, from player stat lines. */
export function teamStatRows(league: League, season: number): TeamStatRow[] {
  const st = computeStandings(league, season)
  const rows: Record<string, TeamStatRow & { fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number }> = {}
  for (const r of [...st.East, ...st.West])
    rows[r.teamId] = { teamId: r.teamId, gp: r.w + r.l, pts: 0, opp: r.pa, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgPct: 0, tpPct: 0, ftPct: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 }
  for (const s of Object.values(league.statLines)) {
    if (s.season !== season || s.playoffs || !rows[s.teamId]) continue
    const t = rows[s.teamId]
    t.pts += s.pts; t.reb += s.oreb + s.dreb; t.ast += s.ast; t.stl += s.stl; t.blk += s.blk; t.tov += s.tov
    t.fgm += s.fgm; t.fga += s.fga; t.tpm += s.tpm; t.tpa += s.tpa; t.ftm += s.ftm; t.fta += s.fta
  }
  return Object.values(rows).map((t) => {
    const g = t.gp || 1
    return {
      teamId: t.teamId, gp: t.gp, pts: t.pts / g, opp: t.opp / g, reb: t.reb / g, ast: t.ast / g, stl: t.stl / g, blk: t.blk / g,
      tov: t.tov / g, fgPct: t.fga ? t.fgm / t.fga : 0, tpPct: t.tpa ? t.tpm / t.tpa : 0, ftPct: t.fta ? t.ftm / t.fta : 0,
    }
  })
}

/** 1-based league rank; lowerIsBetter for opponent points and turnovers. */
export function rankOf(rows: TeamStatRow[], teamId: string, key: keyof Omit<TeamStatRow, 'teamId'>, lowerIsBetter = false): number {
  const sorted = [...rows].sort((a, b) => (lowerIsBetter ? a[key] - b[key] : b[key] - a[key]))
  return sorted.findIndex((r) => r.teamId === teamId) + 1
}
