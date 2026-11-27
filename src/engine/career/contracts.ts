import { MAX_SALARY, MIN_SALARY, ROSTER_MAX } from '../constants'
import { capProblem, capSeason, committed, log, ovr, pname, refreshRotation, teamPlayers, tname, tradesOpen } from '../gm/cap'
import { askSalary, askYears, strengthOrder } from '../gm/value'
import { ping } from '../stories/inbox'
import { clamp, storyRng } from '../stories/state'
import type { Rng } from '../rng'
import type { DraftPick, League, Player } from '../types'
import type { CareerOffer } from './types'

export type { CareerOffer }

const followed = (l: League): Player => l.players[l.career!.playerId]
const room = (l: League, teamId: string) => teamPlayers(l, teamId).length < ROSTER_MAX

/** How many teammates are better than he is, as a role word for the offer note. */
function roleNote(l: League, teamId: string, p: Player): string {
  const better = committed(l, teamId).filter((q) => q.id !== p.id && ovr(q) > ovr(p)).length
  return better < 5 ? 'starter minutes' : better < 9 ? 'rotation minutes' : 'bench role'
}

/**
 * What he can sign right now: his own team's re-sign offer, a few CPU offers from teams with room under the cap, and
 * always a minimum deal so a career can never dead-end. Deterministic for the save.
 */
export function contractOffers(l: League): CareerOffer[] {
  const p = followed(l)
  const rng = storyRng(l, 913)
  const ask = askSalary(l, p)
  const years = askYears(p)
  const order = strengthOrder(l)
  const current = p.teamId
  const scored: { o: CareerOffer; v: number }[] = []
  for (const teamId of Object.keys(l.teams)) {
    const quality = 1 - order.indexOf(teamId) / Math.max(1, order.length - 1)
    const mine = teamId === current
    const salary = clamp(Math.round((ask * (0.88 + 0.22 * rng.next() + (mine ? 0.04 : 0))) / 100) * 100, MIN_SALARY, MAX_SALARY)
    const yrs = clamp(years + rng.int(-1, 1), 1, 5)
    if (capProblem(l, teamId, { addSalary: salary, addCount: mine ? 0 : 1 })) continue
    const role = roleNote(l, teamId, p)
    scored.push({
      o: { teamId, salary, years: yrs, note: `${mine ? 'Re-sign' : 'Offer'} · ${role}` },
      v: salary * (1 + 0.15 * quality + (role === 'starter minutes' ? 0.1 : 0)) + (mine ? 250 : 0),
    })
  }
  const best = scored.sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.o)
  // The floor: a minimum deal from whichever team is shortest of players (cap exception; a spot is cleared on signing).
  const shortest = Object.keys(l.teams).sort((a, b) => teamPlayers(l, a).length - teamPlayers(l, b).length || (a < b ? -1 : 1))[0]
  const minTeam = current && room(l, current) ? current : shortest
  return [...best, { teamId: minTeam, salary: MIN_SALARY, years: 1, note: 'Minimum deal · prove yourself' }]
}

/** Signs him with the chosen team: the league follows him (`userTeamId`), and a full roster loses its weakest man. */
export function acceptOffer(l: League, offer: CareerOffer): void {
  const c = l.career
  if (!c) return
  const p = followed(l)
  const old = p.teamId
  const roster = teamPlayers(l, offer.teamId).filter((q) => q.id !== p.id)
  if (roster.length >= ROSTER_MAX) {
    const worst = [...roster].sort((a, b) => ovr(a) - ovr(b))[0]
    worst.teamId = null
    worst.contract = null
    log(l, 'release', [offer.teamId], [worst.id], `${tname(l, offer.teamId)} cleared a roster spot for ${pname(p)} by releasing ${pname(worst)}.`)
  }
  p.teamId = offer.teamId
  p.contract = { salary: offer.salary, expires: capSeason(l) + offer.years - 1 }
  l.userTeamId = offer.teamId
  l.teams[offer.teamId].rotation.auto = true
  refreshRotation(l, offer.teamId)
  if (old && old !== offer.teamId) refreshRotation(l, old)
  log(l, 'sign', [offer.teamId], [p.id], `${tname(l, offer.teamId)} signed ${pname(p)}: ${offer.years} yr${offer.years > 1 ? 's' : ''}.`)
  c.log.push({ season: l.season, text: `Signed with ${tname(l, offer.teamId)} (${offer.years} yr).` })
  c.offers = null
}

