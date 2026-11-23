import { ACTIVE_MAX } from '../constants'
import { ovr, pname } from '../gm/cap'
import { Rng } from '../rng'
import { bestStartingFive } from '../sim/rotation'
import { simGame } from '../sim/game'
import type { PlayEvent } from '../sim/playlog'
import { computeStandings } from '../standings'
import { addNews, isRookie, isSophomore } from '../stories/highlights'
import { ping } from '../stories/inbox'
import { fanOf, gameScore, popularity } from '../stories/sentiment'
import { clamp, storyRng } from '../stories/state'
import type { AllStarEvent, AllStarKind, Conference, Game, League, Player, Team } from '../types'

/** Players per side. */
export const SIDE_SIZE = ACTIVE_MAX
const ALL_STAR_STARTERS = 5
/** The Rising Stars game needs at least this many eligible youngsters per class. */
const RISING_MIN_PER_SIDE = 6
const RISING_SIZE = 10

/** Mid-season: the halfway day of the regular schedule. */
export function allStarDayFor(games: Game[], season: number): number {
  let last = 0
  for (const g of games) if (g.season === season && !g.playoff && g.day > last) last = g.day
  return last ? Math.max(1, Math.round(last / 2)) : 0
}

const isGuard = (p: Player) => p.pos === 'PG' || p.pos === 'SG'
/** Second-year players; in season 1 (no drafts yet) the slightly older young players stand in for the class. */
const isSoph = (l: League, p: Player) => isSophomore(l, p) || (!p.draft && l.season === 1 && p.age >= 22 && p.age <= 23)

interface Form { gsPg: number; mpg: number; gp: number }

/** Season-to-date production per player (regular season only). */
function formThisSeason(l: League): Record<string, Form> {
  const acc: Record<string, { gs: number; min: number; gp: number }> = {}
  for (const s of Object.values(l.statLines)) {
    if (s.season !== l.season || s.playoffs) continue
    const a = (acc[s.playerId] ??= { gs: 0, min: 0, gp: 0 })
    a.gs += gameScore(s)
    a.min += s.min
    a.gp += s.gp
  }
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, { gsPg: a.gp ? a.gs / a.gp : 0, mpg: a.gp ? a.min / a.gp : 0, gp: a.gp }]))
}

/**
 * How the fans see a player: production first, then how much his team wins, then his fame. OVR barely matters —
 * winners on winning teams get watched the most.
 */
function voteScore(l: League, p: Player, f: Form, pct: number): number {
  return f.gsPg + (pct - 0.5) * 24 + fanOf(l, p.id) * 0.12 + (popularity(l, p) - 20) * 0.05 + (ovr(p) - 70) * 0.1
}

const votesFor = (score: number) => Math.round(Math.max(1, score + 10) ** 1.8 * 220)

interface Cand { p: Player; score: number }

/** Two guards and three frontcourt players start; the rest of the squad is the next best by vote. */
function pickSquad(cands: Cand[], size: number): Cand[] {
  const sorted = [...cands].sort((a, b) => b.score - a.score)
  const guards = sorted.filter((c) => isGuard(c.p)).slice(0, 2)
  const fronts = sorted.filter((c) => !isGuard(c.p)).slice(0, 3)
  const starters = [...guards, ...fronts]
  if (starters.length < ALL_STAR_STARTERS) for (const c of sorted) if (starters.length < ALL_STAR_STARTERS && !starters.includes(c)) starters.push(c)
  const rest = sorted.filter((c) => !starters.includes(c)).slice(0, Math.max(0, size - starters.length))
  return [...starters, ...rest]
}

const COLORS: Record<string, { city: string; name: string; abbrev: string; primary: string; secondary: string }> = {
  East: { city: 'East', name: 'All-Stars', abbrev: 'EST', primary: '#1d4ed8', secondary: '#ffffff' },
  West: { city: 'West', name: 'All-Stars', abbrev: 'WST', primary: '#c81e3a', secondary: '#ffd34d' },
  Rookies: { city: 'Rookies', name: 'Rising Stars', abbrev: 'RKI', primary: '#15803d', secondary: '#ffffff' },
  Sophs: { city: 'Sophomores', name: 'Rising Stars', abbrev: 'SOP', primary: '#7c3aed', secondary: '#ffffff' },
}

