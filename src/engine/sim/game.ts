import { OT_MIN, QUARTER_MIN, STARTERS } from '../constants'
import type { Rng } from '../rng'
import type { BoxLine, Coach, CoachStyle, GameResult, Player, Team } from '../types'
import type { PlayEvent, Side } from './playlog'
import type { GameMods } from '../events/mods'
import { drawRivalForms } from '../rivals/tilt'
import { generatePlayerArchetype } from '../player/archetype'
import { applyHabits } from '../player/playStyle'
import { gameLineup, lineupPenalties, minutesTargets, SLOTS, slotFit } from './rotation'
import { chooseSubs, isBlowout, returnStarterSwaps, SUB } from './subs'
import { MomentPause, bestOption, lookFor, momentTriggers, type MomentOption } from './moments'

/** Tuning constants (calibrated by the realism tests). */
export const K = {
  /** Rival-game volatility (make-probability units): each player's on/off-night spread and the vet/new-guy mean tilt. */
  rivalSd: 0.10,
  rivalTilt: 0.03,
  /** Rating treated as league-average in all make/miss formulas. */
  pivot: 75,
  basePace: 97,
  paceStyle: 4,
  defenseStylePace: -2,
  tovBase: 0.132,
  stealShare: 0.56,
  commonFoul: 0.07,
  rimBase: 0.585,
  closeBase: 0.495,
  postBase: 0.47,
  midBase: 0.382,
  threeBase: 0.302,
  shooterK: 0.0038,
  defK: 0.0028,
  defenseStyle: 0.015,
  home: 0.014,
  blockRim: 0.12,
  blockMid: 0.032,
  foulRim: 0.225,
  foulPost: 0.18,
  foulMid: 0.08,
  foulThree: 0.032,
  andOne: 0.44,
  orebBase: 0.24,
  usageExp: 3.1,
  threeStyle: 1.25,
  /** Make-probability lost per OVR point of out-of-position cost (C at PG ≈ −9.1%). */
  oopShot: 0.0035,
  /** Share of defenders' out-of-position cost taken off their perimeter/interior D. */
  oopDef: 0.5,
  /** Make-probability per morale point away from 60 (≈ ±1.6% at the extremes). */
  morale: 0.0004,
  /** Make-probability per team-chemistry point away from 50 (≈ ±2% at the extremes). */
  chemistry: 0.0004,
  /** Make-probability the trailing offense gains per point behind (capped at `rubberCap` points): pressing, the leader coasting. */
  rubber: 0.0035,
  rubberCap: 25,
  /** Personal fouls that disqualify a player. */
  foulOut: 6,
}

/**
 * In-game energy (0–100). Everyone tips off fresh; minutes on the floor drain it (slower with a high stamina
 * rating, and slower again while a player is hot), the bench and the breaks refill it. Below `line` a tired
 * player shoots, handles, moves (`agility`/`speed`) and defends worse, so riding the starters 44 minutes costs you late.
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
  line: 72,
  /** Make-probability lost per point of energy under the line (the cost grows: see `fatigueCost`). */
  shot: 0.0022,
  /** Points under the line at which the shooting/turnover cost has doubled. */
  ramp: 30,
  /** Defensive/mobility rating lost per point under the line. */
  def: 1.3,
  /** Turnover probability added per point under the line. */
  tov: 0.0012,
}

/** Shooting/turnover weight of `under` energy points below the line: gentle at first, steep when exhausted. */
export const fatigueCost = (under: number): number => under * (1 + under / FATIGUE.ramp)

/** Energy lost by `p` over one minute on the floor. */
export function drainPerMinute(p: Player, hot: boolean): number {
  return FATIGUE.drain * (1 - FATIGUE.stamRelief * (p.ratings.stamina / 99)) * (hot ? FATIGUE.hotDrain : 1)
}

export type ShotZone = 'layup' | 'driveDunk' | 'standDunk' | 'close' | 'post' | 'mid' | 'three'

interface PlayerSim {
  usage: number
  handlerW: number
  rebOffW: number
  rebDefW: number
  stealW: number
  blockW: number
  passerW: number
  shotZoneW: [number, number, number, number, number, number, number]
  offSpread: number
  defSpread: number
  paceSkill: number
  foulDrawMult: number
  tovDelta: number
  assistShareDelta: number
  isSlasherOrForce: boolean
  isShooterRole: boolean
  isLobFinisher: boolean
  // Precomputed unit-synergy role flags so computeSynergy runs in pure integer loops
  synShooter80: boolean
  synNonShooter: boolean
  synStretchBig: boolean
  synPlaymaker: boolean
  synShooterTarget: boolean
  synLobTarget: boolean
  synRimProtector: boolean
  synWeakPerim: boolean
  synLockdown: boolean
}

interface LineupSynergy {
  spacing: number
  playmaking: number
  rollerHands: number
  helpAnchor: number
  stealThreat: number
  passDisrupt: number
  rimBlock: number
  orebPower: number
  drebPower: number
  hustleMean: number
  spacingRimBonus: number
  linkThreeBonus: number
  linkDunkBonus: number
  linkAssistBonus: number
  rimAnchorPaintPenalty: number
  lockdownTovBoost: number
  lockdownStealBoost: number
  clutterPaintPenalty: number
  unitAssistDelta: number
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
  dnp?: string[]
  quarters: number[]
  syn: LineupSynergy
}

