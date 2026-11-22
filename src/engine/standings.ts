import { Rng } from './rng'
import type { Conference, Game, League } from './types'

export interface StandingRow {
  teamId: string; w: number; l: number; pct: number; gb: number; confW: number; confL: number
  home: [number, number]; away: [number, number]; pf: number; pa: number; streak: string; last10: string
}

const seasonGames = (league: League, season: number): Game[] =>
  league.games.filter((g) => g.season === season && g.playoff === null && g.result !== null).sort((a, b) => a.day - b.day)

function buildRows(league: League, season: number): Record<string, StandingRow> {
  const rows: Record<string, StandingRow> = {}
  const results: Record<string, boolean[]> = {}
  for (const id of Object.keys(league.teams)) {
    rows[id] = { teamId: id, w: 0, l: 0, pct: 0, gb: 0, confW: 0, confL: 0, home: [0, 0], away: [0, 0], pf: 0, pa: 0, streak: '', last10: '0-0' }
    results[id] = []
  }
  for (const g of seasonGames(league, season)) {
    const r = g.result!
    const sameConf = league.teams[g.homeId].conf === league.teams[g.awayId].conf
    for (const [id, us, them, isHome] of [[g.homeId, r.homeScore, r.awayScore, true], [g.awayId, r.awayScore, r.homeScore, false]] as const) {
      const row = rows[id]
      const won = us > them
      if (won) row.w++; else row.l++
      if (sameConf) { if (won) row.confW++; else row.confL++ }
      const split = isHome ? row.home : row.away
      split[won ? 0 : 1]++
      row.pf += us
      row.pa += them
      results[id].push(won)
    }
  }
  for (const row of Object.values(rows)) {
    const gp = row.w + row.l
    row.pct = gp ? row.w / gp : 0
    const res = results[row.teamId]
    if (res.length) {
      const last = res[res.length - 1]
      let n = 0
      for (let i = res.length - 1; i >= 0 && res[i] === last; i--) n++
      row.streak = `${last ? 'W' : 'L'}${n}`
    }
    const l10 = res.slice(-10)
    row.last10 = `${l10.filter(Boolean).length}-${l10.filter((x) => !x).length}`
  }
  return rows
}

/** Orders teams by win pct, then for tied groups: head-to-head among the group, conference pct, point diff, seeded coin flip. */
function orderIds(league: League, season: number, ids: string[], rows: Record<string, StandingRow>): string[] {
  const games = seasonGames(league, season)
  const coin = Rng.fromSeed(league.seed + season)
  const coinKey: Record<string, number> = {}
  for (const id of Object.keys(league.teams).sort()) coinKey[id] = coin.next()
  const byPct = [...ids].sort((a, b) => rows[b].pct - rows[a].pct)
  const out: string[] = []
  for (let i = 0; i < byPct.length; ) {
    let j = i
    while (j < byPct.length && rows[byPct[j]].pct === rows[byPct[i]].pct) j++
    const group = byPct.slice(i, j)
    if (group.length === 1) out.push(group[0])
    else {
      const set = new Set(group)
      const h2h: Record<string, [number, number]> = Object.fromEntries(group.map((id) => [id, [0, 0]]))
      for (const g of games) {
        if (!set.has(g.homeId) || !set.has(g.awayId)) continue
        const homeWon = g.result!.homeScore > g.result!.awayScore
        h2h[g.homeId][homeWon ? 0 : 1]++
        h2h[g.awayId][homeWon ? 1 : 0]++
      }
      const pct = ([w, l]: [number, number]) => (w + l ? w / (w + l) : 0.5)
      const confPct = (id: string) => pct([rows[id].confW, rows[id].confL])
      const diff = (id: string) => rows[id].pf - rows[id].pa
      group.sort((a, b) =>
        pct(h2h[b]) - pct(h2h[a]) || confPct(b) - confPct(a) || diff(b) - diff(a) || coinKey[b] - coinKey[a])
      out.push(...group)
    }
    i = j
  }
  return out
}

export function computeStandings(league: League, season: number): Record<Conference, StandingRow[]> {
  const rows = buildRows(league, season)
  const out = { East: [] as StandingRow[], West: [] as StandingRow[] }
  for (const conf of ['East', 'West'] as Conference[]) {
    const ids = Object.values(league.teams).filter((t) => t.conf === conf).map((t) => t.id)
    const ordered = orderIds(league, season, ids, rows).map((id) => rows[id])
    const lead = ordered[0]
    for (const r of ordered) r.gb = (lead.w - r.w + (r.l - lead.l)) / 2
    out[conf] = ordered
  }
  return out
}

/** Same ordering chain applied to an arbitrary set of teams (e.g. Finals home court across conferences). */
export function sortTeams(league: League, season: number, teamIds: string[]): string[] {
  return orderIds(league, season, teamIds, buildRows(league, season))
}