function makeTeam(l: League, key: keyof typeof COLORS, kind: AllStarKind, conf: Conference, squad: Cand[], coachId: string): Team {
  const c = COLORS[key]
  const five = bestStartingFive(squad.slice(0, ALL_STAR_STARTERS).map((x) => x.p))
  const starters = five.map((p) => p.id)
  const rest = squad.filter((x) => !starters.includes(x.p.id)).sort((a, b) => b.score - a.score).map((x) => x.p.id)
  return {
    id: `asg-${kind}-${key.toLowerCase()}-${l.season}`, city: c.city, name: c.name, abbrev: c.abbrev, conf,
    colors: { primary: c.primary, secondary: c.secondary }, coachId,
    rotation: { starters, bench: rest.slice(0, ACTIVE_MAX - starters.length), inactive: rest.slice(ACTIVE_MAX - starters.length) },
  }
}

const healthy = (p: Player) => !p.injury || p.injury.severity === 'dtd'

/**
 * Picks the All-Star and Rising Stars squads and queues both games. Returns true when a new pair was just set up
 * (the sim pauses so the user can watch).
 */
export function selectAllStars(l: League): boolean {
  if (l.allStars.some((e) => e.season === l.season)) return false
  const form = formThisSeason(l)
  const st = computeStandings(l, l.season)
  const pct: Record<string, number> = {}
  for (const r of [...st.East, ...st.West]) pct[r.teamId] = r.w + r.l ? r.pct : 0.5
  const all = Object.values(l.players).filter((p) => p.teamId && !p.retired && healthy(p))
  const cand = (p: Player): Cand | null => {
    const f = form[p.id]
    if (!f || f.gp < 3 || f.mpg < 10) return null
    return { p, score: voteScore(l, p, f, pct[p.teamId!] ?? 0.5) }
  }

  const events: AllStarEvent[] = []
  const votes: Record<string, number> = {}
  const squads = {} as Record<Conference, Cand[]>
  for (const conf of ['East', 'West'] as Conference[]) {
    const cs = all.filter((p) => l.teams[p.teamId!].conf === conf).map(cand).filter((c): c is Cand => !!c)
    squads[conf] = pickSquad(cs, SIDE_SIZE)
    for (const c of squads[conf]) votes[c.p.id] = votesFor(c.score)
  }
  // Coaches: whoever runs each conference's top seed.
  const coachOf = (conf: Conference) => l.teams[st[conf][0].teamId].coachId
  events.push({
    season: l.season, kind: 'allstar', day: l.day,
    teams: [makeTeam(l, 'East', 'allstar', 'East', squads.East, coachOf('East')), makeTeam(l, 'West', 'allstar', 'West', squads.West, coachOf('West'))],
    votes, result: null, mvp: null,
  })

  const young = all.map(cand).filter((c): c is Cand => !!c && (isRookie(l, c.p) || isSoph(l, c.p)))
  const rookies = young.filter((c) => isRookie(l, c.p))
  const sophs = young.filter((c) => !isRookie(l, c.p))
  if (rookies.length >= RISING_MIN_PER_SIDE && sophs.length >= RISING_MIN_PER_SIDE) {
    const rv: Record<string, number> = {}
    const r = pickSquad(rookies, RISING_SIZE), s = pickSquad(sophs, RISING_SIZE)
    for (const c of [...r, ...s]) rv[c.p.id] = votesFor(c.score)
    events.push({
      season: l.season, kind: 'rising', day: l.day,
      teams: [makeTeam(l, 'Rookies', 'rising', 'East', r, ''), makeTeam(l, 'Sophs', 'rising', 'West', s, '')],
      votes: rv, result: null, mvp: null,
    })
  }
  l.allStars.push(...events)

  const main = events[0]
  const ids = main.teams.flatMap((t) => [...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive])
  const mine = ids.filter((id) => l.players[id].teamId === l.userTeamId)
  addNews(l, {
    kind: 'award', emoji: '🌟', title: 'All-Star rosters are set',
    text: `Fans and coaches have spoken: ${main.teams[0].rotation.starters.map((id) => pname(l.players[id])).join(', ')} start for the East; ${main.teams[1].rotation.starters.map((id) => pname(l.players[id])).join(', ')} for the West.`,
    playerIds: [...main.teams[0].rotation.starters, ...main.teams[1].rotation.starters], teamIds: [], weight: 7,
  })
  ping(
    l, 'award', `allstar:${l.season}`, mine.length ? `🌟 ${mine.length} of your players made the All-Star game` : '🌟 All-Star rosters are set',
    mine.length ? `${mine.map((id) => pname(l.players[id])).join(', ')} ${mine.length > 1 ? 'are' : 'is'} headed to All-Star Weekend. Watch the game, or just keep simming.` : 'See who the fans picked, then watch the game or keep simming.',
    '/all-star',
  )
  return true
}

