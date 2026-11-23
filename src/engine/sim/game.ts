import { OT_MIN, QUARTER_MIN, STARTERS } from '../constants'
import { computeOvr } from '../player/ratings'
import type { Rng } from '../rng'
import type { BoxLine, Coach, CoachStyle, GameResult, Player, Team } from '../types'
import type { PlayEvent, Side } from './playlog'
import { gameLineup, lineupPenalties, minutesTargets } from './rotation'
import { chooseSubs, isBlowout, returnStarterSwaps, SUB } from './subs'

/** Tuning constants (calibrated by the realism tests). */
export const K = {
  /** Rating treated as league-average in all make/miss formulas. */
  pivot: 72,
  basePace: 97,
  paceStyle: 4,
  defenseStylePace: -2,
  tovBase: 0.13,
  stealShare: 0.55,
  commonFoul: 0.07,
  rimBase: 0.6,
  midBase: 0.39,
  threeBase: 0.332,
  shooterK: 0.004,
  defK: 0.003,
  defenseStyle: 0.015,
  home: 0.008,
  blockRim: 0.11,
  blockMid: 0.035,
  foulRim: 0.22,
  foulMid: 0.08,
  foulThree: 0.03,
  andOne: 0.45,
  orebBase: 0.24,
  usageExp: 2.4,
  threeStyle: 1.25,
  /** Make-probability lost per OVR point of out-of-position cost (C at PG ≈ −6.5%). */
  oopShot: 0.0025,
  /** Share of defenders' out-of-position cost taken off their perimeter/interior D. */
  oopDef: 0.5,
  /** Make-probability per morale point away from 60 (≈ ±1.6% at the extremes). */
  morale: 0.0004,
}

/**
 * In-game energy (0–100). Everyone tips off fresh; minutes on the floor drain it (slower with a high stamina
 * rating, and slower again while a player is hot), the bench and the breaks refill it. Below `line` a tired
 * player shoots, handles and defends worse, so riding the starters 44 minutes costs you late.
 */
export const FATIGUE = {
  /** Energy lost per minute on the floor at 0 stamina; a 99-stamina player loses `drain·(1 − stamRelief)`. */
  drain: 4.5,
  stamRelief: 0.5,
  /** Drain multiplier while hot. */
  hotDrain: 0.65,
  /** Made-minus-missed shot streak that counts as hot. */
  hotHeat: 3,
  /** Energy regained per minute on the bench, at a quarter break, and at halftime. */
  bench: 6,
  quarterBreak: 8,
  halftime: 25,
  /** Fatigue starts to cost below this energy. */
  line: 65,
  /** Make-probability lost per point of energy under the line. */
  shot: 0.003,
  /** Defensive rating lost per point under the line. */
  def: 1.3,
  /** Turnover probability added per point under the line. */
  tov: 0.0012,
}

/** Energy lost by `p` over one minute on the floor. */
export function drainPerMinute(p: Player, hot: boolean): number {
  return FATIGUE.drain * (1 - FATIGUE.stamRelief * (p.ratings.stam / 99)) * (hot ? FATIGUE.hotDrain : 1)
}

interface Ctx {
  team: Team
  style: CoachStyle
  ids: string[]
  starters: string[]
  onCourt: string[]
  pen: Record<string, number>
  played: Record<string, number>
  /** Consecutive game-minutes each player has been on the floor (0 when sitting). */
  stint: Record<string, number>
  /** A blowout has started and the starters have not all come back yet. */
  blowoutSeen: boolean
  target: Record<string, number>
  /** The GM's minutes plan, if the depth chart has one. */
  plan?: Record<string, number>
  quarters: number[]
}

const mean = (ids: string[], f: (id: string) => number) => ids.reduce((s, id) => s + f(id), 0) / ids.length

