import { ovr, teamPlayers } from '../gm/cap'
import { askSalary, standingsOf, strengthOrder } from '../gm/value'
import type { BoxLine, Game, League, Player } from '../types'
import { clamp } from './state'

export const gameScore = (b: Pick<BoxLine, 'pts' | 'fgm' | 'fga' | 'fta' | 'ftm' | 'oreb' | 'dreb' | 'stl' | 'ast' | 'blk' | 'pf' | 'tov'>) =>
  b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.oreb + 0.3 * b.dreb + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov

/**
 * Game score fans expect from a player of this OVR in these minutes: calibrated to what the sim actually produces
 * per 36 (≈10 for role players, ≈15 at 80, ≈30 at 96), shaded a touch low so a normal night reads as fine, not a flop.
 */
export const expectedGameScore = (o: number, min: number) => (9.3 + Math.max(0, o - 62) ** 2 * 0.016) * (min / 36)

/** How much the recent-games buzz moves the shown fan score on top of the long-term following. */
const BUZZ_WEIGHT = 0.5
/** Short-term buzz from recent games and moments (stored in `fans.players`). */
export const buzzOf = (l: League, playerId: string) => l.fans.players[playerId] ?? 0
/** Long-term following: tenure, loyalty, stardom, season form, hardware (stored in `fans.base`). */
export const baseFanOf = (l: League, playerId: string) => l.fans.base?.[playerId] ?? 0
/** What fans think of a player right now: his long-term following plus the buzz from recent games. */
export const fanOf = (l: League, playerId: string) => Math.round(clamp(baseFanOf(l, playerId) + buzzOf(l, playerId) * BUZZ_WEIGHT, -100, 100))
export const teamFan = (l: League, teamId: string) => l.fans.teams[teamId] ?? 0

export interface FanLabel { emoji: string; text: string }
export function fanLabel(v: number): FanLabel {
  if (v >= 70) return { emoji: '🐐', text: 'Franchise icon' }
  if (v >= 45) return { emoji: '🔥', text: 'Fan favorite' }
  if (v >= 20) return { emoji: '👏', text: 'Liked' }
  if (v > -15) return { emoji: '😐', text: 'Neutral' }
  if (v > -40) return { emoji: '😒', text: 'Restless' }
  return { emoji: '🥶', text: 'Getting roasted' }
}

/** One reason fans feel the way they do about a player. */
export interface FanFactor { label: string; value: number }

interface CareerScan { teams: Set<string>; seasonsWith: Map<string, Set<number>>; season: { gp: number; min: number; gs: number; pm: number } | null }

function scanCareers(l: League): Map<string, CareerScan> {
  const out = new Map<string, CareerScan>()
  // This season's team +/- per player-minute, so a bench guy isn't blamed for a bad team (or carried by a good one).
  const team = new Map<string, { pm: number; min: number }>()
  for (const s of Object.values(l.statLines)) {
    if (s.playoffs || s.season !== l.season) continue
    const t = team.get(s.teamId) ?? { pm: 0, min: 0 }
    t.pm += s.pm; t.min += s.min
    team.set(s.teamId, t)
  }
  for (const s of Object.values(l.statLines)) {
    if (s.playoffs || s.gp <= 0) continue
    let c = out.get(s.playerId)
    if (!c) out.set(s.playerId, (c = { teams: new Set(), seasonsWith: new Map(), season: null }))
    c.teams.add(s.teamId)
    let set = c.seasonsWith.get(s.teamId)
    if (!set) c.seasonsWith.set(s.teamId, (set = new Set()))
    set.add(s.season)
    if (s.season === l.season) {
      const t = team.get(s.teamId)
      const cur = (c.season ??= { gp: 0, min: 0, gs: 0, pm: 0 })
      cur.pm -= (t && t.min ? t.pm / t.min : 0) * s.min * 0.7 // mostly on/off-style impact, a bit of raw +/-
      cur.gp += s.gp; cur.min += s.min; cur.pm += s.pm; cur.gs += gameScore(s)
    }
  }
  return out
}

interface Hardware { allStar: number; awards: number; rings: Map<string, number> }

function hardware(l: League): Map<string, Hardware> {
  const out = new Map<string, Hardware>()
  const get = (id: string) => {
    let h = out.get(id)
    if (!h) out.set(id, (h = { allStar: 0, awards: 0, rings: new Map() }))
    return h
  }
  for (const ev of l.allStars) if (ev.kind === 'allstar') for (const id of Object.keys(ev.votes)) get(id).allStar++
  for (const a of l.awards) {
    for (const id of [a.mvp, a.dpoy, a.smoy, a.finalsMvp, a.mip, a.roy]) if (id) get(id).awards++
    for (const team of a.allLeague) for (const id of team) get(id).awards += 0.5
    if (a.championId) for (const id of a.championRoster) { const h = get(id); h.rings.set(a.championId, (h.rings.get(a.championId) ?? 0) + 1) }
  }
  return out
}

