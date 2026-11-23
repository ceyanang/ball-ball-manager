import { MIN_SALARY } from '../constants'
import { GmError, committed, isFreeAgent, money, ovr, pname, tradesOpen } from '../gm/cap'
import { currentAsk } from '../gm/roster'
import { assetLabel, assetsValue, executeTrade, packageValue, suggestPackage, tradeProblem, type Asset, type Trade } from '../gm/trade'
import { standingsOf, strengthOrder, teamMode } from '../gm/value'
import type { InboxItem, InboxKind, Injury, League, Player, Position, TradeOffer } from '../types'
import { moodPost } from './social'
import { nextId, storyRng } from './state'

const MAX_ITEMS = 150
/** An AI offer stays on the table this many days. */
export const OFFER_DAYS = 7

/** In-season day, or free-agency day in the offseason. */
export const clock = (l: League) => (l.phase === 'offseason' ? l.offseason?.faDay ?? 0 : l.day)

export function ping(l: League, kind: InboxKind, key: string, title: string, body: string, link?: string, offer?: TradeOffer): InboxItem | null {
  if (l.inbox.some((i) => i.key === key)) return null
  const item: InboxItem = { id: nextId(l, 'i'), season: l.season, day: clock(l), phase: l.phase, kind, key, title, body, link, read: false, dismissed: false, offer }
  l.inbox.push(item)
  if (l.inbox.length > MAX_ITEMS) {
    // Drop the oldest finished items first; open offers always stay.
    const drop = l.inbox.findIndex((i) => i.offer?.status !== 'open')
    if (drop >= 0) l.inbox.splice(drop, 1)
  }
  return item
}

const stamp = (l: League) => (l.phase === 'offseason' ? `${l.season}o${l.offseason?.faDay ?? 0}` : `${l.season}d${l.day}`)

export function injuryPing(l: League, p: Player, inj: Injury): void {
  if (p.teamId !== l.userTeamId || inj.severity === 'dtd') return
  const out = inj.severity === 'season' ? 'is out for the season' : `will miss about ${inj.gamesRemaining} games`
  ping(l, 'injury', `inj:${p.id}:${stamp(l)}`, `🚑 ${pname(p)} ${out}`, `${pname(p)} has a ${inj.type.toLowerCase()}. Check your rotation.`, '/my-team')
}

export function returnPing(l: League, p: Player): void {
  if (p.teamId !== l.userTeamId) return
  ping(l, 'injury', `back:${p.id}:${stamp(l)}`, `💪 ${pname(p)} is healthy`, `${pname(p)} is cleared to play. He’s back in your rotation options.`, '/my-team')
}

const GROUPS: [string, Position[]][] = [['guards', ['PG', 'SG']], ['wings', ['SF']], ['bigs', ['PF', 'C']]]

/** Weekly assistant-GM checks during the season. */
export function weeklyInbox(l: League, unhappy: Player[]): void {
  const me = l.userTeamId
  for (const p of unhappy) {
    if (p.morale < 20 && ping(l, 'tradeRequest', `treq:${p.id}:${l.season}`, `📣 ${pname(p)} wants out`, `${pname(p)} (morale ${p.morale}) has asked to be traded. Unhappy players can sour on re-signing.`, '/trade'))
      moodPost(l, p, 'tradeRequest')
    else if (ping(l, 'morale', `mood:${p.id}:${l.season}`, `😤 ${pname(p)} is unhappy`, `${pname(p)}’s morale is down to ${p.morale}. More minutes or more wins would help.`, '/my-team'))
      moodPost(l, p, 'complaint')
  }
  const roster = committed(l, me)
  for (const [label, pos] of GROUPS) {
    const n = roster.filter((p) => pos.includes(p.pos) && !(p.injury && p.injury.gamesRemaining > 5)).length
    if (n === 0) ping(l, 'roster', `hole:${label}:${l.season}`, `🕳️ No healthy ${label}`, `You have no healthy ${label}. Out-of-position lineups cost you on both ends.`, '/free-agents')
    else if (n >= 7) ping(l, 'roster', `glut:${label}:${l.season}`, `📦 Too many ${label}`, `You carry ${n} ${label}. Consider trading one for help elsewhere.`, '/trade')
  }
  const eighth = roster.map(ovr).sort((a, b) => b - a)[7] ?? 0
  const bargain = Object.values(l.players)
    .filter((p) => isFreeAgent(l, p) && ovr(p) >= Math.max(64, eighth) && currentAsk(l, p) <= 2 * MIN_SALARY)
    .sort((a, b) => ovr(b) - ovr(a))[0]
  if (bargain) ping(l, 'freeAgent', `fa:${bargain.id}:${l.season}`, `🛒 ${pname(bargain)} is still out there`, `${pname(bargain)} (${ovr(bargain)} OVR, ${bargain.pos}) is unsigned and asking only ${money(currentAsk(l, bargain))}.`, '/free-agents')
  if (l.day >= 18 && l.day < 25) coachCheck(l)
  if (l.day >= l.tradeDeadlineDay - 6 && l.day <= l.tradeDeadlineDay) {
    const expiring = roster.filter((p) => p.contract?.expires === l.season)
    if (expiring.length)
      ping(l, 'expiring', `exp:${l.season}`, `⏳ ${expiring.length} contract${expiring.length > 1 ? 's' : ''} expiring`, `Deals ending this season: ${expiring.map((p) => pname(p)).join(', ')}. The trade deadline is day ${l.tradeDeadlineDay}.`, '/office')
  }
}

