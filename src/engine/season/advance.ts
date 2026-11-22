import { progressTick } from '../player/progress'
import { Rng } from '../rng'
import { simGame } from '../sim/game'
import { rollInjuries, tickInjuries } from '../sim/injury'
import { addBoxToStatLines } from '../stats/stats'
import type { Game, League } from '../types'
import { advancePlayoffs, seedPlayoffs } from './playoffs'

/** In-season rating changes happen every this many days of the regular season. */
const PROGRESS_EVERY = 10

function playGame(league: League, g: Game, rng: Rng): void {
  const res = simGame(league.teams[g.homeId], league.teams[g.awayId], league.players, league.coaches, rng)
  g.result = res
  addBoxToStatLines(league.statLines, g)
  tickInjuries([g.homeId, g.awayId], league.players)
  for (const { playerId, injury } of rollInjuries(res, league.players, rng)) league.players[playerId].injury = injury
  if (!g.playoff) {
    const homeWon = res.homeScore > res.awayScore
    const hc = league.coaches[league.teams[g.homeId].coachId]
    const ac = league.coaches[league.teams[g.awayId].coachId]
    if (homeWon) { hc.wins++; ac.losses++ } else { hc.losses++; ac.wins++ }
  }
}

/** Mutates `league`: plays the current day and advances the calendar. */
function stepDay(league: League, rng: Rng): void {
  if (league.phase === 'offseason') return
  for (const g of league.games) {
    if (g.day === league.day && !g.result && (league.phase === 'playoffs') === (g.playoff !== null)) playGame(league, g, rng)
  }
  if (league.phase === 'regular') {
    if (league.day % PROGRESS_EVERY === 0) league.progress.push(...progressTick(league, rng))
    if (!league.games.some((g) => !g.playoff && !g.result)) {
      league.phase = 'playoffs'
      league.playoffs = seedPlayoffs(league)
      advancePlayoffs(league)
    }
  } else advancePlayoffs(league)
  league.day++
}

export function simDays(league: League, days: number): League {
  if (league.phase === 'offseason') return league
  const next = structuredClone(league)
  const rng = new Rng(next.rng)
  const phase = next.phase
  for (let i = 0; i < days && next.phase === phase; i++) stepDay(next, rng)
  return next
}

export function simUntil(league: League, target: 'regularEnd' | 'playoffsEnd'): League {
  if (league.phase === 'offseason') return league
  const next = structuredClone(league)
  const rng = new Rng(next.rng)
  const done = () => (target === 'regularEnd' ? next.phase !== 'regular' : next.phase === 'offseason')
  for (let guard = 0; !done() && guard < 1000; guard++) stepDay(next, rng)
  return next
}