/** The pieces of a player's long-term following (rostered players only). */
function fanFactors(l: League, p: Player, c: CareerScan | undefined, h: Hardware | undefined): FanFactor[] {
  if (!p.teamId) return []
  const f: FanFactor[] = []
  const o = ovr(p)
  // Stardom: everyone loves a star; scrubs aren't hated for it.
  const star = clamp((o - 62) * 1.3, -4, 30)
  if (Math.abs(star) >= 1) f.push({ label: o >= 75 ? 'Star power' : o >= 66 ? 'Solid player' : 'Low profile', value: star })
  // Tenure with this team, and homegrown bonus.
  const seasons = c?.seasonsWith.get(p.teamId)?.size ?? 0
  if (seasons >= 2) f.push({ label: `${seasons} seasons here`, value: Math.min(seasons - 1, 8) * 5 })
  if (p.draft?.teamId === p.teamId) f.push({ label: 'Homegrown', value: 8 })
  // Team hopping: many stops and short stints make fans wary.
  const stops = c?.teams.size ?? 1
  const hopRate = stops / Math.max(1, (c ? new Set([...c.seasonsWith.values()].flatMap((s) => [...s])).size : 1))
  if (stops >= 3 && hopRate > 0.45) f.push({ label: `Journeyman (${stops} teams)`, value: -clamp((stops - 2) * 5 * hopRate, 0, 18) })
  // This season's form vs what his rating promises.
  const s = c?.season
  if (s && s.gp >= 5) {
    const mpg = s.min / s.gp
    const form = clamp(((s.gs / s.gp) - expectedGameScore(o, mpg)) * 2.2, -14, 16)
    if (Math.abs(form) >= 2) f.push({ label: form > 0 ? 'Overachieving' : 'Underperforming', value: form })
    // Plus/minus: the bench guy whose minutes always swing games.
    const pm = s.pm / s.gp
    const pmv = clamp(pm * 1.8 * clamp(mpg / 20, 0.6, 1.4), -8, 16)
    if (Math.abs(pmv) >= 2) f.push({ label: pm > 0 ? (mpg < 24 ? 'Bench cult hero' : 'Winning minutes') : 'Bleeds points', value: pmv })
  }
  // Hardware: All-Star nods, awards, and rings won for this franchise.
  if (h) {
    const hw = Math.min(h.allStar * 3 + h.awards * 3, 14)
    if (hw >= 1) f.push({ label: 'Accolades', value: hw })
    const rings = h.rings.get(p.teamId) ?? 0
    if (rings) f.push({ label: `${rings}× champ here`, value: Math.min(rings * 12, 24) })
  }
  // A winning team's fans are happier with everybody.
  const tf = teamFan(l, p.teamId) * 0.08
  if (Math.abs(tf) >= 1) f.push({ label: tf > 0 ? 'Team is rolling' : 'Team is slumping', value: tf })
  return f.map((x) => ({ ...x, value: Math.round(x.value) })).filter((x) => x.value !== 0)
}

/** Recompute every rostered player's long-term following. Run weekly, and after roster moves/offseason steps. */
export function recomputeFanBase(l: League): void {
  const careers = scanCareers(l)
  const hw = hardware(l)
  const base: Record<string, number> = {}
  for (const p of Object.values(l.players)) {
    if (p.retired || !p.teamId) continue
    const v = fanFactors(l, p, careers.get(p.id), hw.get(p.id)).reduce((a, x) => a + x.value, 0)
    if (v) base[p.id] = Math.round(clamp(v, -60, 90))
  }
  l.fans.base = base
}

/** Why fans feel the way they do about one player, biggest reasons first. */
export function fanBreakdown(l: League, p: Player): FanFactor[] {
  const careers = scanCareers(l)
  const out = fanFactors(l, p, careers.get(p.id), hardware(l).get(p.id))
  const buzz = Math.round(buzzOf(l, p.id) * BUZZ_WEIGHT)
  if (Math.abs(buzz) >= 1) out.push({ label: buzz > 0 ? 'Hot lately' : 'Cold lately', value: buzz })
  return out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
}

/** Fans react to every game: players vs what their OVR suggests (and +/-), teams to results (upsets count double). */
export function updateFans(l: League, g: Game): void {
  const r = g.result
  if (!r) return
  const homeWon = r.homeScore > r.awayScore
  for (const b of r.box) {
    if (b.min < 6) continue
    const p = l.players[b.playerId]
    if (!p) continue
    const won = (b.teamId === g.homeId) === homeWon
    const perf = (gameScore(b) - expectedGameScore(ovr(p), b.min)) / 8 + b.pm / 15 + (won ? 0.1 : -0.05)
    l.fans.players[p.id] = Math.round(clamp(buzzOf(l, p.id) * 0.85 + clamp(perf, -1, 1) * 15, -100, 100))
  }
  const order = strengthOrder(l)
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
