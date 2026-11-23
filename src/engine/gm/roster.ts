import { MIN_SALARY, ROSTER_MAX, ROSTER_MIN, SALARY_CAP } from '../constants'
import { generatePlayer } from '../player/generate'
import type { Rng } from '../rng'
import type { League, Player } from '../types'
import {
  GmError, capProblem, capSeason, committed, isFreeAgent, log, money, onWaivers, ovr, payroll, pname, refreshRotation, teamPlayers, tname,
} from './cap'
import { askSalary, askYears, formOf, playerValue, standingsOf, strengthOrder, teamMode } from './value'

/** Offseason free agency lasts this many days. */
export const FA_DAYS = 30
/** CPU teams keep at least this many players so injuries can't strand them. */
export const AI_ROSTER_TARGET = 13

const worstFirst = (l: League) => {
  return [...standingsOf(l)].sort((a, b) => a.pct - b.pct || a.w - b.w).map((r) => r.teamId)
}

/** Release: the player goes on waivers until the next sim tick. Expiring offseason deals just walk. */
export function releasePlayer(l: League, playerId: string): void {
  const p = l.players[playerId]
  if (!p?.teamId) throw new GmError('That player is not on a team.')
  const teamId = p.teamId
  if (!p.contract || p.contract.expires < capSeason(l)) {
    p.teamId = null
    p.contract = null
    log(l, 'release', [teamId], [p.id], `${tname(l, teamId)} let ${pname(p)} walk.`)
  } else {
    l.waivers.push({ playerId, fromTeamId: teamId, contract: { ...p.contract } })
    p.teamId = null
    log(l, 'release', [teamId], [p.id], `${tname(l, teamId)} waived ${pname(p)} (${money(p.contract.salary)} through ${p.contract.expires}).`)
  }
  refreshRotation(l, teamId)
}

/** Claim a player off waivers (whole contract moves). */
export function claimWaiver(l: League, teamId: string, playerId: string): void {
  const w = l.waivers.find((x) => x.playerId === playerId)
  if (!w) throw new GmError('That player is no longer on waivers.')
  if (w.fromTeamId === teamId) throw new GmError('You just released him.')
  const problem = capProblem(l, teamId, { addSalary: w.contract.salary, addCount: 1 }, 'Claiming him')
  if (problem) throw new GmError(problem)
  const p = l.players[playerId]
  p.teamId = teamId
  p.contract = { ...w.contract }
  l.waivers = l.waivers.filter((x) => x !== w)
  refreshRotation(l, teamId)
  log(l, 'claim', [teamId, w.fromTeamId], [p.id], `${tname(l, teamId)} claimed ${pname(p)} off waivers from ${tname(l, w.fromTeamId)}.`)
}

/** Resolve every pending waiver: worst record claims first, otherwise dead money and free agency. */
export function processWaivers(l: League): void {
  const order = worstFirst(l).filter((id) => id !== l.userTeamId)
  for (const w of [...l.waivers]) {
    const p = l.players[w.playerId]
    const yearsLeft = w.contract.expires - capSeason(l) + 1
    const claimer = order.find((id) => {
      if (id === w.fromTeamId || committed(l, id).length >= ROSTER_MAX) return false
      if (capProblem(l, id, { addSalary: w.contract.salary, addCount: 1 })) return false
      // Worth his contract: decent value after the contract term is priced in.
      return playerValue(l, { ...p, contract: w.contract }, teamMode(l, id)) > 3 + yearsLeft
    })
    if (claimer) {
      claimWaiver(l, claimer, w.playerId)
      continue
    }
    l.waivers = l.waivers.filter((x) => x !== w)
    if (w.contract.expires >= capSeason(l))
      l.deadMoney.push({ teamId: w.fromTeamId, playerId: p.id, salary: w.contract.salary, expires: w.contract.expires })
    p.contract = null
  }
}

/** The free agent's current ask; offseason asks fall 3% a day as free agency drags on. */
export function currentAsk(l: League, p: Player, perf?: Record<string, number>): number {
  const base = askSalary(l, p, perf)
  const day = l.offseason?.step === 'freeAgency' ? l.offseason.faDay : 0
  const decay = day > 1 ? Math.max(0.35, 1 - 0.03 * (day - 1)) : 1
  return Math.max(MIN_SALARY, Math.round((base * decay) / 100) * 100)
}

