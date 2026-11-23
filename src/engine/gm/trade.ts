import type { Rng } from '../rng'
import type { League, Player, TradeAsset } from '../types'
import { GmError, capProblem, capSeason, committed, log, pname, refreshRotation, tname, tradesOpen } from './cap'
import { type Mode, pickValue, playerValue, teamMode } from './value'

export type Asset = TradeAsset
export interface Trade { a: string; b: string; aGives: Asset[]; bGives: Asset[] }
export interface Verdict { ok: boolean; reason: string; got: number; gave: number }

/** AI only says yes when it gets clearly more than it gives. */
export const ACCEPT_MARGIN = 1.1
export const ACCEPT_FLOOR = 2

const salaryOf = (l: League, assets: Asset[]) =>
  assets.reduce((t, a) => t + (a.kind === 'player' ? l.players[a.id].contract?.salary ?? 0 : 0), 0)
const playersIn = (assets: Asset[]) => assets.filter((a) => a.kind === 'player').length

export function assetLabel(l: League, a: Asset): string {
  if (a.kind === 'player') return pname(l.players[a.id])
  const pk = l.picks.find((p) => p.id === a.id)!
  return `${pk.season} round ${pk.round} pick (${l.teams[pk.originalTeamId].abbrev})`
}

function owns(l: League, teamId: string, a: Asset): boolean {
  if (a.kind === 'pick') return l.picks.some((p) => p.id === a.id && p.ownerId === teamId)
  const p = l.players[a.id]
  return !!p && p.teamId === teamId && !!p.contract && p.contract.expires >= capSeason(l)
}

/** Structural problems with a trade (window, ownership, cap, roster), from either side. */
export function tradeProblem(l: League, t: Trade): string | null {
  if (!tradesOpen(l)) return l.phase === 'playoffs' ? 'Trades are closed during the playoffs.' : 'The trade deadline has passed.'
  if (!t.aGives.length && !t.bGives.length) return 'Add something to the trade.'
  if (t.a === t.b) return 'Pick a different team.'
  for (const a of t.aGives) if (!owns(l, t.a, a)) return `${assetLabel(l, a)} can't be traded by ${tname(l, t.a)}.`
  for (const a of t.bGives) if (!owns(l, t.b, a)) return `${assetLabel(l, a)} can't be traded by ${tname(l, t.b)}.`
  const sa = salaryOf(l, t.aGives), sb = salaryOf(l, t.bGives)
  const na = playersIn(t.aGives), nb = playersIn(t.bGives)
  const pa = capProblem(l, t.a, { addSalary: sb, addCount: nb, removeSalary: sa, removeCount: na }, `For ${tname(l, t.a)}, this`)
  if (pa) return pa
  return capProblem(l, t.b, { addSalary: sa, addCount: na, removeSalary: sb, removeCount: nb }, `For ${tname(l, t.b)}, this`)
}

/** Value of a package to `teamId`, with a positional-need bonus and a stacked-position penalty. */
export function packageValue(l: League, teamId: string, gets: Asset[], gives: Asset[], mode: Mode = teamMode(l, teamId)): number {
  const leaving = new Set(gives.filter((a) => a.kind === 'player').map((a) => a.id))
  const after: Player[] = committed(l, teamId).filter((p) => !leaving.has(p.id))
  for (const a of gets) if (a.kind === 'player') after.push(l.players[a.id])
  let v = 0
  for (const a of gets) {
    if (a.kind === 'pick') { v += pickValue(l, l.picks.find((p) => p.id === a.id)!, mode); continue }
    const p = l.players[a.id]
    const base = playerValue(l, p, mode)
    const atPos = after.filter((q) => q.pos === p.pos).length
    v += base * (atPos <= 2 ? 1.1 : atPos >= 5 ? 0.6 : atPos >= 4 ? 0.8 : 1)
  }
  return v
}

