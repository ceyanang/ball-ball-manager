import { MAX_SALARY, MIN_SALARY, ROSTER_MAX, ROSTER_MIN, SALARY_CAP } from '../constants'
import type { Rng } from '../rng'
import type { League, Player } from '../types'
import { GmError, isFreeAgent, ovr, payroll, pname, teamPlayers } from './cap'
import { rookieSalary, rookieYears, signRights } from './draft'
import { needLevels, needRank, needThresholds, slotsOf, type NeedLevel, type Slot } from './needs'
import { AI_ROSTER_TARGET, currentAsk, offerFreeAgent, offerResign, yearsFactor } from './roster'
import { askSalary, askYears, formOf, playerValue, teamMode } from './value'

export interface AutoMove {
  /** 'rights' = sign one of your own draft picks to his rookie deal. */
  kind: 'resign' | 'sign' | 'rights'
  playerId: string
  salary: number
  years: number
  reason: string
  before: NeedLevel
  after: NeedLevel
}

const slotOf = (p: Player): Slot => ({ id: p.id, pos: p.pos, ovr: ovr(p) })
const mult: Record<NeedLevel, number> = { red: 1.6, yellow: 1.15, green: 0.7 }
/** Falling OVR over the last two recorded seasons. */
const declining = (p: Player) => {
  const h = p.ratingHistory
  return h.length >= 2 && h[h.length - 2].ovr - h[h.length - 1].ovr >= 2
}

/**
 * Decides what the user's team should do, without changing the league.
 * Re-signing period: keep players who are young, rising or good value; let old/declining ones walk.
 * Otherwise: sign free agents, red positions first, to at least ROSTER_MIN (and up to the CPU target while a need can improve).
 * After an emergency rebuild it thinks like a rebuilder: your draft picks get signed first, vets (26+) are let go
 * unless a position is empty, and veteran free agents only get 1-year deals so they don't clog the cap.
 */
export function planAuto(l: League): AutoMove[] {
  const me = l.userTeamId
  const th = needThresholds(l)
  const os = l.offseason
  const rebuilt = l.phase === 'offseason' && !!os?.rebuilt
  const mode = rebuilt ? 'rebuild' : teamMode(l, me)
  const moves: AutoMove[] = []
  let slots = slotsOf(l, me)
  let pay = payroll(l, me)
  let n = slots.length
  const fits = (salary: number) => n + 1 <= ROSTER_MAX && pay + salary + Math.max(0, ROSTER_MIN - n - 1) * MIN_SALARY <= SALARY_CAP
  const add = (p: Player, kind: AutoMove['kind'], salary: number, years: number, reason: string) => {
    const before = needLevels(slots, th)[p.pos]
    slots = [...slots, slotOf(p)]
    pay += salary
    n += 1
    moves.push({ kind, playerId: p.id, salary, years, reason, before, after: needLevels(slots, th)[p.pos] })
  }

  if (rebuilt && l.draft) {
    const rookies = Object.entries(l.draftRights).filter(([, t]) => t === me).map(([id]) => l.players[id])
      .sort((a, b) => b.pot - a.pot || ovr(b) - ovr(a))
    for (const p of rookies) {
      const slot = l.draft.order.find((x) => x.playerId === p.id)
      if (!slot || !fits(rookieSalary(slot))) continue
      add(p, 'rights', rookieSalary(slot), rookieYears(slot), `your draft pick (#${slot.pick})`)
    }
  }

  if (l.phase === 'offseason' && os?.step === 'resign') {
    const expiring = teamPlayers(l, me).filter((p) => p.contract && p.contract.expires === l.season)
      .filter((p) => (os.resignTries[p.id] ?? 0) < 3 && p.morale >= 25)
      .sort((a, b) => playerValue(l, b, mode) - playerValue(l, a, mode))
    const pool = [...slots.map((s) => s.ovr), ...expiring.map(ovr)].sort((a, b) => b - a)
    const ninth = pool[8] ?? 0
    for (const p of expiring) {
      const young = p.age <= 24 && p.pot >= 70
      const need = needLevels(slots, th)[p.pos]
      const keep = rebuilt
        ? young || (p.age <= 25 && ovr(p) >= ninth) || need === 'red'
        : p.age <= 33 && (young || ovr(p) >= ninth || need === 'red') && !(declining(p) && p.age >= 30 && need !== 'red')
      // 10% over his ask: players take the money, so the offer usually lands.
      const salary = Math.round((askSalary(l, p) * 1.1) / 100) * 100
      if (!keep || !fits(salary)) continue
      const why = young ? 'young with upside' : need === 'red' ? 'fills a red position' : ovr(p) >= ninth ? 'rotation player' : 'good value'
      add(p, 'resign', salary, askYears(p), why)
    }
    return moves
  }

  const perf = formOf(l)
  const fas = Object.values(l.players).filter((p) => isFreeAgent(l, p))
  const ask = new Map(fas.map((p) => [p.id, currentAsk(l, p, perf)]))
  // Short deals cost a little more than his ask (he'd prefer longer); pay it so the offer lands.
  // A rebuilder locks young players up long and keeps vets on 1-year deals.
  const yearsOf = (p: Player) => (rebuilt ? (p.age <= 25 ? askYears(p) : 1) : Math.min(2, askYears(p)))
  const priceOf = (p: Player) => Math.min(MAX_SALARY, Math.ceil((ask.get(p.id)! * yearsFactor(p, yearsOf(p))) / 100) * 100)
  const taken = new Set<string>()
  for (let guard = 0; guard < ROSTER_MAX; guard++) {
    if (n >= AI_ROSTER_TARGET) break
    const lv = needLevels(slots, th)
    const worst = Math.min(...Object.values(lv).map((x) => needRank[x]))
    // Past the 10-man floor only sign someone if a red/yellow spot is left to fix.
    if (n >= ROSTER_MIN && worst >= needRank.green) break
    const cands = fas.filter((p) => !taken.has(p.id) && fits(priceOf(p)))
    if (!cands.length) break
    const score = (p: Player) => playerValue(l, p, mode) * mult[lv[p.pos]]
    const pick = cands.sort((a, b) => score(b) - score(a))[0]
    const lvl = lv[pick.pos]
    const after = needLevels([...slots, slotOf(pick)], th)[pick.pos]
    if (n >= ROSTER_MIN && needRank[after] <= needRank[lvl]) break
    taken.add(pick.id)
    const why = n < ROSTER_MIN ? (lvl === 'red' ? 'fills a red position' : 'roster to 10') : lvl === 'red' ? 'fixes a red position' : 'shores up a thin spot'
    add(pick, 'sign', priceOf(pick), yearsOf(pick), why)
  }
  return moves
}

/** Executes the (user-approved) moves through the normal re-sign / free-agent offers. Returns messages for any that failed. */
export function applyAutoMoves(l: League, rng: Rng, moves: AutoMove[]): string[] {
  const fails: string[] = []
  for (const m of moves) {
    const p = l.players[m.playerId]
    try {
      if (m.kind === 'rights') { signRights(l, m.playerId); continue }
      const res = m.kind === 'resign' ? offerResign(l, rng, m.playerId, m.salary, m.years) : offerFreeAgent(l, l.userTeamId, m.playerId, m.salary, m.years)
      if (res === 'rejected' || res === 'walked') fails.push(`${pname(p)} turned it down.`)
    } catch (e) {
      if (!(e instanceof GmError)) throw e
      fails.push(`${pname(p)}: ${e.message}`)
    }
  }
  return fails
}
