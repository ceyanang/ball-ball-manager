import { pname, teamPlayers } from '../gm/cap'
import { strengthOrder } from '../gm/value'
import { computeStandings } from '../standings'
import { leaders, perGame, playerSeasonStats, type LeaderStat } from '../stats/stats'
import type { League, Player, Position, SeasonAwards, SeasonHistory, StatLine } from '../types'
import { addNews, isRookie } from './highlights'
import { gameScore } from './sentiment'

interface Cand { p: Player; s: StatLine; teamId: string; gsPg: number; avail: number; pct: number }

function candidates(l: League, season: number): Cand[] {
  const st = computeStandings(l, season)
  const rows = [...st.East, ...st.West]
  const pct = Object.fromEntries(rows.map((r) => [r.teamId, r.pct]))
  const games = Math.max(1, ...rows.map((r) => r.w + r.l))
  const ids = new Set(Object.values(l.statLines).filter((s) => s.season === season && !s.playoffs).map((s) => s.playerId))
  const out: Cand[] = []
  for (const id of ids) {
    const p = l.players[id]
    const s = playerSeasonStats(l, id, season, false)
    if (!p || !s || s.gp < 0.5 * games) continue
    out.push({ p, s, teamId: s.teamId, gsPg: gameScore(s) / s.gp, avail: Math.min(1, s.gp / (0.85 * games)), pct: pct[s.teamId] ?? 0.5 })
  }
  return out
}

const mvpScore = (c: Cand) => c.gsPg * c.avail + c.pct * 8
const dpoyScore = (c: Cand) => (c.s.stl * 2.6 + c.s.blk * 3 + c.s.dreb * 0.25) / c.s.gp + (c.p.ratings.perD + c.p.ratings.intD) * 0.07 + c.pct * 3 + (c.s.min / c.s.gp) * 0.04
const best = <T>(xs: T[], f: (x: T) => number): T | null => (xs.length ? xs.reduce((a, b) => (f(b) > f(a) ? b : a)) : null)

const GROUP: Record<Position, 'G' | 'F' | 'C'> = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' }
/** Teams of five: two guards, two forwards, a center, best first. Falls back to anyone when a slot runs dry. */
function teamsOfFive(cands: Cand[], score: (c: Cand) => number, n: number): string[][] {
  const pool = [...cands].sort((a, b) => score(b) - score(a))
  const used = new Set<string>()
  const out: string[][] = []
  for (let t = 0; t < n; t++) {
    const team: string[] = []
    for (const [g, k] of [['G', 2], ['F', 2], ['C', 1]] as const) {
      for (let i = 0; i < k; i++) {
        const c = pool.find((x) => !used.has(x.p.id) && GROUP[x.p.pos] === g) ?? pool.find((x) => !used.has(x.p.id))
        if (!c) break
        used.add(c.p.id)
        team.push(c.p.id)
      }
    }
    if (team.length) out.push(team)
  }
  return out
}

function finalsMvp(l: League, season: number, championId: string | null): string | null {
  if (!championId) return null
  const finals = l.playoffs?.series.find((s) => s.round === 4)
  if (!finals) return null
  const tot: Record<string, number> = {}
  for (const g of l.games)
    if (g.season === season && g.playoff?.seriesId === finals.id && g.result)
      for (const b of g.result.box) if (b.teamId === championId) tot[b.playerId] = (tot[b.playerId] ?? 0) + gameScore(b)
  return best(Object.keys(tot), (id) => tot[id])
}

/** Season awards, formula-based (spec §20). Call when the Finals end, before progression. */
export function computeAwards(l: League): SeasonAwards {
  const season = l.season
  const cands = candidates(l, season)
  const championId = l.playoffs?.championId ?? null
  const mvp = best(cands, mvpScore)
  const dpoy = best(cands, dpoyScore)
  const rookies = cands.filter((c) => isRookie(l, c.p, season))
  const roy = best(rookies, mvpScore)
  const sixth = best(cands.filter((c) => c.s.gs / c.s.gp < 0.3), (c) => c.gsPg * c.avail)
  const prev: Record<string, number> = {}
  for (const c of cands) {
    const s = playerSeasonStats(l, c.p.id, season - 1, false)
    if (s && s.gp >= 10) prev[c.p.id] = gameScore(s) / s.gp
  }
  const mip = best(cands.filter((c) => prev[c.p.id] !== undefined && c.gsPg - prev[c.p.id] >= 3), (c) => c.gsPg - prev[c.p.id])
  const st = computeStandings(l, season)
  const order = strengthOrder(l)
  const coyRow = best([...st.East, ...st.West], (r) => r.pct - (0.72 - (0.44 * order.indexOf(r.teamId)) / 29))
  return {
    season, championId,
    championRoster: championId ? teamPlayers(l, championId).map((p) => p.id) : [],
    mvp: mvp?.p.id ?? null, dpoy: dpoy?.p.id ?? null, roy: roy?.p.id ?? null, smoy: sixth?.p.id ?? null, mip: mip?.p.id ?? null,
    coy: coyRow ? { coachId: l.teams[coyRow.teamId].coachId, teamId: coyRow.teamId } : null,
    finalsMvp: finalsMvp(l, season, championId),
    allLeague: teamsOfFive(cands, mvpScore, 3),
    allDefense: teamsOfFive(cands, dpoyScore, 2),
    allRookie: [...rookies].sort((a, b) => mvpScore(b) - mvpScore(a)).slice(0, 5).map((c) => c.p.id),
  }
}

const LEADER_STATS: [LeaderStat, string][] = [['pts', 'PPG'], ['reb', 'RPG'], ['ast', 'APG'], ['stl', 'SPG'], ['blk', 'BPG'], ['tpm', '3PM']]