function sign(l: League, teamId: string, p: Player, salary: number, years: number, type: 'sign' | 'resign' = 'sign'): void {
  p.teamId = teamId
  p.contract = { salary, expires: capSeason(l) + years - 1 }
  l.faOffers = l.faOffers.filter((o) => o.playerId !== p.id)
  refreshRotation(l, teamId)
  const verb = type === 'resign' ? 're-signed' : 'signed'
  log(l, type, [teamId], [p.id], `${tname(l, teamId)} ${verb} ${pname(p)}: ${years} yr${years > 1 ? 's' : ''}, ${money(salary)}/yr.`)
}

function checkOffer(salary: number, years: number): void {
  if (!Number.isFinite(salary) || salary < MIN_SALARY) throw new GmError(`Offers start at the ${money(MIN_SALARY)} minimum.`)
  if (!Number.isInteger(years) || years < 1 || years > 5) throw new GmError('Contracts run 1 to 5 years.')
}

/**
 * The user (or AI) offers a free agent a deal. In season he decides on the spot (yes at ≥90% of his ask).
 * During offseason free agency the offer is lodged and he decides on the next free-agency day.
 */
export function offerFreeAgent(l: League, teamId: string, playerId: string, salary: number, years: number): 'signed' | 'pending' | 'rejected' {
  const p = l.players[playerId]
  if (!p || !isFreeAgent(l, p)) throw new GmError('He is not a free agent.')
  checkOffer(salary, years)
  const problem = capProblem(l, teamId, { addSalary: salary, addCount: 1 }, 'This offer')
  if (problem) throw new GmError(problem)
  if (l.phase === 'offseason') {
    const step = l.offseason?.step
    // Once free agency has run its course ('ready') no more days will pass, so a pending offer would never be
    // decided. Sign on the spot like in season, so a short roster can always be filled before the opener.
    if (step === 'freeAgency') {
      l.faOffers = l.faOffers.filter((o) => !(o.playerId === playerId && o.teamId === teamId))
      l.faOffers.push({ playerId, teamId, salary, years })
      return 'pending'
    }
    if (step !== 'ready') throw new GmError('Free agency opens after the re-signing period.')
  }
  if (salary < currentAsk(l, p) * 0.9) return 'rejected'
  sign(l, teamId, p, salary, years)
  return 'signed'
}

/** A player's view of an offer: money first, then winning and a real role. */
function offerScore(l: League, p: Player, o: { teamId: string; salary: number; years: number }, rank: string[]): number {
  const quality = 1 - rank.indexOf(o.teamId) / 29
  const better = committed(l, o.teamId).filter((q) => ovr(q) > ovr(p)).length
  const role = better < 5 ? 1 : better < 8 ? 0.5 : 0
  return o.salary * (1 + 0.15 * quality + 0.1 * role) * (1 - 0.03 * Math.abs(o.years - askYears(p)))
}

/** One day of offseason free agency: CPU offers, then every courted player picks his best legal offer. */
export function freeAgencyDay(l: League, rng: Rng): void {
  const perf = formOf(l)
  const fas = Object.values(l.players).filter((p) => isFreeAgent(l, p))
  const ask = new Map(fas.map((p) => [p.id, currentAsk(l, p, perf)]))
  for (const teamId of rng.shuffle(Object.keys(l.teams).filter((id) => id !== l.userTeamId))) {
    const mine = committed(l, teamId)
    const n = mine.length
    if (n >= ROSTER_MAX || (n >= AI_ROSTER_TARGET && !rng.chance(0.35))) continue
    const mode = teamMode(l, teamId)
    const fits = fitsFrom(n, payroll(l, teamId))
    const counts = posCounts(mine)
    const offered = new Set(l.faOffers.filter((o) => o.teamId === teamId).map((o) => o.playerId))
    const eighth = mine.map(ovr).sort((a, b) => b - a)[7] ?? 0
    const options = fas.filter((p) => !offered.has(p.id) && (n < AI_ROSTER_TARGET || ovr(p) > eighth) && fits(ask.get(p.id)!))
    if (!options.length) continue
    const worth = (p: Player) => (playerValue(l, p, mode) * needFromCount(counts[p.pos] ?? 0)) / Math.sqrt(ask.get(p.id)!)
    const best = options.reduce((a, b) => (worth(b) > worth(a) ? b : a))
    if (ovr(best) < eighth && n >= 10 && rng.chance(0.5)) continue
    l.faOffers.push({ playerId: best.id, teamId, salary: ask.get(best.id)!, years: askYears(best) })
  }
  resolveOffers(l, ask)
}

