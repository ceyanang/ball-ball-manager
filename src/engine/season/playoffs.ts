import { computeStandings, sortTeams } from '../standings'
import type { Conference, Game, League, PlayoffBracket, Series } from '../types'

const R1_PAIRS: [number, number][] = [[1, 8], [4, 5], [3, 6], [2, 7]]
const HOME_PATTERN: Record<5 | 7, boolean[]> = {
  5: [true, true, false, false, true],
  7: [true, true, false, false, true, false, true],
}

const sid = (season: number, conf: Conference | null, round: number, k: number) => `s${season}_${conf ?? 'F'}_r${round}_${k}`

export function seedPlayoffs(league: League): PlayoffBracket {
  const st = computeStandings(league, league.season)
  const series: Series[] = []
  for (const conf of ['East', 'West'] as Conference[]) {
    const seeds = st[conf].slice(0, 8).map((r) => r.teamId)
    R1_PAIRS.forEach(([hi, lo], k) =>
      series.push({
        id: sid(league.season, conf, 1, k), round: 1, conf, highSeedId: seeds[hi - 1], lowSeedId: seeds[lo - 1],
        highSeed: hi, lowSeed: lo, highWins: 0, lowWins: 0, bestOf: 5, winnerId: null,
      }),
    )
  }
  return { season: league.season, series, championId: null }
}

const winnerSeed = (s: Series) => (s.winnerId === s.highSeedId ? s.highSeed : s.lowSeed)

function makeNext(league: League, round: number, conf: Conference | null, k: number, a: Series, b: Series): Series {
  const bestOf = round === 4 ? 7 : 5
  let [hiId, loId, hi, lo] = [a.winnerId!, b.winnerId!, winnerSeed(a), winnerSeed(b)]
  const swap = round === 4 ? sortTeams(league, league.season, [hiId, loId])[0] !== hiId : lo < hi
  if (swap) [hiId, loId, hi, lo] = [loId, hiId, lo, hi]
  return { id: sid(league.season, conf, round, k), round, conf, highSeedId: hiId, lowSeedId: loId, highSeed: hi, lowSeed: lo, highWins: 0, lowWins: 0, bestOf, winnerId: null }
}

/** Call at the end of each playoff day (before the day counter advances). */
export function advancePlayoffs(league: League): void {
  const b = league.playoffs
  if (!b || b.championId) return
  const byId = new Map(b.series.map((s) => [s.id, s]))
  const gamesOf = (s: Series) => league.games.filter((g) => g.playoff?.seriesId === s.id)

  for (const s of b.series) {
    if (s.winnerId) continue
    s.highWins = 0
    s.lowWins = 0
    for (const g of gamesOf(s)) {
      if (!g.result) continue
      const homeWon = g.result.homeScore > g.result.awayScore
      const winner = homeWon ? g.homeId : g.awayId
      if (winner === s.highSeedId) s.highWins++; else s.lowWins++
    }
    const need = s.bestOf === 7 ? 4 : 3
    if (s.highWins === need) s.winnerId = s.highSeedId
    if (s.lowWins === need) s.winnerId = s.lowSeedId
  }

  const add = (round: number, conf: Conference | null, k: number, aId: string, bId: string) => {
    const id = sid(league.season, conf, round, k)
    const a = byId.get(aId), c = byId.get(bId)
    if (byId.has(id) || !a?.winnerId || !c?.winnerId) return
    const s = makeNext(league, round, conf, k, a, c)
    b.series.push(s)
    byId.set(id, s)
  }
  for (const conf of ['East', 'West'] as Conference[]) {
    add(2, conf, 0, sid(league.season, conf, 1, 0), sid(league.season, conf, 1, 1))
    add(2, conf, 1, sid(league.season, conf, 1, 2), sid(league.season, conf, 1, 3))
    add(3, conf, 0, sid(league.season, conf, 2, 0), sid(league.season, conf, 2, 1))
  }
  add(4, null, 0, sid(league.season, 'East', 3, 0), sid(league.season, 'West', 3, 0))

  const finals = byId.get(sid(league.season, null, 4, 0))
  if (finals?.winnerId) {
    b.championId = finals.winnerId
    league.phase = 'offseason'
    return
  }

  for (const s of b.series) {
    if (s.winnerId) continue
    const games = gamesOf(s)
    if (games.some((g) => !g.result)) continue
    const n = games.length
    const highHome = HOME_PATTERN[s.bestOf][n]
    const game: Game = {
      id: `g_${league.season}_p_${s.id}_${n + 1}`, season: league.season, day: league.day + 1,
      homeId: highHome ? s.highSeedId : s.lowSeedId, awayId: highHome ? s.lowSeedId : s.highSeedId,
      playoff: { round: s.round, seriesId: s.id, gameNum: n + 1 }, result: null,
    }
    league.games.push(game)
  }
}