/** The coach is well behind what the roster should manage. */
export function coachCheck(l: League): void {
  const row = standingsOf(l).find((r) => r.teamId === l.userTeamId)
  if (!row || row.w + row.l < 10) return
  const expected = 0.72 - (0.44 * strengthOrder(l).indexOf(l.userTeamId)) / 29
  if (row.pct >= expected - 0.12) return
  const c = l.coaches[l.teams[l.userTeamId].coachId]
  ping(l, 'coach', `coach:${c.id}:${l.season}:${l.phase}`, `📋 Coach ${c.lastName} is underperforming`, `At ${row.w}–${row.l}, the team is well below what this roster should do (about ${Math.round(expected * 100)}% wins). Coaching changes happen in the offseason.`, '/office')
}

/** Offseason review: big contracts on fading veterans. */
export function offseasonInbox(l: League): void {
  coachCheck(l)
  for (const c of l.offseason?.report.changes ?? []) {
    if (c.teamId !== l.userTeamId || c.to - c.from > -3) continue
    const p = l.players[c.playerId]
    if (!p.contract || p.contract.salary < 15_000 || p.contract.expires <= l.season) continue
    ping(l, 'contract', `decl:${p.id}:${l.season}`, `📉 ${pname(p)} is slipping`, `${pname(p)} dropped from ${c.from} to ${c.to} OVR and earns ${money(p.contract.salary)} through ${p.contract.expires}. Consider moving him while he still has value.`, '/trade')
  }
}

/** Sometimes a CPU team calls with an offer for one of the user's players. Returns true when one arrived. */
export function maybeAiOffer(l: League, chance = 0.5): boolean {
  if (!tradesOpen(l) || l.inbox.some((i) => i.offer?.status === 'open')) return false
  const rng = storyRng(l, 31)
  if (!rng.chance(chance)) return false
  const me = l.userTeamId
  // Stars are rarely pried loose; teams mostly ask about useful rotation pieces.
  const targets = committed(l, me).filter((p) => !(p.injury && p.injury.gamesRemaining > 10)).sort((a, b) => ovr(b) - ovr(a)).slice(1, 10)
  if (!targets.length) return false
  const ai = Object.keys(l.teams).filter((id) => id !== me)
  for (let attempt = 0; attempt < 8; attempt++) {
    const buyer = rng.pick(ai)
    const target = rng.pick(targets)
    const wanted: Asset[] = [{ kind: 'player', id: target.id }]
    const give = suggestPackage(l, buyer, me, wanted)
    if (!give) continue
    const mode = teamMode(l, buyer)
    if (packageValue(l, buyer, wanted, give, mode) < assetsValue(l, give, mode)) continue
    const t = l.teams[buyer]
    const offer: TradeOffer = { teamId: buyer, theyGive: give, youGive: wanted, status: 'open' }
    ping(l, 'trade', `offer:${stamp(l)}`, `📞 ${t.city} ${t.name} want ${pname(target)}`,
      `They offer ${give.map((a) => assetLabel(l, a)).join(' + ')} for ${pname(target)}. The offer stands for ${OFFER_DAYS} days.`, '/inbox', offer)
    return true
  }
  return false
}

/** Open offers lapse after a week, when trades close, or when the pieces are gone. */
export function expireOffers(l: League): void {
  for (const i of l.inbox) {
    if (i.offer?.status !== 'open') continue
    const stale = i.season !== l.season || i.phase !== l.phase || clock(l) - i.day > OFFER_DAYS
    if (stale || offerProblem(l, i.offer)) i.offer.status = 'expired'
  }
}

const offerTrade = (l: League, o: TradeOffer): Trade => ({ a: l.userTeamId, b: o.teamId, aGives: o.youGive, bGives: o.theyGive })
const offerProblem = (l: League, o: TradeOffer) => tradeProblem(l, offerTrade(l, o))

/** The user answers an AI offer. Accepting re-checks that the deal is still legal and still wanted. */
export function respondToOffer(l: League, itemId: string, accept: boolean): string {
  const item = l.inbox.find((i) => i.id === itemId)
  const o = item?.offer
  if (!item || !o || o.status !== 'open') throw new GmError('That offer is no longer on the table.')
  item.read = true
  if (!accept) {
    o.status = 'declined'
    return 'Offer declined.'
  }
  const problem = offerProblem(l, o)
  if (problem) {
    o.status = 'expired'
    throw new GmError(problem)
  }
  // They proposed it, but they re-check their side before signing off.
  if (assetsValue(l, o.theyGive, teamMode(l, o.teamId)) > packageValue(l, o.teamId, o.youGive, o.theyGive) * 1.05) {
    o.status = 'expired'
    throw new GmError(`The ${l.teams[o.teamId].name} have changed their minds.`)
  }
  executeTrade(l, offerTrade(l, o))
  o.status = 'accepted'
  return `Trade done with the ${l.teams[o.teamId].name}.`
}