function resolveOffers(l: League, ask: Map<string, number>): void {
  const rank = strengthOrder(l)
  const courted = [...new Set(l.faOffers.map((o) => o.playerId))]
  for (const id of courted) {
    const p = l.players[id]
    const offers = l.faOffers
      .filter((o) => o.playerId === id && !capProblem(l, o.teamId, { addSalary: o.salary, addCount: 1 }))
      .sort((a, b) => offerScore(l, p, b, rank) - offerScore(l, p, a, rank))
    const best = offers[0]
    if (best && best.salary >= (ask.get(id) ?? currentAsk(l, p)) * 0.97) sign(l, best.teamId, p, best.salary, best.years)
  }
  // Offers that can no longer be honoured (cap/roster changed) quietly lapse.
  l.faOffers = l.faOffers.filter((o) => isFreeAgent(l, l.players[o.playerId]) && !capProblem(l, o.teamId, { addSalary: o.salary, addCount: 1 }))
}

/** Free agents fill holes: a position the team lacks is worth more, a stacked one much less. */
export const needFromCount = (at: number) => (at === 0 ? 1.4 : at === 1 ? 1.15 : at >= 4 ? 0.6 : at === 3 ? 0.85 : 1)
export function needFactor(l: League, teamId: string, p: Player): number {
  return needFromCount(committed(l, teamId).filter((q) => q.pos === p.pos).length)
}
const posCounts = (ps: Player[]) => {
  const c: Record<string, number> = {}
  for (const p of ps) c[p.pos] = (c[p.pos] ?? 0) + 1
  return c
}
/** Fast cap check from precomputed roster size and payroll (same rule as capProblem). */
const fitsFrom = (n: number, pay: number) => (salary: number) =>
  n + 1 <= ROSTER_MAX && pay + salary + Math.max(0, ROSTER_MIN - n - 1) * MIN_SALARY <= SALARY_CAP

/** Signs the best free agents a team can afford, at their asks, until it has `target` players. */
export function fillRoster(l: League, teamId: string, target = AI_ROSTER_TARGET, perf = formOf(l)): void {
  const mode = teamMode(l, teamId)
  const fas = Object.values(l.players).filter((p) => isFreeAgent(l, p))
  const ask = new Map(fas.map((p) => [p.id, currentAsk(l, p, perf)]))
  for (let guard = 0; guard < 15; guard++) {
    const mine = committed(l, teamId)
    if (mine.length >= target) break
    const fits = fitsFrom(mine.length, payroll(l, teamId))
    const counts = posCounts(mine)
    const score = (p: Player) => playerValue(l, p, mode) * needFromCount(counts[p.pos] ?? 0)
    const pick = fas.filter((p) => !p.teamId && fits(ask.get(p.id)!)).sort((a, b) => score(b) - score(a))[0]
    if (!pick) break
    sign(l, teamId, pick, ask.get(pick.id)!, Math.min(2, askYears(pick)))
  }
}

/** CPU teams under the target sign the best free agent they can afford (in season: immediately at his ask). */
export function aiFillRosters(l: League, target = AI_ROSTER_TARGET): void {
  const short = Object.keys(l.teams).filter((id) => id !== l.userTeamId && committed(l, id).length < target)
  if (!short.length) return
  const perf = formOf(l)
  for (const teamId of short) fillRoster(l, teamId, target, perf)
}