/** Plain value of assets a team would send away. */
export function assetsValue(l: League, assets: Asset[], mode: Mode): number {
  return assets.reduce((t, a) => t + (a.kind === 'pick' ? pickValue(l, l.picks.find((p) => p.id === a.id)!, mode) : playerValue(l, l.players[a.id], mode)), 0)
}

export function aiVerdict(l: League, teamId: string, gets: Asset[], gives: Asset[]): Verdict {
  const mode = teamMode(l, teamId)
  const got = packageValue(l, teamId, gets, gives, mode)
  const gave = assetsValue(l, gives, mode)
  if (got >= gave * ACCEPT_MARGIN + ACCEPT_FLOOR) return { ok: true, reason: 'Deal!', got, gave }
  const short = gave * ACCEPT_MARGIN + ACCEPT_FLOOR - got
  return { ok: false, reason: short > gave * 0.5 + 5 ? 'They want a lot more value.' : 'They want a little more value.', got, gave }
}

/** Mutates: moves the assets and logs the trade. Assumes it is legal. */
export function executeTrade(l: League, t: Trade): void {
  const move = (assets: Asset[], to: string) => {
    for (const a of assets) {
      if (a.kind === 'player') l.players[a.id].teamId = to
      else l.picks.find((p) => p.id === a.id)!.ownerId = to
    }
  }
  move(t.aGives, t.b)
  move(t.bGives, t.a)
  refreshRotation(l, t.a)
  refreshRotation(l, t.b)
  const list = (as: Asset[]) => (as.length ? as.map((a) => assetLabel(l, a)).join(', ') : 'nothing')
  const ids = [...t.aGives, ...t.bGives].filter((a) => a.kind === 'player').map((a) => a.id)
  log(l, 'trade', [t.a, t.b], ids, `${tname(l, t.a)} trade ${list(t.aGives)} to ${tname(l, t.b)} for ${list(t.bGives)}.`)
}

/** The user's proposal: team a is the user, team b answers instantly. Mutates on acceptance. */
export function proposeTrade(l: League, t: Trade): Verdict {
  const problem = tradeProblem(l, t)
  if (problem) throw new GmError(problem)
  const v = aiVerdict(l, t.b, t.aGives, t.bGives)
  if (v.ok) executeTrade(l, t)
  return v
}

/** Everything `teamId` could put in a deal right now. */
export function tradeableAssets(l: League, teamId: string): Asset[] {
  const players = committed(l, teamId).map((p): Asset => ({ kind: 'player', id: p.id }))
  const picks = l.picks.filter((p) => p.ownerId === teamId && (!l.draft || p.season > l.draft.season || l.draft.order.some((s) => s.pickId === p.id && !s.playerId)))
  return [...players, ...picks.map((p): Asset => ({ kind: 'pick', id: p.id }))]
}

/**
 * "What would it take?": the cheapest package from `fromTeam` that `toTeam` accepts for `wanted`.
 * Tries single assets, then pairs, then triples among the most valuable pieces.
 */
export function suggestPackage(l: League, fromTeam: string, toTeam: string, wanted: Asset[]): Asset[] | null {
  const mode = teamMode(l, toTeam)
  const pool = tradeableAssets(l, fromTeam)
    .map((a) => ({ a, v: packageValue(l, toTeam, [a], wanted, mode) }))
    .filter((x) => x.v > 0)
    .sort((x, y) => x.v - y.v)
  const works = (give: Asset[]) => {
    const t: Trade = { a: fromTeam, b: toTeam, aGives: give, bGives: wanted }
    return !tradeProblem(l, t) && aiVerdict(l, toTeam, give, wanted).ok
  }
  for (const x of pool) if (works([x.a])) return [x.a]
  const top = pool.slice(-14)
  let best: { give: Asset[]; v: number } | null = null
  for (let i = 0; i < top.length; i++)
    for (let j = i + 1; j < top.length; j++) {
      const give = [top[i].a, top[j].a], v = top[i].v + top[j].v
      if ((!best || v < best.v) && works(give)) best = { give, v }
    }
  if (best) return best.give
  const top3 = pool.slice(-9)
  for (let i = 0; i < top3.length; i++)
    for (let j = i + 1; j < top3.length; j++)
      for (let k = j + 1; k < top3.length; k++) {
        const give = [top3[i].a, top3[j].a, top3[k].a], v = top3[i].v + top3[j].v + top3[k].v
        if ((!best || v < best.v) && works(give)) best = { give, v }
      }
  return best?.give ?? null
}

