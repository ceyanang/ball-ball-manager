import { playPendingAllStar, selectAllStars } from '../allstar/allstar'
import { progressTick } from '../player/progress'
import { Rng } from '../rng'
import { simGame } from '../sim/game'
import type { PlayEvent } from '../sim/playlog'
import { autoRotation, coachRotation } from '../sim/rotation'
import { advanceOffseason, simFreeAgency, startOffseason } from '../gm/offseason'
import { aiFillRosters, processWaivers } from '../gm/roster'
import { aiTrades } from '../gm/trade'
import { rollInjuries, tickInjuries } from '../sim/injury'
import { addBoxToStatLines } from '../stats/stats'
import type { Game, League, Phase, Player, Series } from '../types'
import { buildMods, tickEffects } from '../events/mods'
import { advancePlayoffs, seedPlayoffs } from './playoffs'
import { pruneTraining } from '../gm/training'
import { afterDay, afterGame, onBreakout, afterOffseason, onInjury, onRegularSeasonEnd, onReturn, onSeasonEnd, onSeriesDecided } from '../stories/hooks'

/** In-season rating changes happen every this many days of the regular season. */
const PROGRESS_EVERY = 10

/** A play-by-play log of one team's game for the day, kept for the watch-live view. */
export interface WatchCapture { gameId: string; log: PlayEvent[] }
interface Capture { teamId: string; out: WatchCapture | null }

function playGame(league: League, g: Game, rng: Rng, capture?: Capture): void {
  const log: PlayEvent[] | undefined = capture && (g.homeId === capture.teamId || g.awayId === capture.teamId) ? [] : undefined
  const res = simGame(league.teams[g.homeId], league.teams[g.awayId], league.players, league.coaches, rng, log, buildMods(league, g))
  if (g.homeId === league.userTeamId || g.awayId === league.userTeamId) tickEffects(league)
  if (log && capture) capture.out = { gameId: g.id, log }
  g.result = res
  addBoxToStatLines(league.statLines, g)
  const hurt = Object.values(league.players).filter((p) => p.injury && (p.teamId === g.homeId || p.teamId === g.awayId)).map((p) => p.id)
  tickInjuries([g.homeId, g.awayId], league.players)
  for (const id of hurt) if (!league.players[id].injury) onReturn(league, id)
  for (const { playerId, injury } of rollInjuries(res, league.players, rng)) {
    league.players[playerId].injury = injury
    onInjury(league, playerId, injury)
  }
  if (!g.playoff) {
    const homeWon = res.homeScore > res.awayScore
    const hc = league.coaches[league.teams[g.homeId].coachId]
    const ac = league.coaches[league.teams[g.awayId].coachId]
    if (homeWon) { hc.wins++; ac.losses++ } else { hc.losses++; ac.wins++ }
  }
  afterGame(league, g)
}

/**
 * CPU coaches re-pick their depth charts as ratings move. The user's rotation is theirs to manage, unless they
 * ticked "let the coach handle it", in which case it is re-picked like everyone else's.
 */
export function refreshAiRotations(league: League): void {
  const byTeam: Record<string, Player[]> = {}
  for (const p of Object.values(league.players)) if (p.teamId) (byTeam[p.teamId] ??= []).push(p)
  for (const t of Object.values(league.teams)) {
    if (!byTeam[t.id]) continue
    if (t.id !== league.userTeamId) t.rotation = autoRotation(byTeam[t.id])
    else if (t.rotation.auto) t.rotation = coachRotation(byTeam[t.id])
  }
}

/** Before every game day: a user on auto gets the coach's best healthy-aware depth chart and minutes. */
function autoUserRotation(league: League): void {
  const t = league.teams[league.userTeamId]
  if (!t?.rotation.auto) return
  const roster = Object.values(league.players).filter((p) => p.teamId === t.id)
  if (roster.length) t.rotation = coachRotation(roster)
}