/** Weekly odds that the league moves him: bad play, an overpaid deal, a crowded roster and low morale all raise them. */
export function suddenMoveChance(l: League): { trade: number; cut: number } {
  const p = followed(l)
  if (!p.teamId) return { trade: 0, cut: 0 }
  const roster = teamPlayers(l, p.teamId).sort((a, b) => ovr(b) - ovr(a))
  const rank = roster.findIndex((q) => q.id === p.id)
  const bad = clamp((rank - 4) / 8, 0, 1)
  const morale = clamp((50 - p.morale) / 50, 0, 1)
  const pay = p.contract ? clamp(p.contract.salary / Math.max(MIN_SALARY, askSalary(l, p)) - 1, 0, 1) : 0
  const crowded = clamp((roster.length - 13) / 2, 0, 1)
  return {
    trade: 0.012 + 0.05 * bad + 0.02 * morale + 0.015 * pay + 0.01 * crowded,
    cut: 0.001 + 0.03 * bad * bad + 0.01 * morale * bad,
  }
}

/** The earliest pick of `round` that `teamId` still owns and can trade (its draft slot unused), else the other round. */
function tradePickBack(l: League, teamId: string, round: 1 | 2): DraftPick | null {
  const live = (k: DraftPick) => k.ownerId === teamId && (!l.draft || k.season > l.draft.season || l.draft.order.some((s) => s.pickId === k.id && !s.playerId))
  const best = (r: number) => l.picks.filter((k) => k.round === r && live(k)).sort((a, b) => a.season - b.season)[0]
  return best(round) ?? best(round === 1 ? 2 : 1) ?? null
}

/**
 * Rolls the weekly sudden move. A cut leaves him unsigned with a pending contract choice; a trade moves him to another
 * CPU team (who sends their weakest player back if they are full). Returns what happened.
 */
export function rollSuddenMove(l: League, rng: Rng): 'trade' | 'cut' | null {
  const c = l.career
  const p = followed(l)
  if (!c || c.status !== 'active' || !p.teamId || c.offers || l.phase !== 'regular') return null
  const chance = suddenMoveChance(l)
  const r = rng.next()
  const from = p.teamId
  if (r < chance.cut) {
    p.teamId = null
    p.contract = null
    refreshRotation(l, from)
    log(l, 'release', [from], [p.id], `${tname(l, from)} waived ${pname(p)}.`)
    c.log.push({ season: l.season, text: `Cut by ${tname(l, from)}.` })
    c.offers = contractOffers(l)
    c.alert = { kind: 'cut', title: `Cut by ${tname(l, from)}`, lines: ['Your agent has a few teams on the line.'], fromTeamId: from, toTeamId: null, season: l.season, day: l.day }
    ping(l, 'morale', `career-cut-${l.season}-${l.day}`, `You were cut by ${tname(l, from)}`, 'Your agent has a few teams on the line. Pick one — or take the minimum and prove yourself.')
    return 'cut'
  }
  if (r < chance.cut + chance.trade && tradesOpen(l)) {
    const candidates = Object.keys(l.teams).filter((id) => id !== from)
    const to = rng.pick(candidates)
    const star = Object.values(l.players).filter((q) => q.teamId && ovr(q) > ovr(p)).length < 90
    const pick = tradePickBack(l, to, star ? 1 : 2)
    const full = teamPlayers(l, to).length >= ROSTER_MAX
    const back = full || !pick ? [...teamPlayers(l, to)].sort((a, b) => ovr(a) - ovr(b))[0] ?? null : null
    p.teamId = to
    if (back) { back.teamId = from; if (!back.contract) back.contract = { salary: MIN_SALARY, expires: capSeason(l) } }
    else if (pick) pick.ownerId = from
    const got = back ? pname(back) : pick ? `their ${pick.season} round-${pick.round} pick` : 'nothing'
    l.userTeamId = to
    l.teams[to].rotation.auto = true
    refreshRotation(l, to)
    refreshRotation(l, from)
    log(l, 'trade', [from, to], back ? [p.id, back.id] : [p.id], `${tname(l, from)} traded ${pname(p)} to ${tname(l, to)} for ${got}.`)
    c.log.push({ season: l.season, text: `Traded to ${tname(l, to)} for ${got}.` })
    ping(l, 'morale', `career-trade-${l.season}-${l.day}`, `You were traded to ${tname(l, to)}`, `${tname(l, from)} sent you to ${tname(l, to)} for ${got}. New city, new role.`)
    c.alert = { kind: 'trade', title: `Traded to ${tname(l, to)}!`, lines: [`${tname(l, from)} sent you to ${tname(l, to)}.`, `Coming back: ${got}.`], fromTeamId: from, toTeamId: to, season: l.season, day: l.day }
    return 'trade'
  }
  return null
}
