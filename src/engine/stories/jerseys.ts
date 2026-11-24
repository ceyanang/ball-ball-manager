import { pname, tname } from '../gm/cap'
import { pickJersey } from '../player/jerseyNumber'
import type { League, Player, RetiredJersey } from '../types'
import { awardPoints, seasonStatPoints } from './awards'
import { addNews } from './highlights'
import { ping } from './inbox'
import { storyRng } from './state'

/**
 * Two ways to have a number retired by a team, judged on his years with that team only:
 *  - star: a big team-only score (the same math as the Hall of Fame);
 *  - loyal: a lower score, but a long stay and at least one title with that team (the Kyle Lowry door).
 * Each number a team has already retired raises both bars, so they stay rare.
 */
export const STAR_SCORE = 32
export const LOYAL_SCORE = 16
export const LOYAL_SEASONS = 7
export const BAR_STEP = 10
/** Games on a team that make a year count as a season there. */
const SEASON_MIN_GP = 20

export interface Stint { seasons: number; titles: number; score: number }

/** What one player did for one team: seasons, titles won with it, and a team-only career score. */
export function teamStint(l: League, playerId: string, teamId: string): Stint {
  const seasons = new Set<number>()
  let score = 0
  for (const s of Object.values(l.statLines)) {
    if (s.playerId !== playerId || s.teamId !== teamId || s.playoffs || s.gp <= 0) continue
    score += seasonStatPoints(s)
    if (s.gp >= SEASON_MIN_GP) seasons.add(s.season)
  }
  let titles = 0
  for (const a of l.awards) {
    // Awards only count for years he actually played for this team.
    if (!Object.values(l.statLines).some((s) => s.playerId === playerId && s.teamId === teamId && s.season === a.season && !s.playoffs && s.gp > 0)) continue
    score += awardPoints(a, playerId, teamId)
    if (a.championId === teamId && a.championRoster.includes(playerId)) titles++
  }
  return { seasons: seasons.size, titles, score: Math.round(score * 10) / 10 }
}

const retiredNumbers = (l: League, teamId: string) => new Set(l.retiredJerseys.filter((j) => j.teamId === teamId).map((j) => j.number))
const rosterNumbers = (l: League, teamId: string, exceptId?: string) =>
  new Set(Object.values(l.players).filter((p) => !p.retired && p.teamId === teamId && p.id !== exceptId).map((p) => p.jersey))

/** A current teammate wearing a number that was just retired picks a new one. */
export function renumberHolders(l: League, teamId: string, number: number, exceptId: string): void {
  const holders = Object.values(l.players).filter((p) => !p.retired && p.teamId === teamId && p.jersey === number && p.id !== exceptId)
  if (!holders.length) return
  const rng = storyRng(l, 0x6a65 + number)
  const taken = new Set([...rosterNumbers(l, teamId), ...retiredNumbers(l, teamId)])
  for (const p of holders) {
    p.jersey = pickJersey(rng, taken)
    taken.add(p.jersey)
  }
}

/** Nobody new wears a number his team retired: call after a player joins a team. */
export function renumberIfRetired(l: League, p: Player): void {
  if (!p.teamId || !retiredNumbers(l, p.teamId).has(p.jersey)) return
  const taken = new Set([...rosterNumbers(l, p.teamId, p.id), ...retiredNumbers(l, p.teamId)])
  p.jersey = pickJersey(storyRng(l, 0x6a66 + p.jersey), taken)
}

/** Retiring players get their number retired by each team he did enough for. Returns the new honors. */
export function evaluateJerseys(l: League, playerIds: string[], opts: { silent?: boolean } = {}): RetiredJersey[] {
  const out: RetiredJersey[] = []
  for (const id of playerIds) {
    const p = l.players[id]
    if (!p) continue
    const teams = [...new Set(Object.values(l.statLines).filter((s) => s.playerId === id && !s.playoffs).map((s) => s.teamId))].sort()
    for (const teamId of teams) {
      if (!l.teams[teamId] || l.retiredJerseys.some((j) => j.teamId === teamId && j.playerId === id)) continue
      const stint = teamStint(l, id, teamId)
      const count = l.retiredJerseys.filter((j) => j.teamId === teamId).length
      const star = stint.score >= STAR_SCORE + BAR_STEP * count
      const loyal = stint.score >= LOYAL_SCORE + BAR_STEP * count && stint.seasons >= LOYAL_SEASONS && stint.titles >= 1
      if (!star && !loyal) continue
      const jersey: RetiredJersey = {
        teamId, playerId: id, number: p.jersey, season: l.season,
        seasons: stint.seasons, titles: stint.titles, score: stint.score, door: star ? 'star' : 'loyal',
      }
      l.retiredJerseys.push(jersey)
      out.push(jersey)
      renumberHolders(l, teamId, p.jersey, id)
      if (opts.silent) continue
      const team = tname(l, teamId)
      addNews(l, {
        kind: 'award', emoji: '👕', title: `${team} retire ${pname(p)}'s #${p.jersey}`,
        text: `${pname(p)}'s #${p.jersey} will hang in the rafters after ${stint.seasons} seasons${stint.titles ? ` and ${stint.titles} title${stint.titles > 1 ? 's' : ''}` : ''} with ${team}.`,
        playerIds: [id], teamIds: [teamId], weight: 7,
      })
      if (teamId === l.userTeamId)
        ping(l, 'award', `jersey:${teamId}:${id}`, `👕 ${pname(p)}'s #${p.jersey} is retired`, `Your team has retired #${p.jersey} in honor of ${pname(p)}.`, '/history?tab=Jerseys')
    }
  }
  return out
}

/** Migration: honor players who retired before this feature existed, oldest retirement first and with no news or pings. */
export function backfillJerseys(l: League): void {
  const lastSeason = new Map<string, number>()
  for (const s of Object.values(l.statLines)) if (!s.playoffs) lastSeason.set(s.playerId, Math.max(lastSeason.get(s.playerId) ?? 0, s.season))
  const retirees = Object.values(l.players).filter((p) => p.retired && lastSeason.has(p.id))
    .sort((a, b) => lastSeason.get(a.id)! - lastSeason.get(b.id)! || a.id.localeCompare(b.id))
  for (const p of retirees)
    for (const j of evaluateJerseys(l, [p.id], { silent: true })) j.season = lastSeason.get(p.id)! + 1
}
