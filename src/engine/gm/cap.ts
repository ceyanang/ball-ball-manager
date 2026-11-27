import { ACTIVE_MAX, MIN_SALARY, ROSTER_MAX, ROSTER_MIN, SALARY_CAP, STARTERS } from '../constants'
import { ovrOf } from '../career/careerOvr'
import { autoRotation, coachRotation, rescaleMinutes } from '../sim/rotation'
import type { League, Player, Rotation, TxType } from '../types'

export const ovr = (p: Player): number => ovrOf(p)
export const money = (k: number) => (Math.abs(k) >= 1000 ? `$${(k / 1000).toFixed(1)}M` : `$${k}K`)

/** Thrown by GM actions with a message that can be shown to the user as-is. */
export class GmError extends Error {}

/** The season payroll is measured against: next season during the offseason. */
export const capSeason = (l: League) => (l.phase === 'offseason' ? l.season + 1 : l.season)

/** Everyone wearing the team's uniform, including offseason players whose deals are ending. */
export const teamPlayers = (l: League, teamId: string) => Object.values(l.players).filter((p) => p.teamId === teamId && !p.retired)

/** Players under contract for the cap season: the roster that counts. */
export const committed = (l: League, teamId: string) =>
  teamPlayers(l, teamId).filter((p) => p.contract && p.contract.expires >= capSeason(l))

export function deadMoneyFor(l: League, teamId: string): number {
  const s = capSeason(l)
  return l.deadMoney.filter((d) => d.teamId === teamId && d.expires >= s).reduce((t, d) => t + d.salary, 0)
}

export function payroll(l: League, teamId: string): number {
  return committed(l, teamId).reduce((t, p) => t + p.contract!.salary, 0) + deadMoneyFor(l, teamId)
}

export interface CapChange { addSalary?: number; addCount?: number; removeSalary?: number; removeCount?: number }

/** Hard cap + roster-fill reserve rule (spec §12). Returns a reason the move is illegal, or null. */
export function capProblem(l: League, teamId: string, ch: CapChange, who = 'This'): string | null {
  const roster = committed(l, teamId).length + (ch.addCount ?? 0) - (ch.removeCount ?? 0)
  if (roster > ROSTER_MAX) return `${who} would put the roster over ${ROSTER_MAX} players.`
  const pay = payroll(l, teamId) + (ch.addSalary ?? 0) - (ch.removeSalary ?? 0)
  if (pay > SALARY_CAP) return `${who} would put the payroll over the ${money(SALARY_CAP)} cap.`
  const reserve = Math.max(0, ROSTER_MIN - roster) * MIN_SALARY
  if (pay + reserve > SALARY_CAP)
    return `${who} leaves ${money(SALARY_CAP - pay)}, but ${money(reserve)} is needed to fill out ${ROSTER_MIN} players.`
  return null
}

export const capRoom = (l: League, teamId: string) => SALARY_CAP - payroll(l, teamId)

export function log(l: League, type: TxType, teamIds: string[], playerIds: string[], text: string): void {
  l.transactions.push({ season: l.season, day: l.day, phase: l.phase, type, teamIds, playerIds, text })
}

export const pname = (p: Player) => `${p.firstName} ${p.lastName}`
export const tname = (l: League, teamId: string) => l.teams[teamId].name

/**
 * Keeps the user's order and starters, drops departed players and slots newcomers into the bench by OVR (so a star
 * signing sits at the top of the bench, never buried at the end). A minutes plan is kept: newcomers get the coach's
 * share for their bench spot and the whole plan is rescaled to 240.
 */
export function syncRotation(rot: Rotation, roster: Player[]): Rotation {
  const byId: Record<string, Player> = Object.fromEntries(roster.map((p) => [p.id, p]))
  const keep = (xs: string[]) => xs.filter((id) => byId[id])
  const next: Rotation = { starters: keep(rot.starters), bench: keep(rot.bench), inactive: keep(rot.inactive) }
  if (rot.auto) next.auto = true
  const listed = new Set([...next.starters, ...next.bench, ...next.inactive])
  const fresh = roster.filter((p) => !listed.has(p.id)).sort((a, b) => ovr(b) - ovr(a))
  for (const p of fresh) {
    const at = next.bench.findIndex((id) => ovr(byId[id]) < ovr(p))
    if (at >= 0) next.bench.splice(at, 0, p.id)
    else if (next.starters.length + next.bench.length < ACTIVE_MAX) next.bench.push(p.id)
    else next.inactive.push(p.id)
  }
  while (next.starters.length < STARTERS && (next.bench.length || next.inactive.length))
    next.starters.push((next.bench.length ? next.bench : next.inactive).shift()!)
  while (next.starters.length + next.bench.length > ACTIVE_MAX) next.inactive.unshift(next.bench.pop()!)
  if (rot.minutes) {
    const wasActive = new Set([...rot.starters, ...rot.bench])
    const active = [...next.starters, ...next.bench]
    const same = active.length === wasActive.size && active.every((id) => wasActive.has(id))
    if (same) next.minutes = { ...rot.minutes }
    else {
      // Only players who were active keep their planned minutes; everyone else gets the default for his spot.
      const plan: Record<string, number> = {}
      for (const id of active) if (wasActive.has(id) && rot.minutes[id] !== undefined) plan[id] = rot.minutes[id]
      next.minutes = rescaleMinutes(next, byId, plan)
    }
  }
  return next
}

/** After any roster move: CPU teams (and a user on auto) re-plan; the user's own depth chart is kept and patched. */
export function refreshRotation(l: League, teamId: string): void {
  const roster = teamPlayers(l, teamId)
  const t = l.teams[teamId]
  if (teamId !== l.userTeamId) t.rotation = autoRotation(roster)
  else t.rotation = t.rotation.auto ? coachRotation(roster) : syncRotation(t.rotation, roster)
}

export function tradesOpen(l: League): boolean {
  return (l.phase === 'regular' && l.day <= l.tradeDeadlineDay) || l.phase === 'offseason'
}

export const onWaivers = (l: League, playerId: string) => l.waivers.some((w) => w.playerId === playerId)

/** Not on a team, not retired, not a prospect, not held as draft rights, not on waivers. */
export function isFreeAgent(l: League, p: Player): boolean {
  return !p.teamId && !p.retired && !l.draftRights[p.id] && !(l.draft?.prospects.includes(p.id) ?? false) && !onWaivers(l, p.id)
}