export function seasonHistory(l: League): SeasonHistory {
  const st = computeStandings(l, l.season)
  const finals = l.playoffs?.series.find((s) => s.round === 4)
  const championId = l.playoffs?.championId ?? null
  const runnerUpId = finals && championId ? (finals.highSeedId === championId ? finals.lowSeedId : finals.highSeedId) : null
  const w = finals ? Math.max(finals.highWins, finals.lowWins) : 0, lo = finals ? Math.min(finals.highWins, finals.lowWins) : 0
  return {
    season: l.season, championId, runnerUpId, finals: finals ? `${w}–${lo}` : '',
    standings: (['East', 'West'] as const).flatMap((conf) => st[conf].map((r) => ({ teamId: r.teamId, w: r.w, l: r.l, conf }))),
    leaders: LEADER_STATS.flatMap(([stat, label]) => leaders(l, l.season, stat, 1).map((x) => {
      const s = playerSeasonStats(l, x.playerId, l.season, false)!
      return { stat: label, playerId: x.playerId, teamId: s.teamId, value: Math.round(x.value * 10) / 10 }
    })),
  }
}

export const AWARD_NAMES: Record<'mvp' | 'dpoy' | 'roy' | 'smoy' | 'mip' | 'finalsMvp', string> = {
  mvp: 'Most Valuable Player', finalsMvp: 'Finals MVP', dpoy: 'Defensive Player of the Year', roy: 'Rookie of the Year', smoy: 'Sixth Man of the Year', mip: 'Most Improved Player',
}

/** Award headlines for the highlights feed. */
export function awardNews(l: League, a: SeasonAwards): void {
  for (const k of ['mvp', 'finalsMvp', 'dpoy', 'roy', 'smoy', 'mip'] as const) {
    const id = a[k]
    if (!id) continue
    const p = l.players[id]
    const s = playerSeasonStats(l, id, a.season, false)
    const pg = s ? perGame(s) : null
    addNews(l, { kind: 'award', emoji: k === 'mvp' ? '👑' : '🏅', title: `${pname(p)}: ${AWARD_NAMES[k]}`, text: pg ? `${pg.pts.toFixed(1)} pts, ${pg.reb.toFixed(1)} reb, ${pg.ast.toFixed(1)} ast for ${l.teams[s!.teamId].name}.` : `${AWARD_NAMES[k]}.`, playerIds: [id], teamIds: s ? [s.teamId] : [], weight: k === 'mvp' ? 9 : 6 })
  }
}

/** Every award a player has won, newest first. */
export function playerAwards(l: League, playerId: string): { season: number; label: string }[] {
  const out: { season: number; label: string }[] = []
  for (const a of [...l.awards].reverse()) {
    if (a.championRoster.includes(playerId)) out.push({ season: a.season, label: '🏆 Champion' })
    for (const k of ['mvp', 'finalsMvp', 'dpoy', 'roy', 'smoy', 'mip'] as const) if (a[k] === playerId) out.push({ season: a.season, label: AWARD_NAMES[k] })
    a.allLeague.forEach((t, i) => t.includes(playerId) && out.push({ season: a.season, label: `All-League ${['1st', '2nd', '3rd'][i]} team` }))
    a.allDefense.forEach((t, i) => t.includes(playerId) && out.push({ season: a.season, label: `All-Defense ${['1st', '2nd'][i]} team` }))
    if (a.allRookie.includes(playerId)) out.push({ season: a.season, label: 'All-Rookie team' })
  }
  for (const e of l.allStars) {
    const label = e.kind === 'allstar' ? 'All-Star' : 'Rising Stars'
    const played = e.teams.some((t) => [...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive].includes(playerId))
    if (played) out.push({ season: e.season, label: `🌟 ${label}` })
    if (e.mvp === playerId) out.push({ season: e.season, label: `${label} MVP` })
  }
  return out.sort((a, b) => b.season - a.season)
}

/** Hall of Fame threshold on the career score. */
export const HOF_SCORE = 65

export function careerScore(l: League, playerId: string): number {
  let score = 0
  const seasons = new Set(Object.values(l.statLines).filter((s) => s.playerId === playerId && !s.playoffs).map((s) => s.season))
  for (const season of seasons) {
    const s = playerSeasonStats(l, playerId, season, false)!
    const v = (s.pts + 1.2 * (s.oreb + s.dreb) + 1.5 * s.ast + 2 * (s.stl + s.blk)) / Math.max(1, s.gp)
    score += (Math.max(0, v - 20) / 4) * (s.gp / 40)
  }
  for (const a of l.awards) {
    if (a.mvp === playerId) score += 6
    if (a.finalsMvp === playerId) score += 3
    if (a.championRoster.includes(playerId)) score += 1.5
    if (a.dpoy === playerId) score += 2
    if (a.roy === playerId) score += 1
    a.allLeague.forEach((t, i) => { if (t.includes(playerId)) score += 3 - i })
    a.allDefense.forEach((t) => { if (t.includes(playerId)) score += 0.5 })
  }
  return Math.round(score * 10) / 10
}

/** Newly retired players with a big enough career go into the Hall. Returns the inductees. */
export function induct(l: League, playerIds: string[]): string[] {
  const out: string[] = []
  for (const id of playerIds) {
    if (l.hof.some((h) => h.playerId === id)) continue
    const score = careerScore(l, id)
    if (score < HOF_SCORE) continue
    l.hof.push({ playerId: id, season: l.season, score })
    out.push(id)
    const p = l.players[id]
    addNews(l, { kind: 'hof', emoji: '🎖️', title: `${pname(p)} enters the Hall of Fame`, text: `${pname(p)} retires with a Hall of Fame career (score ${score}).`, playerIds: [id], teamIds: [], weight: 8 })
  }
  return out
}