const SIDES: readonly Side[] = ['home', 'away']
const ZONES: ShotZone[] = ['layup', 'driveDunk', 'standDunk', 'close', 'post', 'mid', 'three']

export function simGame(
  home: Team,
  away: Team,
  playersIn: Record<string, Player>,
  coaches: Record<string, Coach>,
  rng: Rng,
  log?: PlayEvent[],
  mods?: GameMods,
): GameResult {
  // A rested player is treated as unavailable for this game only (a copy; the league's player is untouched).
  const players = mods?.sit.length ? { ...playersIn, ...Object.fromEntries(mods.sit.filter((id) => playersIn[id]).map((id) => [id, { ...playersIn[id], injury: playersIn[id].injury ?? { type: 'Rest', gamesRemaining: 1, severity: 'dtd' as const } }])) } : playersIn
  for (const t of [home, away]) {
    const n = new Set([...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive].filter((id) => players[id])).size
    if (n < STARTERS) throw new Error(`${t.name} has fewer than ${STARTERS} players and cannot play a game (has ${n}).`)
  }
  const momentSeed = rng.state.s
  const R = (id: string) => players[id].ratings
  const prof: Record<string, PlayerSim> = {}
  const box: Record<string, BoxLine> = {}
  /** Energy 0–100 and the hot streak (made minus missed shots, 0..5) per player. */
  const energy: Record<string, number> = {}
  const heat: Record<string, number> = {}
  /** Quarter-by-quarter consistency variance (refreshed each period from offensiveConsistency / defensiveConsistency). */
  const qOffMod: Record<string, number> = {}
  const qDefMod: Record<string, number> = {}
  /** Rival games only: a player's make-probability shift for the whole game. */
  const rivalForm: Record<string, number> = {}
  const tired = (id: string) => Math.max(0, FATIGUE.line - (energy[id] ?? 100))
  const shotHeat = (id: string, made: boolean) => { heat[id] = Math.max(0, Math.min(5, (heat[id] ?? 0) + (made ? 1 : -1))) }

  const computeSynergy = (onCourt: string[]): LineupSynergy => {
    const n = Math.max(1, onCourt.length)
    let three = 0, playSum = 0, playMax = 0, hands = 0, dunks = 0
    let help = 0, intD = 0, blk = 0, stl = 0, passPerc = 0, vert = 0
    let oreb = 0, dreb = 0, str = 0, hus = 0
    let unitAssistDelta = 0
    let shooters80 = 0, nonShooters = 0, stretchBigs = 0, playmakers = 0
    let shooterTargets = 0, lobTargets = 0, rimProtectors = 0, weakPerim = 0, lockdowns = 0
    let selfShooterPlay = 0, selfLobPlay = 0
    for (let i = 0; i < onCourt.length; i++) {
      const id = onCourt[i]
      const r = R(id)
      three += r.threePointShot
      const pm = r.passVision * 0.55 + r.passIQ * 0.45
      playSum += pm
      if (pm > playMax) playMax = pm
      hands += r.hands
      dunks += r.standingDunk * 0.6 + r.drivingDunk * 0.4
      help += r.helpDefenseIQ
      intD += r.interiorDefense
      blk += r.block
      stl += r.steal
      passPerc += r.passPerception
      vert += r.vertical
      oreb += r.offensiveRebound
      dreb += r.defensiveRebound
      str += r.strength
      hus += r.hustle
      const pr = prof[id]
      if (pr) {
        if (pr.assistShareDelta > unitAssistDelta) unitAssistDelta = pr.assistShareDelta
        if (pr.synShooter80) shooters80++
        if (pr.synNonShooter) nonShooters++
        if (pr.synStretchBig) stretchBigs++
        if (pr.synPlaymaker) {
          playmakers++
          if (pr.synShooterTarget) selfShooterPlay++
          if (pr.synLobTarget) selfLobPlay++
        }
        if (pr.synShooterTarget) shooterTargets++
        if (pr.synLobTarget) lobTargets++
        if (pr.synRimProtector) rimProtectors++
        if (pr.synWeakPerim) weakPerim++
        if (pr.synLockdown) lockdowns++
      }
    }
    const spacingActive = shooters80 >= 3 || stretchBigs >= 1
    const hasShooterPair = playmakers >= 1 && (shooterTargets - selfShooterPlay >= 1 || playmakers >= 2 && shooterTargets >= 1)
    const hasFinisherPair = playmakers >= 1 && (lobTargets - selfLobPlay >= 1 || playmakers >= 2 && lobTargets >= 1)
    const playmakerLinkActive = playmakers >= 1 && (hasShooterPair || hasFinisherPair)
    const rimAnchorActive = rimProtectors >= 1 && weakPerim >= 1
    const lockdownClampActive = lockdowns >= 2
    const paintClutterActive = nonShooters >= 3
    const avgThree = three / n
    const avgPlay = playSum / n
    const avgHandsDunk = (hands * 0.5 + dunks * 0.5) / n
    return {
      spacing: (avgThree - K.pivot) * 0.00048,
      playmaking: (playMax * 0.48 + avgPlay * 0.52 - K.pivot) * 0.0005,
      rollerHands: (avgHandsDunk - K.pivot) * 0.00032,
      helpAnchor: (help * 0.5 + intD * 0.25 + blk * 0.25) / n - K.pivot,
      stealThreat: (stl * 0.58 + passPerc * 0.28 + help * 0.14) / n,
      passDisrupt: ((passPerc * 0.6 + help * 0.4) / n - K.pivot) * 0.0007,
      rimBlock: (blk * 0.78 + vert * 0.22) / n,
      orebPower: (oreb * 0.64 + vert * 0.14 + str * 0.12 + hus * 0.10) / n,
      drebPower: (dreb * 0.64 + vert * 0.14 + str * 0.12 + hus * 0.10) / n,
      hustleMean: hus / n,
      spacingRimBonus: spacingActive ? 0.026 : 0,
      linkThreeBonus: hasShooterPair ? 0.014 : 0,
      linkDunkBonus: hasFinisherPair ? 0.025 : 0,
      linkAssistBonus: playmakerLinkActive ? 0.022 : 0,
      rimAnchorPaintPenalty: rimAnchorActive ? 0.020 : 0,
      lockdownTovBoost: lockdownClampActive ? 0.015 : 0,
      lockdownStealBoost: lockdownClampActive ? 0.030 : 0,
      clutterPaintPenalty: paintClutterActive ? 0.026 : 0,
      unitAssistDelta,
    }
  }

  const makeSide = (team: Team): Ctx => {
    const lu = gameLineup(team, players)
    const ids = [...lu.starters, ...lu.bench]
    for (const id of ids) {
      const p = players[id]
      const r = p.ratings
      const arch = generatePlayerArchetype(p)
      // Play style habits ride on top of the archetype (archetype detection still reads stored ratings).
      const style = applyHabits(arch.tendencies, p.playStyle)
      const t = style.t
      const rimThreat = Math.max(r.layup, r.drivingDunk, r.standingDunk, r.closeShot)
      const postThreat = r.postControl * 0.45 + Math.max(r.postHook, r.postFade) * 0.55
      const bestScore = Math.max(rimThreat, r.midRangeShot, r.threePointShot, postThreat)
      const avgScore = (rimThreat + r.midRangeShot + r.threePointShot) / 3
      const creator = (r.ballHandle + r.speedWithBall) * 0.5
      // Intangibles is intentionally excluded from raw sim usage/shot formulas (affects OVR only).
      const scoring = bestScore * 0.56 + avgScore * 0.22 + creator * 0.14 + r.shotIQ * 0.08
      const iqTilt = (r.shotIQ - K.pivot) * 0.004

      // Shot-zone weights: 3PT, mid, layup, drivingDunk, standingDunk, closeShot, post
      const wLayup = Math.max(1, r.layup * 0.65 + r.speedWithBall * 0.2 + r.agility * 0.15 - 24) * 0.52
      const wDriveDunk = Math.max(0.5, r.drivingDunk * 0.72 + r.vertical * 0.18 + r.speedWithBall * 0.1 - 36) * 0.34
      const wStandDunk = Math.max(0.5, r.standingDunk * 0.75 + r.strength * 0.15 + r.hands * 0.1 - 40) * 0.3
      const wClose = Math.max(1, r.closeShot * 0.8 + r.hands * 0.2 - 26) * 0.4
      const wPost = Math.max(0.4, r.postControl * 0.48 + r.strength * 0.22 + Math.max(r.postHook, r.postFade) * 0.3 - 44) * 0.32
      // Higher shotIQ curbs forced mid-range jumpers and low-skill 3PA chucking
      const wMid = Math.max(1, r.midRangeShot - 30) * 0.5 * Math.max(0.6, 1 - iqTilt * (r.midRangeShot < 72 ? 1.2 : 0.4))
      const wThree = Math.max(1, r.threePointShot - 32) * 1.48 * Math.max(0.5, 1 + (r.threePointShot >= 74 ? iqTilt * 0.6 : -iqTilt))
      const zm = t.zoneMult

      prof[id] = {
        usage: Math.pow(scoring / K.pivot, K.usageExp) * t.usageMult,
        handlerW: Math.pow(scoring / K.pivot, K.usageExp) * (0.45 * r.ballHandle + 0.35 * r.speedWithBall + 0.2 * r.passVision) * t.handlerMult,
        rebOffW: (0.62 * r.offensiveRebound + 0.15 * r.vertical + 0.13 * r.strength + 0.1 * r.hustle) ** 2 * style.rebOffMult,
        rebDefW: (0.62 * r.defensiveRebound + 0.15 * r.vertical + 0.13 * r.strength + 0.1 * r.hustle) ** 2 * style.rebDefMult,
        stealW: ((0.64 * r.steal + 0.22 * r.passPerception + 0.14 * r.helpDefenseIQ) ** 2) * t.stealMult,
        blockW: ((0.76 * r.block + 0.24 * r.vertical) ** 3) * t.blockMult,
        passerW: ((0.5 * r.passVision + 0.3 * r.passIQ + 0.2 * r.passAccuracy) ** 5.5) * t.passerMult,
        shotZoneW: [
          wLayup * zm[0],
          wDriveDunk * zm[1],
          wStandDunk * zm[2],
          wClose * zm[3],
          wPost * zm[4],
          wMid * zm[5],
          wThree * zm[6],
        ],
        offSpread: 0.11 * (1 - (r.offensiveConsistency - 25) / 80),
        defSpread: 6.5 * (1 - (r.defensiveConsistency - 25) / 80),
        paceSkill: r.speed * 0.5 + r.agility * 0.3 + r.speedWithBall * 0.1 + r.hustle * 0.1 + style.paceDelta,
        foulDrawMult: t.foulDrawMult,
        tovDelta: t.tovDelta,
        assistShareDelta: t.assistShareDelta,
        isSlasherOrForce:
          arch.baseRole === 'Slasher' ||
          arch.baseRole === 'Slashing Playmaker' ||
          arch.baseRole === 'Interior Force' ||
          arch.baseRole === 'Paint Beast' ||
          arch.baseRole === 'Glass-Cleaning Finisher',
        isShooterRole:
          arch.baseRole === 'Sharpshooter' ||
          arch.baseRole === '3&D Wing' ||
          arch.baseRole === 'Stretch Four' ||
          arch.baseRole === 'Stretch Five' ||
          arch.pillars.shooting >= 82,
        isLobFinisher:
          r.hands >= 78 &&
          (arch.baseRole === 'Paint Beast' ||
            arch.baseRole === 'Glass-Cleaning Finisher' ||
            arch.baseRole === 'Interior Force' ||
            arch.baseRole === 'Slasher' ||
            Math.max(r.standingDunk, r.drivingDunk) >= 82),
        synShooter80: arch.pillars.shooting >= 80,
        synNonShooter: r.threePointShot < 70,
        synStretchBig:
          (p.pos === 'PF' || p.pos === 'C') &&
          (arch.baseRole === 'Stretch Four' ||
            arch.baseRole === 'Stretch Five' ||
            arch.modifiers.includes('Floor-Spacing') ||
            arch.modifiers.includes('Inside-Out')),
        synPlaymaker:
          (arch.baseRole === 'Floor General' ||
            arch.baseRole === 'Point Forward' ||
            arch.baseRole === 'Playmaking Big' ||
            arch.modifiers.includes('Diming')) &&
          r.passVision >= 78,
        synShooterTarget:
          arch.baseRole === 'Sharpshooter' ||
          arch.baseRole === '3&D Wing' ||
          arch.baseRole === 'Stretch Four' ||
          arch.baseRole === 'Stretch Five' ||
          arch.pillars.shooting >= 82,
        synLobTarget:
          r.hands >= 78 &&
          (arch.baseRole === 'Paint Beast' ||
            arch.baseRole === 'Glass-Cleaning Finisher' ||
            arch.baseRole === 'Interior Force' ||
            arch.baseRole === 'Slasher' ||
            Math.max(r.standingDunk, r.drivingDunk) >= 82),
        synRimProtector:
          (arch.baseRole === 'Rim Protector' && (r.block + r.helpDefenseIQ) / 2 >= 80) ||
          (r.block + r.helpDefenseIQ) / 2 >= 84,
        synWeakPerim: r.perimeterDefense < 72 || arch.pillars.perimeterDefense < 72,
        synLockdown:
          arch.baseRole === 'Perimeter Lockdown' ||
          arch.baseRole === '3&D Wing' ||
          arch.baseRole === 'Wing Stopper' ||
          (arch.modifiers.includes('2-Way') && arch.pillars.perimeterDefense >= 82),
      }
      energy[id] = Math.max(0, 100 + Math.min(0, mods?.energy[id] ?? 0))
      heat[id] = 0
      qOffMod[id] = 0
      qDefMod[id] = 0
      box[id] = {
        playerId: id, teamId: team.id, gs: lu.starters.includes(id), min: 0, pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0,
        blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pm: 0,
      }
    }
    return {
      team, style: coaches[team.coachId]?.style ?? 'balanced', ids, starters: lu.starters, onCourt: [], pen: {},
      played: Object.fromEntries(ids.map((id) => [id, 0])), stint: Object.fromEntries(ids.map((id) => [id, 0])),
      blowoutSeen: false, plan: team.rotation.minutes,
      dnp: team.rotation.minutes ? ids.filter((id) => team.rotation.minutes![id] === 0 && !lu.starters.includes(id)) : undefined,
      target: minutesTargets(lu, players, 0, team.rotation.minutes),
      quarters: [], syn: computeSynergy(lu.starters),
    }
  }
  const sides: Record<Side, Ctx> = { home: makeSide(home), away: makeSide(away) }
  const sideOf: Record<string, Side> = {}
  for (const s of SIDES) for (const id of sides[s].ids) sideOf[id] = s
  const score: Record<Side, number> = { home: 0, away: 0 }
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

  const rotPace = (c: Ctx) => {
    let s = 0
    for (let i = 0; i < Math.min(8, c.ids.length); i++) s += prof[c.ids[i]].paceSkill
    return (s / Math.max(1, Math.min(8, c.ids.length)) - K.pivot) * 0.1
  }
  const paceOf = (c: Ctx) => K.basePace + (c.style === 'pace' ? K.paceStyle : c.style === 'defense' ? K.defenseStylePace : 0) + rotPace(c)
  const poss48 = (paceOf(sides.home) + paceOf(sides.away)) / 2 + rng.normal(0, 3)

  // Story tracking only (no RNG): the last lead change and each side's biggest deficit.
  let possNo = 0, periodNo = 0, lastStint = false
  /** MyCareer moments: the game seed (the Rng state at tip-off, so replays agree) and how many moments have come up. */
  const gameSeed = momentSeed
  let momentCount = 0
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
  const refreshPen = (c: Ctx) => {
    c.pen = lineupPenalties(c.onCourt, c.starters, players)
    c.syn = computeSynergy(c.onCourt)
  }
  /** Apply swaps (logging each one) and refresh the out-of-position costs + lineup synergy. */
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
  const fouledOut = (c: Ctx) => c.ids.filter((id) => box[id].pf >= K.foulOut)
  /** Disqualified players leave the floor for the best-fitting eligible sitter (a planned DNP only as a last resort). */
  const foulOutSwaps = (c: Ctx) => {
    const out = fouledOut(c)
    const court = [...c.onCourt]
    const swaps: { slot: number; out: string; in: string }[] = []
    court.forEach((id, slot) => {
      if (!out.includes(id)) return
      const free = c.ids.filter((x) => !court.includes(x) && !out.includes(x))
      const ready = free.filter((x) => !(c.plan && c.plan[x] === 0))
      const pool = ready.length ? ready : free
      if (!pool.length) return
      const pick = pool.reduce((b, x) => (slotFit(players[x], SLOTS[slot]) > slotFit(players[b], SLOTS[slot]) ? x : b))
      swaps.push({ slot, out: id, in: pick })
      court[slot] = pick
    })
    return swaps
  }
  /** The coach's per-minute swaps (no RNG). */
  const subStep = (side: Side, minuteInPeriod: number, periodMinutes: number) => {
    const c = sides[side]
    if (c.onCourt.length !== STARTERS) return
    const margin = score[side] - score[other(side)]
    if (isBlowout(periodNo, Math.abs(margin))) c.blowoutSeen = true
    const out = fouledOut(c)
    if (out.length) applySwaps(side, foulOutSwaps(c))
    const starters = out.length ? c.starters.filter((id) => !out.includes(id)) : c.starters
    const sitting: string[] = []
    for (let i = 0; i < c.ids.length; i++) {
      const id = c.ids[i]
      if (!c.onCourt.includes(id) && (!out.length || !out.includes(id))) sitting.push(id)
    }
    applySwaps(side, chooseSubs({
      period: periodNo, minuteInPeriod, periodMinutes, elapsed, gameMinutes: 48 + OT_MIN * ot, margin, onCourt: c.onCourt,
      sitting, stint: c.stint, played: c.played, target: c.target,
      starters, players, blowoutSeen: c.blowoutSeen, energy, dnp: c.dnp,
    }))
    if (c.blowoutSeen && Math.abs(margin) < SUB.blowoutReturn && starters.every((id) => c.onCourt.includes(id))) c.blowoutSeen = false
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
    const oc = sides[off], dc = sides[other(off)]
    const o = oc.onCourt, d = dc.onCourt
    const p = K.orebBase + (oc.syn.orebPower - dc.syn.drebPower) * 0.0028 + (oc.syn.hustleMean - dc.syn.hustleMean) * 0.0006
    if (rng.chance(p)) {
      const id = rng.weighted(o, (id) => prof[id].rebOffW)
      box[id].oreb++
      emit({ k: 'reb', side: off, player: id, off: true })
      return true
    }
    const id = rng.weighted(d, (id) => prof[id].rebDefW)
    box[id].dreb++
    emit({ k: 'reb', side: other(off), player: id, off: false })
    return false
  }

  const freeThrows = (off: Side, shooter: string, n: number): boolean => {
    const pct = 0.43 + R(shooter).freeThrow * 0.0045
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

  /** A defender picks up a foul: perimeter or interior defenders weighted by play zone. */
  const foul = (d: string[], guard: 'perimeterDefense' | 'interiorDefense') => {
    const id = rng.weighted(d, (id) => 40 + R(id)[guard])
    box[id].pf++
  }

  const maybeAssist = (off: Side, o: string[], shooter: string, zone: ShotZone) => {
    const oc = sides[off], dc = sides[other(off)]
    const base = zone === 'standDunk' ? 0.68 : zone === 'three' ? 0.78 : zone === 'mid' ? 0.56 : zone === 'post' ? 0.34 : 0.48
    const p = base + oc.syn.playmaking * 8 - dc.syn.passDisrupt * 5 + oc.syn.linkAssistBonus + oc.syn.unitAssistDelta * 0.5
    if (!rng.chance(p)) return
    const mates = o.filter((id) => id !== shooter)
    const passer = rng.weighted(mates, (id) => prof[id].passerW)
    box[passer].ast++
    emit({ k: 'ast', side: sideOf[passer], player: passer })
  }

  const possession = (off: Side) => {
    const oc = sides[off], dc = sides[other(off)]
    const o = oc.onCourt, d = dc.onCourt
    const oStyle = oc.style, dStyle = dc.style
    if (rng.chance(K.commonFoul)) foul(d, 'perimeterDefense')

    // Turnover (live-ball handle/speedWithBall/hands + bad-pass passAccuracy/passIQ vs steal/passPerception/helpDefenseIQ)
    const handler = rng.weighted(o, (id) => prof[id].handlerW)
    const hr = R(handler)
    const oPen = oc.pen, dPen = dc.pen
    const ballCare = hr.ballHandle * 0.32 + hr.passAccuracy * 0.32 + hr.hands * 0.2 + hr.passIQ * 0.16
    const tovP = Math.max(
      0.03,
      K.tovBase
        + (dc.syn.stealThreat - K.pivot) * 0.0014
        - (ballCare - K.pivot) * 0.0015
        + (oPen[handler] ?? 0) * 0.001
        + fatigueCost(tired(handler)) * FATIGUE.tov
        + prof[handler].tovDelta
        + dc.syn.lockdownTovBoost,
    )
    if (rng.chance(tovP)) {
      box[handler].tov++
      emit({ k: 'tov', side: off, player: handler })
      const stealP = K.stealShare + (dc.syn.stealThreat - (hr.passAccuracy + hr.hands) / 2) * 0.0015 + dc.syn.lockdownStealBoost
      if (rng.chance(stealP)) {
        const stealer = rng.weighted(d, (id) => prof[id].stealW)
        box[stealer].stl++
        emit({ k: 'stl', side: other(off), player: stealer })
      }
      return
    }

    const clutch = (periodNo === 4 && lastStint && Math.abs(score.home - score.away) <= 8) || periodNo > 4

    for (let attempt = 0; attempt < 6; attempt++) {
      let shooter = rng.weighted(o, (id) => prof[id].usage)
      let r = R(shooter)
      const zw = prof[shooter].shotZoneW
      const w6 = oStyle === 'three' ? zw[6] * K.threeStyle : zw[6]
      const zTot = zw[0] + zw[1] + zw[2] + zw[3] + zw[4] + zw[5] + w6
      let zr = rng.next() * zTot
      let zIdx = 6
      for (let k = 0; k < 6; k++) {
        zr -= zw[k]
        if (zr < 0) { zIdx = k; break }
      }
      let zone = ZONES[zIdx]

      // Live defensive ratings (accounting for OOP cost, progressive fatigue hurting agility/speed/defense, and quarter consistency)
      let perSum = 0, intSum = 0
      const clutchDefBoost = clutch ? 1 : 0
      for (let di = 0; di < d.length; di++) {
        const id = d[di]
        const dr = players[id].ratings
        const t = energy[id] < FATIGUE.line ? FATIGUE.line - energy[id] : 0
        const modD = mods?.defense[id] ?? 0
        const cost = (dPen[id] ?? 0) * K.oopDef + t * FATIGUE.def - modD - qDefMod[id] - clutchDefBoost * ((dr.defensiveConsistency - 70) * 0.1)
        perSum += dr.perimeterDefense * 0.72 + dr.agility * 0.28 - cost
        intSum += dr.interiorDefense * 0.68 + dr.strength * 0.18 + dr.vertical * 0.14 - cost
      }
      const perD = perSum / d.length
      const intD = intSum / d.length
      // Weak perimeter defenders are partially covered by high helpDefenseIQ / rim anchor teammates
      const helpCover = Math.max(0, dc.syn.helpAnchor) * 0.25

      /** Make probability for `shooter` taking a `zone` shot right now (pure: no Rng), shared by the shot and by moment descriptors. */
      const shotProb = (shooter: string, zone: ShotZone): number => {
        const r = R(shooter)
        const sp = prof[shooter]
        const uEff = oc.syn
        const dEff = dc.syn
        const paintSyn =
          uEff.spacingRimBonus * (sp.isSlasherOrForce ? 1 : 0.3) -
          uEff.clutterPaintPenalty -
          dEff.rimAnchorPaintPenalty

        let p: number
        if (zone === 'three') {
          const contest = (perD - K.pivot) * K.defK * 0.67 * (1 - (r.shotIQ - K.pivot) * 0.004)
          p =
            K.threeBase +
            (r.threePointShot - K.pivot) * K.shooterK -
            contest +
            oc.syn.playmaking * 0.7 +
            uEff.linkThreeBonus * (sp.isShooterRole ? 1 : 0.45)
        } else if (zone === 'mid') {
          const contest = (perD - K.pivot) * K.defK * (1 - (r.shotIQ - K.pivot) * 0.004)
          p = K.midBase + (r.midRangeShot - K.pivot) * K.shooterK - contest + oc.syn.playmaking * 0.4
        } else if (zone === 'layup') {
          const driveSkill = r.layup * 0.72 + r.speedWithBall * 0.14 + r.agility * 0.08 + r.hands * 0.06
          const rimDef = intD * 0.68 + perD * 0.32 + helpCover
          p = K.rimBase + (driveSkill - K.pivot) * K.shooterK - (rimDef - K.pivot) * K.defK + oc.syn.spacing + oc.syn.playmaking * 0.5 + paintSyn
        } else if (zone === 'driveDunk') {
          const dunkSkill = r.drivingDunk * 0.72 + r.vertical * 0.18 + r.speedWithBall * 0.1
          const rimDef = intD * 0.75 + perD * 0.25 + helpCover
          p =
            K.rimBase +
            0.03 +
            (dunkSkill - K.pivot) * K.shooterK -
            (rimDef - K.pivot) * K.defK +
            oc.syn.spacing +
            oc.syn.playmaking * 0.5 +
            paintSyn +
            uEff.linkDunkBonus * (sp.isLobFinisher ? 1 : 0.4)
        } else if (zone === 'standDunk') {
          const finishSkill = r.standingDunk * 0.7 + r.hands * 0.18 + r.strength * 0.12
          p =
            K.rimBase +
            0.04 +
            (finishSkill - K.pivot) * K.shooterK -
            (intD - K.pivot) * K.defK +
            oc.syn.playmaking * 0.7 +
            oc.syn.rollerHands +
            paintSyn +
            uEff.linkDunkBonus * (sp.isLobFinisher ? 1 : 0.4)
        } else if (zone === 'close') {
          const touchSkill = r.closeShot * 0.82 + r.hands * 0.18
          p = K.closeBase + (touchSkill - K.pivot) * K.shooterK - (intD + helpCover * 0.6 - K.pivot) * K.defK + oc.syn.spacing * 0.7 + paintSyn
        } else {
          const postSkill = r.postHook * 0.42 + r.postFade * 0.33 + r.postControl * 0.15 + r.strength * 0.1
          p = K.postBase + (postSkill - K.pivot) * K.shooterK - (intD - K.pivot) * K.defK + oc.syn.spacing * 0.8 + paintSyn
        }

        // Shot IQ, athleticism/speed edge, quarter consistency, fatigue, OOP, morale, chemistry, HFA, rubberband
        p += (r.shotIQ - K.pivot) * 0.0007
        p += ((r.speed + r.agility) * 0.5 - K.pivot) * 0.0005
        p += qOffMod[shooter] + (rivalForm[shooter] ?? 0)
        if (clutch) p += (r.offensiveConsistency - 70) * 0.0005
        p -= (oPen[shooter] ?? 0) * K.oopShot
        p -= fatigueCost(tired(shooter)) * FATIGUE.shot
        p += ((players[shooter].morale ?? 60) - 60) * K.morale
        p += (mods?.shooting[shooter] ?? 0) * 0.01 + ((mods?.chemistry[oc.team.id] ?? 50) - 50) * K.chemistry
        if (dStyle === 'defense') p -= K.defenseStyle
        if (off === 'home') p += K.home
        p += Math.min(K.rubberCap, Math.max(0, score[other(off)] - score[off])) * K.rubber
        return p
      }

      let p = shotProb(shooter, zone)
      let sp = prof[shooter]
      const cm = mods?.career
      if (cm && shooter === cm.playerId) {
        const rate = Math.min(0.95, cm.rate * (clutch ? 1.6 : 1) * (mods?.volatility ? 1.3 : 1) * (cm.playoffs ? 1.3 : 1))
        if (momentTriggers(gameSeed, possNo, attempt, rate)) {
          const idx = momentCount++
          if (log && cm.marks) cm.marks[idx] = log.length
          const bestZone = (id: string): ShotZone => {
            const w = prof[id].shotZoneW
            let bi = 0
            for (let k = 1; k < 7; k++) if (w[k] > w[bi]) bi = k
            return ZONES[bi]
          }
          const driveZone: ShotZone = prof[shooter].shotZoneW[1] > prof[shooter].shotZoneW[0] ? 'driveDunk' : 'layup'
          const mates = o.filter((id) => id !== shooter)
            .map((id) => ({ id, zn: bestZone(id), v: shotProb(id, bestZone(id)) }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 2)
          const options: MomentOption[] = [
            { answer: { kind: 'shoot' }, label: 'Take the shot', look: lookFor(p) },
            { answer: { kind: 'drive' }, label: 'Attack the rim', look: lookFor(shotProb(shooter, driveZone)) },
            ...mates.map((m) => ({ answer: { kind: 'pass' as const, to: m.id }, label: `Pass to ${players[m.id].lastName}`, look: lookFor(m.v) })),
          ]
          let ans = cm.answers[idx]
          if (!ans) {
            if (!cm.auto) {
              const per = Math.max(1, Math.round((2 * poss48 * QUARTER_MIN) / 48))
              throw new MomentPause({
                index: idx, period: periodNo, clock: Math.round(Math.max(0, 1 - possInPeriod / per) * QUARTER_MIN * 60),
                score: { home: score.home, away: score.away }, options, clutch, rival: !!mods?.volatility,
              })
            }
            ans = bestOption(options).answer
          }
          if (ans.kind === 'drive') {
            zone = driveZone
            p = shotProb(shooter, zone)
          } else if (ans.kind === 'pass') {
            const to = ans.to
            if (o.includes(to) && to !== shooter) {
              shooter = to
              zone = bestZone(to)
              r = R(shooter)
              sp = prof[shooter]
              p = shotProb(shooter, zone)
            }
          }
          if (log && cm.plays) cm.plays[idx] = { kind: ans.kind, shooter, zone }
        }
      }

      const isRim = zone === 'layup' || zone === 'driveDunk' || zone === 'standDunk' || zone === 'close'
      const pts = zone === 'three' ? 3 : 2
      const baseFoul =
        zone === 'three' ? K.foulThree
        : zone === 'mid' ? K.foulMid
        : zone === 'post' ? K.foulPost + (r.postControl - K.pivot) * 0.001
        : K.foulRim + (zone === 'driveDunk' || zone === 'layup' ? (r.layup * 0.5 + r.drivingDunk * 0.5 - K.pivot) * 0.0007 : 0)
      const foulP = Math.max(0.01, baseFoul * (1 + (r.drawFoul - K.pivot) * 0.0075) * (isRim || zone === 'post' ? sp.foulDrawMult : 1))

      if (rng.chance(foulP)) {
        foul(d, isRim || zone === 'post' ? 'interiorDefense' : 'perimeterDefense')
        if (rng.chance(p * K.andOne)) {
          box[shooter].fga++
          box[shooter].fgm++
          if (pts === 3) { box[shooter].tpa++; box[shooter].tpm++ }
          addPoints(off, pts, shooter)
          emitScore({ k: 'fg', side: off, player: shooter, made: true, three: pts === 3 })
          maybeAssist(off, o, shooter, zone)
          if (freeThrows(off, shooter, 1) || !rebound(off)) return
          continue
        }
        if (freeThrows(off, shooter, pts) || !rebound(off)) return
        continue
      }

      box[shooter].fga++
      if (pts === 3) box[shooter].tpa++
      const blockP =
        isRim ? Math.max(0.01, K.blockRim + (dc.syn.rimBlock - K.pivot) * 0.002 - (r.vertical - K.pivot) * 0.0005)
        : zone === 'mid' || zone === 'post' ? Math.max(0.005, K.blockMid + (dc.syn.rimBlock - K.pivot) * 0.0005)
        : 0
      if (blockP > 0 && rng.chance(blockP)) {
        const blocker = rng.weighted(d, (id) => prof[id].blockW)
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
        maybeAssist(off, o, shooter, zone)
        return
      }
      emitScore({ k: 'fg', side: off, player: shooter, made: false, three: pts === 3 })
      if (!rebound(off)) return
    }
  }

  let carry = 0, elapsed = 0, ot = 0
  let offense: Side = rng.chance(0.5) ? 'home' : 'away'
  const runPeriod = (opening: boolean, stints: number[]) => {
    sides.home.quarters.push(0)
    sides.away.quarters.push(0)
    periodNo++
    possInPeriod = 0
    periodStart = pending.length
    // Rival games: one on/off night per player for the whole game, skewed up for long-time vets and down for new guys.
    if (periodNo === 1 && mods?.volatility) Object.assign(rivalForm, drawRivalForms(rng, mods.volatility, K.rivalTilt, K.rivalSd))
    // Refresh quarter-by-quarter consistency variance once per period for every active player.
    for (const s of SIDES) {
      for (const id of sides[s].ids) {
        qOffMod[id] = rng.normal(0, prof[id].offSpread)
        qDefMod[id] = rng.normal(0, prof[id].defSpread)
      }
    }
    if (periodNo > 1) {
      const rest = periodNo === 3 ? FATIGUE.halftime : FATIGUE.quarterBreak
      for (const id of Object.keys(energy)) energy[id] = Math.min(100, energy[id] + rest)
    }
    stints.forEach((sl, i) => {
      lastStint = i === stints.length - 1
      for (const s of SIDES) {
        const c = sides[s]
        if (periodNo === 1 && i === 0) {
          c.onCourt = [...c.starters]
          refreshPen(c)
          emit({ k: 'lineup', side: s, players: [...c.onCourt] })
        } else if (opening && i === 0) {
          // Second-half tip: the starters return unless the game is already decided.
          if (isBlowout(3, Math.abs(score.home - score.away))) c.blowoutSeen = true
          else applySwaps(s, returnStarterSwaps(c.onCourt, c.starters.filter((id) => !fouledOut(c).includes(id)), players))
        } else subStep(s, i, stints.length)
      }
      for (const s of SIDES) for (const id of sides[s].onCourt) sides[s].played[id] += sl
      for (const s of SIDES) {
        const c = sides[s]
        for (let idx = 0; idx < c.ids.length; idx++) {
          const id = c.ids[idx]
          const on = c.onCourt.includes(id)
          c.stint[id] = on ? c.stint[id] + sl : 0
          energy[id] = on
            ? Math.max(0, energy[id] - drainPerMinute(players[id], heat[id] >= FATIGUE.hotHeat) * (1 - Math.max(0, mods?.energy[id] ?? 0) / 100) * sl)
            : Math.min(100, energy[id] + FATIGUE.bench * sl)
        }
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