/** The synthetic id of the side a user "plays" as: their conference's squad, or whichever Rising Stars class holds more of their guys. */
export function userSideIndex(l: League, ev: AllStarEvent): 0 | 1 {
  if (ev.kind === 'allstar') return l.teams[l.userTeamId].conf === ev.teams[0].conf ? 0 : 1
  const count = (t: Team) => [...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive].filter((id) => l.players[id]?.teamId === l.userTeamId).length
  return count(ev.teams[1]) > count(ev.teams[0]) ? 1 : 0
}

export const eventPlayerIds = (ev: AllStarEvent): string[] => ev.teams.flatMap((t) => [...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive])

/** The event as a Game, for the watch viewer. */
export const eventGame = (ev: AllStarEvent): Game => ({
  id: `asg-${ev.kind}-${ev.season}`, season: ev.season, day: ev.day, homeId: ev.teams[0].id, awayId: ev.teams[1].id, playoff: null, result: ev.result,
})

/** Plays a queued game. Doesn't count for stats, records or standings; it just gives morale, fan love and an MVP. */
export function playAllStarEvent(l: League, ev: AllStarEvent, log?: PlayEvent[]): void {
  if (ev.result) return
  const rng: Rng = storyRng(l, ev.kind === 'allstar' ? 7001 : 7002)
  const [a, b] = ev.teams
  ev.result = simGame(a, b, l.players, l.coaches, rng, log)
  const r = ev.result
  const winner = r.homeScore >= r.awayScore ? a : b
  const mine = r.box.filter((x) => x.teamId === winner.id && x.min > 0)
  const top = mine.sort((x, y) => gameScore(y) - gameScore(x))[0]
  ev.mvp = top?.playerId ?? null

  const allStar = ev.kind === 'allstar'
  const [morale, fans] = allStar ? [6, 10] : [4, 6]
  for (const id of eventPlayerIds(ev)) {
    const p = l.players[id]
    if (!p) continue
    p.morale = clamp(p.morale + morale, 0, 100)
    l.fans.players[id] = clamp(fanOf(l, id) + fans, -100, 100)
    if (p.teamId) l.fans.teams[p.teamId] = clamp((l.fans.teams[p.teamId] ?? 0) + (allStar ? 1 : 0), -100, 100)
  }
  if (ev.mvp) {
    const p = l.players[ev.mvp]
    p.morale = clamp(p.morale + 6, 0, 100)
    l.fans.players[ev.mvp] = clamp(fanOf(l, ev.mvp) + 12, -100, 100)
    const line = r.box.find((x) => x.playerId === ev.mvp)!
    const title = allStar ? 'All-Star Game MVP' : 'Rising Stars MVP'
    addNews(l, {
      kind: 'award', emoji: allStar ? '🌟' : '✨', title: `${pname(p)}: ${title}`,
      text: `${winner.city} ${winner.name === 'All-Stars' ? 'win' : 'wins'} ${Math.max(r.homeScore, r.awayScore)}–${Math.min(r.homeScore, r.awayScore)}. ${pname(p)} had ${line.pts} pts, ${line.oreb + line.dreb} reb and ${line.ast} ast.`,
      playerIds: [ev.mvp], teamIds: p.teamId ? [p.teamId] : [], weight: allStar ? 8 : 5,
    })
    if (p.teamId === l.userTeamId)
      ping(l, 'award', `asgmvp:${ev.kind}:${ev.season}`, `🏅 ${pname(p)}: ${title}`, `Your guy took home ${title}.`, `/player/${ev.mvp}`)
  }
}

/** Plays any queued game once its day has passed (the user just kept simming). */
export function playPendingAllStar(l: League): void {
  for (const ev of l.allStars) if (!ev.result && ev.season === l.season) playAllStarEvent(l, ev)
}

export const allStarSeasons = (l: League, playerId: string): number[] =>
  l.allStars.filter((e) => e.kind === 'allstar' && eventPlayerIds(e).includes(playerId)).map((e) => e.season)
export const allStarMvps = (l: League, playerId: string): AllStarEvent[] => l.allStars.filter((e) => e.mvp === playerId)
export const pendingAllStar = (l: League): AllStarEvent[] => l.allStars.filter((e) => e.season === l.season && !e.result)

/** Convenience for the UI: each squad's players as Player objects, starters first. */
export function squadOf(l: League, team: Team): Player[] {
  return [...team.rotation.starters, ...team.rotation.bench, ...team.rotation.inactive].map((id) => l.players[id]).filter(Boolean)
}
