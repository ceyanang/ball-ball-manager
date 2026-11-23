import { OT_MIN, QUARTER_MIN, STARTERS } from '../constants'
import { computeOvr } from '../player/ratings'
import type { Rng } from '../rng'
import type { BoxLine, Coach, CoachStyle, GameResult, Player, Team } from '../types'
import type { PlayEvent, Side } from './playlog'
import { courtPenalties, gameLineup, minutesTargets } from './rotation'

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

interface Ctx {
  team: Team
  style: CoachStyle
  ids: string[]
  starters: string[]
  onCourt: string[]
  pen: Record<string, number>
  played: Record<string, number>
  target: Record<string, number>
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
  const R = (id: string) => players[id].ratings
  const usage: Record<string, number> = {}
  const box: Record<string, BoxLine> = {}

  const makeSide = (team: Team): Ctx => {
    const lu = gameLineup(team, players)
    const ids = [...lu.starters, ...lu.bench]
    for (const id of ids) {
      const p = players[id]
      const r = p.ratings
      const scoring = Math.max(r.ins, r.mid, r.three) * 0.5 + ((r.ins + r.mid + r.three) / 3) * 0.2 + r.handle * 0.1 + computeOvr(r, p.pos) * 0.2
      usage[id] = Math.pow(scoring / K.pivot, K.usageExp)
      box[id] = {
        playerId: id, teamId: team.id, gs: lu.starters.includes(id), min: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0,
        blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
      }
    }
    return {
      team, style: coaches[team.coachId]?.style ?? 'balanced', ids, starters: lu.starters, onCourt: [], pen: {},
      played: Object.fromEntries(ids.map((id) => [id, 0])), target: minutesTargets(lu, players, 0), quarters: [],
    }
  }
  const sides: Record<Side, Ctx> = { home: makeSide(home), away: makeSide(away) }
  const sideOf: Record<string, Side> = {}
  for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].ids) sideOf[id] = s
  const score: Record<Side, number> = { home: 0, away: 0 }
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

  const paceOf = (s: CoachStyle) => K.basePace + (s === 'pace' ? K.paceStyle : s === 'defense' ? K.defenseStylePace : 0)
  const poss48 = (paceOf(sides.home.style) + paceOf(sides.away.style)) / 2 + rng.normal(0, 3)

  const chooseFive = (c: Ctx, forceStarters: boolean) => {
    if (forceStarters) {
      c.onCourt = [...c.starters]
      c.pen = courtPenalties(c.onCourt, players, true)
      return
    }
    const ranked = [...c.ids].sort((a, b) => {
      const ra = c.target[a] - c.played[a] + (c.onCourt.includes(a) ? 1.5 : 0)
      const rb = c.target[b] - c.played[b] + (c.onCourt.includes(b) ? 1.5 : 0)
      return rb - ra
    })
    const next = ranked.slice(0, STARTERS)
    // Same five as the opening lineup keep their set positions; any other group gets re-slotted by the coach.
    const same = next.length === c.starters.length && next.every((id) => c.starters.includes(id))
    c.onCourt = same ? [...c.starters] : next
    c.pen = courtPenalties(c.onCourt, players, same)
  }

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
  const emitScore = (e: { k: 'fg'; side: Side; player: string; made: boolean; three: boolean } | { k: 'ft'; side: Side; player: string; made: boolean }) =>
    emit({ ...e, home: score.home, away: score.away })
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
    const tovP = K.tovBase + (mean(d, (id) => R(id).stl) - K.pivot) * 0.0015 - ((hr.handle + hr.iq) / 2 - K.pivot) * 0.0015 + (oPen[handler] ?? 0) * 0.001
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
      const perD = mean(d, (id) => R(id).perD - (dPen[id] ?? 0) * K.oopDef), intD = mean(d, (id) => R(id).intD - (dPen[id] ?? 0) * K.oopDef)
      let p =
        type === 'rim' ? K.rimBase + (r.ins - K.pivot) * K.shooterK - (intD - K.pivot) * K.defK
        : type === 'mid' ? K.midBase + (r.mid - K.pivot) * K.shooterK - (perD - K.pivot) * K.defK
        : K.threeBase + (r.three - K.pivot) * K.shooterK - (perD - K.pivot) * K.defK * 0.67
      p += ((r.iq + r.ath) / 2 - K.pivot) * 0.001
      p -= (oPen[shooter] ?? 0) * K.oopShot
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

  let carry = 0
  let offense: Side = rng.chance(0.5) ? 'home' : 'away'
  const runPeriod = (isPeriodStart: boolean, stints: number[]) => {
    sides.home.quarters.push(0)
    sides.away.quarters.push(0)
    periodNo++
    possInPeriod = 0
    periodStart = pending.length
    stints.forEach((sl, i) => {
      lastStint = i === stints.length - 1
      for (const s of ['home', 'away'] as Side[]) chooseFive(sides[s], isPeriodStart && i === 0)
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].onCourt) sides[s].played[id] += sl
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
      log.push({ k: 'periodEnd', period: periodNo, t: 1, min, pm })
    }
  }

  const quarterStints = Array.from({ length: QUARTER_MIN }, () => 1)
  for (let q = 1; q <= 4; q++) runPeriod(q === 1 || q === 3, quarterStints)
  let ot = 0
  while (score.home === score.away) {
    ot++
    for (const s of ['home', 'away'] as Side[]) {
      const c = sides[s]
      c.target = minutesTargets({ starters: c.starters, bench: c.ids.filter((id) => !c.starters.includes(id)) }, players, ot)
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
