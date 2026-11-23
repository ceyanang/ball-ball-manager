import { MAX_SALARY, MIN_SALARY } from '../constants'
import { salaryForPlayer } from '../contracts'
import { performance } from '../player/progress'
import { computeStandings } from '../standings'
import type { DraftPick, League, Player } from '../types'
import { capSeason, ovr, teamPlayers } from './cap'
import { memo, resultsStamp, rosterStamp } from './cache'

/** Asking salary (thousands): market rate, youth premium, last season's form and mood. */
export function askSalary(l: League, p: Player, perf?: Record<string, number>): number {
  let s = salaryForPlayer(p)
  if (p.age <= 24) s += Math.max(0, p.pot - ovr(p)) * 250
  const form = (perf ?? formOf(l))[p.id] ?? 0
  s *= 1 + form * 0.2
  s *= 1 + (50 - p.morale) / 500
  return Math.max(MIN_SALARY, Math.min(MAX_SALARY, Math.round(s / 100) * 100))
}

/** Last-season form vs similar-OVR players (cached). */
export const formOf = (l: League) => memo(l, 'form', resultsStamp(l), () => performance(l))
/** Standings rows, all 30 teams (cached). */
export const standingsOf = (l: League) => memo(l, 'standings', resultsStamp(l), () => {
  const st = computeStandings(l, l.season)
  return [...st.East, ...st.West]
})

export const askYears = (p: Player) => (p.age <= 25 ? 4 : p.age <= 30 ? 3 : p.age <= 33 ? 2 : 1)

export type Mode = 'contend' | 'rebuild'

const strength = (l: League, id: string) => {
  const top = teamPlayers(l, id).map(ovr).sort((a, b) => b - a).slice(0, 8)
  return top.reduce((a, b) => a + b, 0) / Math.max(1, top.length)
}

/** Teams ranked strongest first by their top-8 OVR (cached per roster state). */
export const strengthOrder = (l: League) =>
  memo(l, 'strength', rosterStamp(l), () => {
    const s = Object.fromEntries(Object.keys(l.teams).map((id) => [id, strength(l, id)]))
    return Object.keys(l.teams).sort((a, b) => s[b] - s[a])
  })

/** Contenders chase wins now; everyone else builds for later. */
export function teamMode(l: League, teamId: string): Mode {
  if (l.phase === 'regular') {
    const row = standingsOf(l).find((r) => r.teamId === teamId)
    if (row && row.w + row.l >= 10) return row.pct >= 0.5 ? 'contend' : 'rebuild'
  }
  return strengthOrder(l).indexOf(teamId) < 12 ? 'contend' : 'rebuild'
}

const talent = (o: number) => Math.max(0, o - 50) ** 2.3 / 100

/** Trade value of a player to a team in `mode`. Deterministic so the same ask always gets the same answer. */
export function playerValue(l: League, p: Player, mode: Mode): number {
  const o = ovr(p)
  // Contenders care about this season, so age bites far more gently than for a rebuilder playing the long game.
  const ageMult = p.age <= 30 ? 1 : mode === 'contend' ? Math.max(0.3, 1 - 0.065 * (p.age - 30)) : Math.max(0.15, 1 - 0.13 * (p.age - 30))
  const now = talent(o) * ageMult
  const fut = p.age <= 25 ? (talent(Math.max(o, p.pot)) - talent(o)) * Math.min(1, 0.35 + 0.1 * (25 - p.age)) : 0
  let v = mode === 'contend' ? now * 1.15 + fut * 0.5 : now * 0.85 + fut * 1.1
  if (p.contract) {
    const years = Math.max(1, p.contract.expires - capSeason(l) + 1)
    v += ((salaryForPlayer(p) - p.contract.salary) / 1000) * Math.min(3, years) * 0.25
  }
  if (p.injury && p.injury.gamesRemaining > 10) v *= Math.max(0.3, 1 - p.injury.gamesRemaining / 60)
  return Math.max(-15, v)
}

/** Where a pick is likely to land (1–30 within its round). Uses the real order once the lottery has run. */
export function projectedSlot(l: League, pick: DraftPick): number {
  const slot = l.draft?.season === pick.season ? l.draft.order.find((s) => s.pickId === pick.id) : undefined
  if (slot) return slot.round === 1 ? slot.pick : slot.pick - 30
  const rows = [...standingsOf(l)].sort((a, b) => a.pct - b.pct || a.w - b.w)
  const rank = rows.findIndex((r) => r.teamId === pick.originalTeamId) + 1 || 15
  const played = rows.some((r) => r.w + r.l > 0)
  return pick.season === l.season && played ? rank : Math.round((rank + 15.5) / 2)
}

export function pickValue(l: League, pick: DraftPick, mode: Mode): number {
  const slot = projectedSlot(l, pick)
  let v = pick.round === 1 ? 15 * Math.exp(-slot / 9) + 1 : 0.8
  if (pick.season > l.season) v *= 0.85
  return v * (mode === 'rebuild' ? 1.3 : 0.8)
}