/** CPU teams occasionally deal with each other; both must come out ahead by their own valuation. */
export function aiTrades(l: League, rng: Rng, attempts: number): number {
  if (!tradesOpen(l)) return 0
  const ai = Object.keys(l.teams).filter((id) => id !== l.userTeamId)
  let made = 0
  for (let i = 0; i < attempts; i++) {
    const buyer = rng.pick(ai)
    const seller = rng.pick(ai.filter((id) => id !== buyer))
    const targets = committed(l, seller).filter((p) => !p.injury || p.injury.gamesRemaining < 10)
    if (!targets.length) continue
    const target = rng.pick(targets)
    const wanted: Asset[] = [{ kind: 'player', id: target.id }]
    const give = suggestPackage(l, buyer, seller, wanted)
    if (!give) continue
    // The buyer must also think it wins the deal, by its own (different) priorities.
    const buyerMode = teamMode(l, buyer)
    const buyerGets = packageValue(l, buyer, wanted, give, buyerMode)
    const buyerGives = assetsValue(l, give, buyerMode)
    if (buyerGets < buyerGives * 1.05) continue
    executeTrade(l, { a: buyer, b: seller, aGives: give, bGives: wanted })
    made++
  }
  return made
}

export interface Offer { teamId: string; gives: Asset[]; value: number }
export interface FindOptions { want?: (a: Asset) => boolean }

/**
 * Trade finder: for each other team, the best return (by `fromTeam`'s own valuation) that the team
 * would accept for `offered`. Tries singles, pairs and triples among each team's most useful pieces.
 * Sorted best offer first; teams with nothing that works are left out.
 */
export function findOffers(l: League, fromTeam: string, offered: Asset[], opts: FindOptions = {}): Offer[] {
  if (!offered.length || !tradesOpen(l)) return []
  const myMode = teamMode(l, fromTeam)
  const offers: Offer[] = []
  for (const teamId of Object.keys(l.teams)) {
    if (teamId === fromTeam) continue
    const pool = tradeableAssets(l, teamId)
      .filter((a) => !opts.want || opts.want(a))
      .map((a) => ({ a, v: packageValue(l, fromTeam, [a], offered, myMode) }))
      .filter((x) => x.v > 0)
      .sort((x, y) => y.v - x.v)
      .slice(0, 10)
    const combos: { give: Asset[]; v: number }[] = []
    for (let i = 0; i < pool.length; i++) {
      combos.push({ give: [pool[i].a], v: pool[i].v })
      for (let j = i + 1; j < pool.length; j++) {
        combos.push({ give: [pool[i].a, pool[j].a], v: pool[i].v + pool[j].v })
        for (let k = j + 1; k < Math.min(8, pool.length); k++)
          combos.push({ give: [pool[i].a, pool[j].a, pool[k].a], v: pool[i].v + pool[j].v + pool[k].v })
      }
    }
    combos.sort((x, y) => y.v - x.v)
    for (const c of combos) {
      if (!aiVerdict(l, teamId, offered, c.give).ok) continue
      if (tradeProblem(l, { a: fromTeam, b: teamId, aGives: offered, bGives: c.give })) continue
      offers.push({ teamId, gives: c.give, value: packageValue(l, fromTeam, c.give, offered, myMode) })
      break
    }
  }
  return offers.sort((x, y) => y.value - x.value)
}