/** Mutates `league`: plays the current day and advances the calendar. Returns true when the user should look (a trade offer, or All-Star Weekend just got set). */
function stepDay(league: League, rng: Rng, capture?: Capture): boolean {
  if (league.phase === 'offseason') return false
  const newsFrom = league.news.length, txFrom = league.transactions.length
  let allStarNow = false
  const played: Game[] = []
  autoUserRotation(league)
  // Skipped the All-Star Weekend broadcast: the games play themselves.
  if (league.phase === 'regular') playPendingAllStar(league)
  for (const g of league.games) {
    if (g.day === league.day && !g.result && (league.phase === 'playoffs') === (g.playoff !== null)) {
      playGame(league, g, rng, capture)
      played.push(g)
    }
  }
  processWaivers(league)
  if (league.phase === 'regular') {
    if (league.day % 7 === 0 && league.day <= league.tradeDeadlineDay) aiTrades(league, rng, 3)
    aiFillRosters(league)
    if (league.day === league.allStarDay && selectAllStars(league)) allStarNow = true
    if (league.day % PROGRESS_EVERY === 0) {
      const evs = progressTick(league, rng)
      league.progress.push(...evs)
      for (const e of evs) if (e.breakout) onBreakout(league, league.players[e.playerId], e.breakout.potFrom)
      pruneTraining(league)
      refreshAiRotations(league)
    }
    if (!league.games.some((g) => !g.playoff && !g.result)) {
      onRegularSeasonEnd(league)
      league.phase = 'playoffs'
      league.playoffs = seedPlayoffs(league)
      advancePlayoffs(league)
    }
  } else {
    const decided = new Set(league.playoffs?.series.filter((x) => x.winnerId).map((x) => x.id))
    advancePlayoffs(league)
    onSeriesDecided(league, (league.playoffs?.series ?? []).filter((x) => x.winnerId && !decided.has(x.id)).map((x) => x.id))
    if ((league.phase as Phase) === 'offseason') {
      onSeasonEnd(league)
      startOffseason(league, rng)
      afterDay(league, played, newsFrom, txFrom)
      return false
    }
  }
  const offer = afterDay(league, played, newsFrom, txFrom)
  league.day++
  return offer || allStarNow
}

/** `stopOnOffer`: pause when a CPU team sends the user a trade offer (the app does; scripts and tests don't). */
export interface SimOpts { stopOnOffer?: boolean }

export function simDays(league: League, days: number, opts: SimOpts = {}): League {
  if (league.phase === 'offseason') return league
  const next = structuredClone(league)
  const rng = new Rng(next.rng)
  const phase = next.phase
  for (let i = 0; i < days && next.phase === phase; i++) if (stepDay(next, rng) && opts.stopOnOffer) break
  return next
}

/** Plays one day exactly like `simDays(league, 1)`, also capturing the user's game as a play log (null on an off day). */
export function watchDay(league: League, opts: SimOpts = {}): { league: League; watch: WatchCapture | null } {
  if (league.phase === 'offseason') return { league, watch: null }
  void opts // a single day pauses after one step whether or not an offer arrives
  const next = structuredClone(league)
  const rng = new Rng(next.rng)
  const capture: Capture = { teamId: next.userTeamId, out: null }
  stepDay(next, rng, capture)
  return { league: next, watch: capture.out }
}

/** The user's undecided series in the current bracket, if any. */
export function userSeries(league: League): Series | null {
  return league.playoffs?.series.find((s) => !s.winnerId && (s.highSeedId === league.userTeamId || s.lowSeedId === league.userTeamId)) ?? null
}

export function simUntil(league: League, target: 'regularEnd' | 'playoffsEnd' | 'deadline' | 'seriesEnd', opts: SimOpts = {}): League {
  if (league.phase === 'offseason') return league
  const seriesId = target === 'seriesEnd' ? userSeries(league)?.id : undefined
  if (target === 'seriesEnd' && !seriesId) return league
  const next = structuredClone(league)
  const rng = new Rng(next.rng)
  const done = () =>
    target === 'seriesEnd' ? next.phase === 'offseason' || !!next.playoffs?.series.find((s) => s.id === seriesId)?.winnerId :
    target === 'deadline' ? next.phase !== 'regular' || next.day >= next.tradeDeadlineDay
    : target === 'regularEnd' ? next.phase !== 'regular' : next.phase === 'offseason'
  // A trade offer for the user pauses the sim so they can answer it.
  for (let guard = 0; !done() && guard < 1000; guard++) if (stepDay(next, rng) && opts.stopOnOffer) break
  return next
}

/** Offseason steps run off the main thread too: one step forward, or some free-agency days. */
export function offseasonStep(league: League, cmd: { type: 'offseason' } | { type: 'faDays'; days: number }): League {
  const next = structuredClone(league)
  const rng = new Rng(next.rng)
  const newsFrom = next.news.length, txFrom = next.transactions.length
  // Free-agency days post their own stories day by day.
  const faStep = cmd.type === 'faDays' || next.offseason?.step === 'freeAgency'
  if (cmd.type === 'offseason') advanceOffseason(next, rng)
  else simFreeAgency(next, rng, cmd.days)
  if (!faStep) afterOffseason(next, newsFrom, txFrom, false)
  return next
}
