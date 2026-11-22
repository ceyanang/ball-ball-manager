import { OT_MIN, QUARTER_MIN, STARTERS } from '../constants'
import { computeOvr } from '../player/ratings'
import type { Rng } from '../rng'
import type { BoxLine, Coach, CoachStyle, GameResult, Player, Team } from '../types'
import { gameLineup, minutesTargets } from './rotation'

/** Tuning constants (calibrated by the realism tests). */
export const K = {
  basePace: 97,
  paceStyle: 4,
  defenseStylePace: -2,
  tovBase: 0.13,
  stealShare: 0.55,
  commonFoul: 0.07,
  rimBase: 0.56,
  midBase: 0.38,
  threeBase: 0.32,
  shooterK: 0.004,
  defK: 0.003,
  defenseStyle: 0.015,
  home: 0.008,
  blockRim: 0.07,
  blockMid: 0.02,
  foulRim: 0.22,
  foulMid: 0.08,
  foulThree: 0.03,
  andOne: 0.45,
  orebBase: 0.24,
  usageExp: 2.5,
  threeStyle: 1.25,
}

type Side = 'home' | 'away'
interface Ctx {
  team: Team
  style: CoachStyle
  ids: string[]
  starters: string[]
  onCourt: string[]
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
      usage[id] = Math.pow(scoring / 60, K.usageExp)
      box[id] = {
        playerId: id, teamId: team.id, gs: lu.starters.includes(id), min: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0,
        blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
      }
    }
    return {
      team, style: coaches[team.coachId]?.style ?? 'balanced', ids, starters: lu.starters, onCourt: [],
      played: Object.fromEntries(ids.map((id) => [id, 0])), target: minutesTargets(lu, players, 0), quarters: [],
    }
  }
  const sides: Record<Side, Ctx> = { home: makeSide(home), away: makeSide(away) }
  const score: Record<Side, number> = { home: 0, away: 0 }
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

  const paceOf = (s: CoachStyle) => K.basePace + (s === 'pace' ? K.paceStyle : s === 'defense' ? K.defenseStylePace : 0)
  const poss48 = (paceOf(sides.home.style) + paceOf(sides.away.style)) / 2 + rng.normal(0, 3)

  const chooseFive = (c: Ctx, forceStarters: boolean) => {
    if (forceStarters) {
      c.onCourt = [...c.starters]
      return
    }
    const ranked = [...c.ids].sort((a, b) => {
      const ra = c.target[a] - c.played[a] + (c.onCourt.includes(a) ? 1.5 : 0)
      const rb = c.target[b] - c.played[b] + (c.onCourt.includes(b) ? 1.5 : 0)
      return rb - ra
    })
    c.onCourt = ranked.slice(0, STARTERS)
  }

  const addPoints = (off: Side, pts: number, shooter: string) => {
    score[off] += pts
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
      box[rng.weighted(o, (id) => R(id).oreb ** 2)].oreb++
      return true
    }
    box[rng.weighted(d, (id) => R(id).dreb ** 2)].dreb++
    return false
  }

  const freeThrows = (off: Side, shooter: string, n: number): boolean => {
    const pct = 0.48 + R(shooter).ft * 0.0045
    let lastMade = true
    for (let i = 0; i < n; i++) {
      box[shooter].fta++
      lastMade = rng.chance(pct)
      if (lastMade) {
        box[shooter].ftm++
        addPoints(off, 1, shooter)
      }
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
    const tovP = K.tovBase + (mean(d, (id) => R(id).stl) - 60) * 0.0015 - ((hr.handle + hr.iq) / 2 - 60) * 0.0015
    if (rng.chance(tovP)) {
      box[handler].tov++
      if (rng.chance(K.stealShare)) box[rng.weighted(d, (id) => R(id).stl ** 2)].stl++
      return
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const shooter = rng.weighted(o, (id) => usage[id])
      const r = R(shooter)
      const wRim = Math.max(1, r.ins - 20), wMid = Math.max(1, r.mid - 30) * 0.6
      const wThree = Math.max(1, r.three - 35) * 1.4 * (oStyle === 'three' ? K.threeStyle : 1)
      const type = rng.weighted(['rim', 'mid', 'three'] as const, (t) => (t === 'rim' ? wRim : t === 'mid' ? wMid : wThree))
      const perD = mean(d, (id) => R(id).perD), intD = mean(d, (id) => R(id).intD)
      let p =
        type === 'rim' ? K.rimBase + (r.ins - 60) * K.shooterK - (intD - 60) * K.defK
        : type === 'mid' ? K.midBase + (r.mid - 60) * K.shooterK - (perD - 60) * K.defK
        : K.threeBase + (r.three - 60) * K.shooterK - (perD - 60) * K.defK * 0.67
      p += ((r.iq + r.ath) / 2 - 60) * 0.001
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
          maybeAssist(o, shooter, type)
          if (freeThrows(off, shooter, 1) || !rebound(off)) return
          continue
        }
        if (freeThrows(off, shooter, pts) || !rebound(off)) return
        continue
      }
      box[shooter].fga++
      if (pts === 3) box[shooter].tpa++
      const blockP = type === 'rim' ? K.blockRim + (mean(d, (id) => R(id).blk) - 60) * 0.002 : type === 'mid' ? K.blockMid : 0
      if (blockP > 0 && rng.chance(blockP)) {
        box[rng.weighted(d, (id) => R(id).blk ** 2)].blk++
        if (!rebound(off)) return
        continue
      }
      if (rng.chance(p)) {
        box[shooter].fgm++
        if (pts === 3) box[shooter].tpm++
        addPoints(off, pts, shooter)
        maybeAssist(o, shooter, type)
        return
      }
      if (!rebound(off)) return
    }
  }

  const maybeAssist = (o: string[], shooter: string, type: 'rim' | 'mid' | 'three') => {
    const p = type === 'rim' ? 0.5 : type === 'mid' ? 0.6 : 0.8
    if (!rng.chance(p)) return
    const mates = o.filter((id) => id !== shooter)
    box[rng.weighted(mates, (id) => R(id).pass ** 2)].ast++
  }

  let carry = 0
  let offense: Side = rng.chance(0.5) ? 'home' : 'away'
  const runPeriod = (isPeriodStart: boolean, stints: number[]) => {
    sides.home.quarters.push(0)
    sides.away.quarters.push(0)
    stints.forEach((sl, i) => {
      for (const s of ['home', 'away'] as Side[]) chooseFive(sides[s], isPeriodStart && i === 0)
      for (const s of ['home', 'away'] as Side[]) for (const id of sides[s].onCourt) sides[s].played[id] += sl
      carry += (2 * poss48 * sl) / 48
      const n = Math.floor(carry)
      carry -= n
      for (let k = 0; k < n; k++) {
        possession(offense)
        offense = other(offense)
      }
    })
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

  return {
    homeScore: score.home,
    awayScore: score.away,
    quarters: { home: sides.home.quarters, away: sides.away.quarters },
    ot,
    box: lines,
    potg,
  }
}