export function simGame(
  home: Team,
  away: Team,
  players: Record<string, Player>,
  coaches: Record<string, Coach>,
  rng: Rng,
  log?: PlayEvent[],
): GameResult {
  for (const t of [home, away]) {
    const n = new Set([...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive].filter((id) => players[id])).size
    if (n < STARTERS) throw new Error(`${t.name} has fewer than ${STARTERS} players and cannot play a game (has ${n}).`)
  }
  const R = (id: string) => players[id].ratings
  const usage: Record<string, number> = {}
  const box: Record<string, BoxLine> = {}
  /** Energy 0–100 and the hot streak (made minus missed shots, 0..5) per player. */
  const energy: Record<string, number> = {}
  const heat: Record<string, number> = {}
  const tired = (id: string) => Math.max(0, FATIGUE.line - (energy[id] ?? 100))
  const shotHeat = (id: string, made: boolean) => { heat[id] = Math.max(0, Math.min(5, (heat[id] ?? 0) + (made ? 1 : -1))) }

  const makeSide = (team: Team): Ctx => {
    const lu = gameLineup(team, players)
    const ids = [...lu.starters, ...lu.bench]
    for (const id of ids) {
      const p = players[id]
      const r = p.ratings
      const scoring = Math.max(r.ins, r.mid, r.three) * 0.5 + ((r.ins + r.mid + r.three) / 3) * 0.2 + r.handle * 0.1 + computeOvr(r, p.pos) * 0.2
      usage[id] = Math.pow(scoring / K.pivot, K.usageExp)
      energy[id] = 100
      heat[id] = 0
      box[id] = {
        playerId: id, teamId: team.id, gs: lu.starters.includes(id), min: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0,
        blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
      }
    }
    return {
      team, style: coaches[team.coachId]?.style ?? 'balanced', ids, starters: lu.starters, onCourt: [], pen: {},
      played: Object.fromEntries(ids.map((id) => [id, 0])), stint: Object.fromEntries(ids.map((id) => [id, 0])), blowoutSeen: false, plan: team.rotation.minutes, target: minutesTargets(lu, players, 0, team.rotation.minutes), quarters: [],
    }
  }
  const sides: Record<Side, Ctx> = { home: makeSide(home), away: makeSide(away) }
  const sideOf: Record<string, Side> = {}
  for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) sideOf[id] = s
  const score: Record<Side, number> = { home: 0, away: 0 }
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

  const paceOf = (s: CoachStyle) => K.basePace + (s === 'pace' ? K.paceStyle : s === 'defense' ? K.defenseStylePace : 0)
  const poss48 = (paceOf(sides.home.style) + paceOf(sides.away.style)) / 2 + rng.normal(0, 3)

  // Story tracking only (no RNG): the last lead change and each side's biggest deficit.
  let possNo = 0, periodNo = 0, lastStint = false
  type LeadChange = { side: Side; shooter: string; period: number; lastStint: boolean; poss: number; shot: boolean }
  const lead: { last: LeadChange | null } = { last: null }
  const maxDeficit: Record<Side, number> = { home: 0, away: 0 }
  // Play log only (no RNG): events carry their possession index until the period ends, then become a fraction `t`.
  let possInPeriod = 0, periodStart = 0
  type Pending = { e: PlayEvent; idx: number }
  const pending: Pending[] = []
  const emit = (e: { [K in PlayEvent['k']]: Omit<Extract<PlayEvent, { k: K }>, 'period' | 't'> }[Exclude<PlayEvent['k'], 'periodEnd'>]) => {
    if (!log) return
    const ev = { ...e, period: periodNo, t: 0 } as PlayEvent
    log.push(ev)
    pending.push({ e: ev, idx: possInPeriod })
  }
  const emitScore = (e: { k: 'fg'; side: Side; player: string; made: boolean; three: boolean } | { k: 'ft'; side: Side; player: string; made: boolean }) => {
    if (e.k === 'fg') shotHeat(e.player, e.made)
    emit({ ...e, home: score.home, away: score.away })
  }
  const refreshPen = (c: Ctx) => { c.pen = lineupPenalties(c.onCourt, c.starters, players) }
  /** Apply swaps (logging each one) and refresh the out-of-position costs. */
  const applySwaps = (side: Side, swaps: { slot: number; out: string; in: string }[]) => {
    if (!swaps.length) return
    const c = sides[side]
    const next = [...c.onCourt]
    for (const w of swaps) {
      next[w.slot] = w.in
      emit({ k: 'sub', side, out: w.out, in: w.in, slot: w.slot })
    }
    c.onCourt = next
    refreshPen(c)
  }
  /** The coach's per-minute swaps (no RNG). */
  const subStep = (side: Side, minuteInPeriod: number, periodMinutes: number) => {
    const c = sides[side]
    if (c.onCourt.length !== STARTERS) return
    const margin = score[side] - score[other(side)]
    if (isBlowout(periodNo, Math.abs(margin))) c.blowoutSeen = true
    applySwaps(side, chooseSubs({
      period: periodNo, minuteInPeriod, periodMinutes, elapsed, gameMinutes: 48 + OT_MIN * ot, margin, onCourt: c.onCourt,
      sitting: c.ids.filter((id) => !c.onCourt.includes(id)), stint: c.stint, played: c.played, target: c.target,
      starters: c.starters, players, blowoutSeen: c.blowoutSeen, energy,
      dnp: c.plan ? c.ids.filter((id) => c.plan![id] === 0 && !c.starters.includes(id)) : undefined,
    }))
    if (c.blowoutSeen && Math.abs(margin) < SUB.blowoutReturn && c.starters.every((id) => c.onCourt.includes(id))) c.blowoutSeen = false
  }

  const addPoints = (off: Side, pts: number, shooter: string, shot = true) => {
    const wasAhead = score[off] > score[other(off)]
    score[off] += pts
    if (!wasAhead && score[off] > score[other(off)]) lead.last = { side: off, shooter, period: periodNo, lastStint, poss: possNo, shot }
    maxDeficit[other(off)] = Math.max(maxDeficit[other(off)], score[off] - score[other(off)])
    box[shooter].pts += pts
    const oc = sides[off]
    oc.quarters[oc.quarters.length - 1] += pts
    for (const id of oc.onCourt) box[id].pm += pts
    for (const id of sides[other(off)].onCourt) box[id].pm -= pts
  }

  const rebound = (off: Side): boolean => {
    const o = sides[off].onCourt, d = sides[other(off)].onCourt
    const p = K.orebBase + (mean(o, (id) => R(id).oreb) - mean(d, (id) => R(id).dreb)) * 0.003
    if (rng.chance(p)) {
      const id = rng.weighted(o, (id) => R(id).oreb ** 1.5)
      box[id].oreb++
      emit({ k: 'reb', side: off, player: id, off: true })
      return true
    }
    const id = rng.weighted(d, (id) => R(id).dreb ** 1.5)
    box[id].dreb++
    emit({ k: 'reb', side: other(off), player: id, off: false })
    return false
  }

  const freeThrows = (off: Side, shooter: string, n: number): boolean => {
    const pct = 0.43 + R(shooter).ft * 0.0045
    let lastMade = true
    for (let i = 0; i < n; i++) {
      box[shooter].fta++
      lastMade = rng.chance(pct)
      if (lastMade) {
        box[shooter].ftm++
        addPoints(off, 1, shooter, false)
      }
      emitScore({ k: 'ft', side: off, player: shooter, made: lastMade })
    }
    return lastMade
  }

  const possession = (off: Side) => {
    const o = sides[off].onCourt, d = sides[other(off)].onCourt
    const oStyle = sides[off].style, dStyle = sides[other(off)].style
    if (rng.chance(K.commonFoul)) box[rng.pick(d)].pf++
    // Turnover
    const handler = rng.weighted(o, (id) => usage[id] * R(id).handle)
    const hr = R(handler)
    const oPen = sides[off].pen, dPen = sides[other(off)].pen
    const tovP = K.tovBase + (mean(d, (id) => R(id).stl) - K.pivot) * 0.0015 - ((hr.handle + hr.iq) / 2 - K.pivot) * 0.0015 + (oPen[handler] ?? 0) * 0.001 + tired(handler) * FATIGUE.tov
    if (rng.chance(tovP)) {
      box[handler].tov++
      emit({ k: 'tov', side: off, player: handler })
      if (rng.chance(K.stealShare)) {
        const stealer = rng.weighted(d, (id) => R(id).stl ** 2)
        box[stealer].stl++
        emit({ k: 'stl', side: other(off), player: stealer })
      }
      return
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const shooter = rng.weighted(o, (id) => usage[id])
      const r = R(shooter)
      const wRim = Math.max(1, r.ins - 20), wMid = Math.max(1, r.mid - 30) * 0.6
      const wThree = Math.max(1, r.three - 35) * 1.4 * (oStyle === 'three' ? K.threeStyle : 1)
      const type = rng.weighted(['rim', 'mid', 'three'] as const, (t) => (t === 'rim' ? wRim : t === 'mid' ? wMid : wThree))
      const dCost = (id: string) => (dPen[id] ?? 0) * K.oopDef + tired(id) * FATIGUE.def
      const perD = mean(d, (id) => R(id).perD - dCost(id)), intD = mean(d, (id) => R(id).intD - dCost(id))
      let p =
        type === 'rim' ? K.rimBase + (r.ins - K.pivot) * K.shooterK - (intD - K.pivot) * K.defK
        : type === 'mid' ? K.midBase + (r.mid - K.pivot) * K.shooterK - (perD - K.pivot) * K.defK
        : K.threeBase + (r.three - K.pivot) * K.shooterK - (perD - K.pivot) * K.defK * 0.67
      p += ((r.iq + r.ath) / 2 - K.pivot) * 0.001
      p -= (oPen[shooter] ?? 0) * K.oopShot
      p -= tired(shooter) * FATIGUE.shot
      p += ((players[shooter].morale ?? 60) - 60) * K.morale
      if (dStyle === 'defense') p -= K.defenseStyle
      if (off === 'home') p += K.home
      const pts = type === 'three' ? 3 : 2
      const foulP = type === 'rim' ? K.foulRim : type === 'mid' ? K.foulMid : K.foulThree
      if (rng.chance(foulP)) {
        box[rng.pick(d)].pf++
        if (rng.chance(p * K.andOne)) {
          box[shooter].fga++
          box[shooter].fgm++
          if (pts === 3) { box[shooter].tpa++; box[shooter].tpm++ }
          addPoints(off, pts, shooter)
          emitScore({ k: 'fg', side: off, player: shooter, made: true, three: pts === 3 })
          maybeAssist(o, shooter, type)
          if (freeThrows(off, shooter, 1) || !rebound(off)) return
          continue
        }
        if (freeThrows(off, shooter, pts) || !rebound(off)) return
        continue
      }
      box[shooter].fga++
      if (pts === 3) box[shooter].tpa++
      const blockP = type === 'rim' ? K.blockRim + (mean(d, (id) => R(id).blk) - K.pivot) * 0.002 : type === 'mid' ? K.blockMid : 0
      if (blockP > 0 && rng.chance(blockP)) {
        const blocker = rng.weighted(d, (id) => R(id).blk ** 3)
        box[blocker].blk++
        emitScore({ k: 'fg', side: off, player: shooter, made: false, three: pts === 3 })
        emit({ k: 'blk', side: other(off), player: blocker })
        if (!rebound(off)) return
        continue
      }
      if (rng.chance(p)) {
        box[shooter].fgm++
        if (pts === 3) box[shooter].tpm++
        addPoints(off, pts, shooter)
        emitScore({ k: 'fg', side: off, player: shooter, made: true, three: pts === 3 })
        maybeAssist(o, shooter, type)
        return
      }
      emitScore({ k: 'fg', side: off, player: shooter, made: false, three: pts === 3 })
      if (!rebound(off)) return
    }
  }

  const maybeAssist = (o: string[], shooter: string, type: 'rim' | 'mid' | 'three') => {
    const p = type === 'rim' ? 0.5 : type === 'mid' ? 0.6 : 0.8
    if (!rng.chance(p)) return
    const mates = o.filter((id) => id !== shooter)
    const passer = rng.weighted(mates, (id) => R(id).pass ** 4)
    box[passer].ast++
    emit({ k: 'ast', side: sideOf[passer], player: passer })
  }

  let carry = 0, elapsed = 0, ot = 0
  let offense: Side = rng.chance(0.5) ? 'home' : 'away'
  const runPeriod = (opening: boolean, stints: number[]) => {
    sides.home.quarters.push(0)
    sides.away.quarters.push(0)
    periodNo++
    possInPeriod = 0
    periodStart = pending.length
    if (periodNo > 1) {
      const rest = periodNo === 3 ? FATIGUE.halftime : FATIGUE.quarterBreak
      for (const id of Object.keys(energy)) energy[id] = Math.min(100, energy[id] + rest)
    }
    stints.forEach((sl, i) => {
      lastStint = i === stints.length - 1
      for (const s of ['home', 'away'] as Side[]) {
        const c = sides[s]
        if (periodNo === 1 && i === 0) {
          c.onCourt = [...c.starters]
          refreshPen(c)
          emit({ k: 'lineup', side: s, players: [...c.onCourt] })
        } else if (opening && i === 0) {
          // Second-half tip: the starters return unless the game is already decided.
          if (isBlowout(3, Math.abs(score.home - score.away))) c.blowoutSeen = true
          else applySwaps(s, returnStarterSwaps(c.onCourt, c.starters, players))
        } else subStep(s, i, stints.length)
      }
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].onCourt) sides[s].played[id] += sl
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) sides[s].stint[id] = sides[s].onCourt.includes(id) ? sides[s].stint[id] + sl : 0
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) {
        energy[id] = sides[s].onCourt.includes(id)
          ? Math.max(0, energy[id] - drainPerMinute(players[id], heat[id] >= FATIGUE.hotHeat) * sl)
          : Math.min(100, energy[id] + FATIGUE.bench * sl)
      }
      elapsed += sl
      carry += (2 * poss48 * sl) / 48
      const n = Math.floor(carry)
      carry -= n
      for (let k = 0; k < n; k++) {
        possNo++
        possession(offense)
        offense = other(offense)
        possInPeriod++
      }
    })
    if (log) {
      for (const { e, idx } of pending.splice(periodStart)) e.t = possInPeriod ? idx / possInPeriod : 0
      const min: Record<string, number> = {}, pm: Record<string, number> = {}
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) { min[id] = sides[s].played[id]; pm[id] = box[id].pm }
      const en: Record<string, number> = {}
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) en[id] = Math.round(energy[id])
      log.push({ k: 'periodEnd', period: periodNo, t: 1, min, pm, energy: en })
    }
  }

  const quarterStints = Array.from({ length: QUARTER_MIN }, () => 1)
  for (let q = 1; q <= 4; q++) runPeriod(q === 1 || q === 3, quarterStints)
  while (score.home === score.away) {
    ot++
    for (const s of ['home', 'away'] as Side[]) {
      const c = sides[s]
      c.target = minutesTargets({ starters: c.starters, bench: c.ids.filter((id) => !c.starters.includes(id)) }, players, ot, c.plan)
    }
    runPeriod(false, Array.from({ length: OT_MIN }, () => 1))
  }

  for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) box[id].min = sides[s].played[id]

  const lines = Object.values(box)
  const gameScore = (b: BoxLine) =>
    b.pts + 0.4 * b.fgm - 0.7 * b.fga - 0.4 * (b.fta - b.ftm) + 0.7 * b.oreb + 0.3 * b.dreb + b.stl + 0.7 * b.ast + 0.7 * b.blk - 0.4 * b.pf - b.tov
  const potg = lines.reduce((best, b) => (gameScore(b) > gameScore(best) ? b : best), lines[0]).playerId

  const winner: Side = score.home > score.away ? 'home' : 'away'
  const ll = lead.last
  const clutch = ll && ll.side === winner && ll.period === periodNo && ll.lastStint
    ? { playerId: ll.shooter, buzzer: ll.shot && ll.poss === possNo }
    : null

  return {
    homeScore: score.home,
    awayScore: score.away,
    quarters: { home: sides.home.quarters, away: sides.away.quarters },
    ot,
    box: lines,
    potg,
    clutch,
    comeback: maxDeficit[winner],
  }
}