/** CPU teams over the limit release their least valuable players. */
export function aiTrimRosters(l: League): void {
  for (const teamId of Object.keys(l.teams)) {
    if (teamId === l.userTeamId) continue
    const mode = teamMode(l, teamId)
    while (committed(l, teamId).length > ROSTER_MAX) {
      const worst = committed(l, teamId).sort((a, b) => playerValue(l, a, mode) - playerValue(l, b, mode))[0]
      releasePlayer(l, worst.id)
    }
  }
}

/** Fresh veterans so the pool never runs dry. */
export function addFreeAgentBatch(l: League, rng: Rng, n: number): void {
  for (let i = 0; i < n; i++) {
    const p = generatePlayer(rng, { season: l.season, targetOvr: Math.max(55, Math.min(72, Math.round(rng.normal(64, 3.5)))), age: rng.int(24, 34) })
    p.ratingHistory = [{ season: l.season + (l.phase === 'offseason' ? 1 : 0), ovr: ovr(p) }]
    l.players[p.id] = p
  }
}

/** Re-sign offer to one of the user's expiring players (offseason re-signing period). */
export function offerResign(l: League, rng: Rng, playerId: string, salary: number, years: number): 'signed' | 'rejected' | 'walked' {
  const os = l.offseason
  if (!os || os.step !== 'resign') throw new GmError('Re-signing happens in the offseason re-signing period.')
  const p = l.players[playerId]
  if (!p || p.teamId !== l.userTeamId || !p.contract || p.contract.expires !== l.season) throw new GmError('He is not one of your expiring players.')
  checkOffer(salary, years)
  if ((os.resignTries[p.id] ?? 0) >= 3 || p.morale < 25) throw new GmError(`${pname(p)} won't negotiate with you any more.`)
  const problem = capProblem(l, l.userTeamId, { addSalary: salary, addCount: 1 }, 'This contract')
  if (problem) throw new GmError(problem)
  const chance = resignChance(l, p, salary, years)
  if (rng.chance(chance)) {
    sign(l, l.userTeamId, p, salary, years, 'resign')
    return 'signed'
  }
  os.resignTries[p.id] = (os.resignTries[p.id] ?? 0) + 1
  p.morale = Math.max(0, p.morale - 4)
  return os.resignTries[p.id] >= 3 ? 'walked' : 'rejected'
}

/** Probability an expiring player re-signs for this offer: price vs ask, mood and winning. */
export function resignChance(l: League, p: Player, salary: number, years: number): number {
  const ratio = salary / askSalary(l, p)
  const row = standingsOf(l).find((r) => r.teamId === p.teamId)
  let c = (ratio - 0.8) / 0.25 + (p.morale - 50) / 200 + ((row?.pct ?? 0.5) - 0.5) * 0.4 - Math.abs(years - askYears(p)) * 0.05
  if (ratio >= 1.1) c += 0.15
  return Math.max(0, Math.min(0.97, c))
}

/** CPU teams decide on their own expiring players at the end of the re-signing period. */
export function aiResign(l: League, rng: Rng): void {
  for (const teamId of Object.keys(l.teams)) {
    if (teamId === l.userTeamId) continue
    const mode = teamMode(l, teamId)
    const expiring = teamPlayers(l, teamId)
      .filter((p) => p.contract && p.contract.expires === l.season)
      .sort((a, b) => playerValue(l, b, mode) - playerValue(l, a, mode))
    for (const p of expiring) {
      const salary = askSalary(l, p)
      const ninth = committed(l, teamId).map(ovr).sort((a, b) => b - a)[8] ?? 0
      const wanted = p.age <= 33 && (ovr(p) >= ninth || (p.age <= 24 && p.pot >= 70))
      if (!wanted || capProblem(l, teamId, { addSalary: salary, addCount: 1 }) || !rng.chance(0.85)) continue
      sign(l, teamId, p, salary, askYears(p), 'resign')
    }
  }
}

/** Anyone whose deal ended and wasn't re-signed hits the open market. */
export function releaseExpired(l: League): void {
  for (const p of Object.values(l.players)) {
    if (!p.teamId || !p.contract || p.contract.expires >= capSeason(l)) continue
    const teamId = p.teamId
    p.teamId = null
    p.contract = null
    refreshRotation(l, teamId)
  }
}

export { onWaivers }
