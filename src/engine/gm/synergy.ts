import { generatePlayerArchetype, type PlayerArchetype } from '../player/archetype'
import { gradeFor } from '../player/grades'
import { ovrOf } from '../career/careerOvr'
import type { Player } from '../types'

export interface SynergyPillar {
  key: 'spacing' | 'playmaking' | 'defense' | 'hustle'
  label: string
  score: number
  grade: string
  detail: string
}

export interface RosterSynergy {
  overall: number
  pillars: SynergyPillar[]
}

export interface UnitSynergyItem {
  id: 'spacing' | 'playmakerLink' | 'rimAnchor' | 'lockdownClamp' | 'paintClutter'
  kind: 'bonus' | 'warning'
  label: string
  detail: string
  active: boolean
}

export interface UnitSynergyEffects {
  spacingRimBonus: number
  linkThreeBonus: number
  linkDunkBonus: number
  linkAssistBonus: number
  rimAnchorPaintPenalty: number
  lockdownTovBoost: number
  lockdownStealBoost: number
  clutterPaintPenalty: number
}

export interface UnitSynergyAnalysis {
  score: number
  grade: string
  items: UnitSynergyItem[]
  effects: UnitSynergyEffects
  summary: {
    shooters80: number
    nonShooters: number
    stretchBigs: number
    playmakers: number
    lockdowns: number
    rimProtectors: number
    weakPerimeter: number
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Evaluates how well a roster fits together across the four NBA 2K construction pillars:
 * spacing, playmaking + finishing synergy, rim/help anchor coverage, and rebounding + hustle.
 */
export function rosterSynergy(roster: Player[]): RosterSynergy {
  const core = [...roster]
    .filter((p) => !p.retired)
    .sort((a, b) => ovrOf(b) - ovrOf(a))
    .slice(0, 9)
  if (!core.length) {
    return {
      overall: 50,
      pillars: [
        { key: 'spacing', label: 'Spacing', score: 50, grade: 'F', detail: 'No rotation players' },
        { key: 'playmaking', label: 'Creation & Finish', score: 50, grade: 'F', detail: 'No rotation players' },
        { key: 'defense', label: 'Rim & Help D', score: 50, grade: 'F', detail: 'No rotation players' },
        { key: 'hustle', label: 'Glass & Hustle', score: 50, grade: 'F', detail: 'No rotation players' },
      ],
    }
  }

  const n = core.length
  const mean = (fn: (p: Player) => number) => core.reduce((s, p) => s + fn(p), 0) / n

  // 1. Spacing: 3PT volume/accuracy + Shot IQ
  const shooters = core.filter((p) => p.ratings.threePointShot >= 78).length
  const avgThree = mean((p) => p.ratings.threePointShot * 0.78 + p.ratings.shotIQ * 0.22)
  const spacing = clamp(Math.round(avgThree + Math.min(8, (shooters - 2) * 2.5)), 25, 99)

  // 2. Playmaking & Finisher pairing: creators (passVision/passIQ) paired with rollers/cutters (hands/dunks)
  const creators = core.map((p) => p.ratings.passVision * 0.5 + p.ratings.passIQ * 0.3 + p.ratings.passAccuracy * 0.2).sort((a, b) => b - a)
  const finishers = core.map((p) => p.ratings.hands * 0.4 + p.ratings.standingDunk * 0.3 + p.ratings.drivingDunk * 0.3).sort((a, b) => b - a)
  const topCreator = creators.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, n)
  const topFinisher = finishers.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, n)
  const avgPlay = mean((p) => (p.ratings.passVision + p.ratings.passIQ) * 0.5)
  const pairBonus = topCreator >= 78 && topFinisher >= 78 ? 5 : 0
  const playmaking = clamp(Math.round(topCreator * 0.45 + topFinisher * 0.3 + avgPlay * 0.25 + pairBonus), 25, 99)

  // 3. Rim & Help anchor covering perimeter defense
  const anchors = core.map((p) => p.ratings.interiorDefense * 0.4 + p.ratings.block * 0.35 + p.ratings.helpDefenseIQ * 0.25).sort((a, b) => b - a)
  const topAnchor = anchors.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, n)
  const avgPerim = mean((p) => p.ratings.perimeterDefense * 0.65 + p.ratings.agility * 0.35)
  const helpMean = mean((p) => p.ratings.helpDefenseIQ)
  const defense = clamp(Math.round(topAnchor * 0.42 + avgPerim * 0.38 + helpMean * 0.2), 25, 99)

  // 4. Rebounding & Hustle motor
  const glass = core.map((p) => p.ratings.defensiveRebound * 0.55 + p.ratings.offensiveRebound * 0.45).sort((a, b) => b - a)
  const topGlass = glass.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, n)
  const hustleMean = mean((p) => p.ratings.hustle * 0.6 + p.ratings.stamina * 0.4)
  const hustle = clamp(Math.round(topGlass * 0.55 + hustleMean * 0.45), 25, 99)

  const overall = Math.round((spacing + playmaking + defense + hustle) / 4)
  return {
    overall,
    pillars: [
      { key: 'spacing', label: 'Spacing', score: spacing, grade: gradeFor(spacing), detail: `${shooters} reliable 3PT threat${shooters === 1 ? '' : 's'}` },
      { key: 'playmaking', label: 'Creation & Finish', score: playmaking, grade: gradeFor(playmaking), detail: topCreator >= 82 && topFinisher >= 80 ? 'Strong creator-roller fit' : `Top creator ${Math.round(topCreator)}` },
      { key: 'defense', label: 'Rim & Help D', score: defense, grade: gradeFor(defense), detail: topAnchor >= 82 ? 'Anchored paint coverage' : `Top anchor ${Math.round(topAnchor)}` },
      { key: 'hustle', label: 'Glass & Hustle', score: hustle, grade: gradeFor(hustle), detail: `Motor avg ${Math.round(hustleMean)}` },
    ],
  }
}

/**
 * Small GM fit multiplier (0.95..1.08) for how well `candidate` fills synergy gaps from a precomputed `RosterSynergy`.
 */
export function synergyFitFrom(syn: RosterSynergy, candidate: Player): number {
  const map = Object.fromEntries(syn.pillars.map((x) => [x.key, x.score])) as Record<SynergyPillar['key'], number>
  const r = candidate.ratings
  let bonus = 0
  if (map.spacing < 74 && r.threePointShot >= 80) bonus += 0.03
  if (map.playmaking < 75 && (r.passVision >= 80 || (r.hands >= 80 && Math.max(r.standingDunk, r.drivingDunk) >= 82))) bonus += 0.03
  if (map.defense < 75 && r.interiorDefense >= 80 && r.helpDefenseIQ >= 76) bonus += 0.03
  if (map.hustle < 74 && (r.defensiveRebound >= 82 || r.hustle >= 82)) bonus += 0.02
  return clamp(1 + bonus, 0.95, 1.08)
}

/**
 * Small GM fit multiplier (0.95..1.08) for how well `candidate` fills synergy gaps on `roster`.
 */
export function synergyFitMultiplier(roster: Player[], candidate: Player): number {
  if (!roster.length) return 1
  return synergyFitFrom(rosterSynergy(roster), candidate)
}

export interface UnitSynergyCore {
  effects: UnitSynergyEffects
  summary: UnitSynergyAnalysis['summary']
  archs: PlayerArchetype[]
  flags: {
    spacingActive: boolean
    playmakerLinkActive: boolean
    hasShooterPair: boolean
    hasFinisherPair: boolean
    rimAnchorActive: boolean
    lockdownClampActive: boolean
    paintClutterActive: boolean
  }
}

const EMPTY_EFFECTS: UnitSynergyEffects = {
  spacingRimBonus: 0,
  linkThreeBonus: 0,
  linkDunkBonus: 0,
  linkAssistBonus: 0,
  rimAnchorPaintPenalty: 0,
  lockdownTovBoost: 0,
  lockdownStealBoost: 0,
  clutterPaintPenalty: 0,
}

/** Fast, allocation-light unit synergy computation for `simGame` (no UI strings or grades). */
export function computeUnitSynergyEffects(players: Player[], archMap?: Record<string, PlayerArchetype>): UnitSynergyCore {
  const n = players.length
  if (!n) {
    return {
      effects: EMPTY_EFFECTS,
      summary: { shooters80: 0, nonShooters: 0, stretchBigs: 0, playmakers: 0, lockdowns: 0, rimProtectors: 0, weakPerimeter: 0 },
      archs: [],
      flags: { spacingActive: false, playmakerLinkActive: false, hasShooterPair: false, hasFinisherPair: false, rimAnchorActive: false, lockdownClampActive: false, paintClutterActive: false },
    }
  }

  const archs: PlayerArchetype[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const p = players[i]
    archs[i] = archMap?.[p.id] ?? generatePlayerArchetype(p)
  }

  let shooters80 = 0
  let nonShooters = 0
  let stretchBigs = 0
  let playmakers = 0
  let lockdowns = 0
  let rimProtectors = 0
  let weakPerimeter = 0
  let hasShooterPair = false
  let hasFinisherPair = false

  for (let i = 0; i < n; i++) {
    const p = players[i]
    const a = archs[i]
    const r = p.ratings

    if (a.pillars.shooting >= 80) shooters80++
    if (r.threePointShot < 70) nonShooters++
    if (
      (p.pos === 'PF' || p.pos === 'C') &&
      (a.baseRole === 'Stretch Four' ||
        a.baseRole === 'Stretch Five' ||
        a.modifiers.includes('Floor-Spacing') ||
        a.modifiers.includes('Inside-Out'))
    ) {
      stretchBigs++
    }

    const isPlaymaker =
      (a.baseRole === 'Floor General' ||
        a.baseRole === 'Point Forward' ||
        a.baseRole === 'Playmaking Big' ||
        a.modifiers.includes('Diming')) &&
      r.passVision >= 78

    if (isPlaymaker) {
      playmakers++
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const aj = archs[j]
        const rj = players[j].ratings
        if (
          aj.baseRole === 'Sharpshooter' ||
          aj.baseRole === '3&D Wing' ||
          aj.baseRole === 'Stretch Four' ||
          aj.baseRole === 'Stretch Five' ||
          aj.pillars.shooting >= 82
        ) {
          hasShooterPair = true
        }
        if (
          rj.hands >= 78 &&
          (aj.baseRole === 'Paint Beast' ||
            aj.baseRole === 'Glass-Cleaning Finisher' ||
            aj.baseRole === 'Interior Force' ||
            aj.baseRole === 'Slasher' ||
            Math.max(rj.standingDunk, rj.drivingDunk) >= 82)
        ) {
          hasFinisherPair = true
        }
      }
    }

    const rimAnchorAvg = (r.block + r.helpDefenseIQ) / 2
    if ((a.baseRole === 'Rim Protector' && rimAnchorAvg >= 80) || rimAnchorAvg >= 84) rimProtectors++
    if (r.perimeterDefense < 72 || a.pillars.perimeterDefense < 72) weakPerimeter++
    if (
      a.baseRole === 'Perimeter Lockdown' ||
      a.baseRole === '3&D Wing' ||
      a.baseRole === 'Wing Stopper' ||
      (a.modifiers.includes('2-Way') && a.pillars.perimeterDefense >= 82)
    ) {
      lockdowns++
    }
  }

  const spacingActive = shooters80 >= 3 || stretchBigs >= 1
  const playmakerLinkActive = playmakers >= 1 && (hasShooterPair || hasFinisherPair)
  const rimAnchorActive = rimProtectors >= 1 && weakPerimeter >= 1
  const lockdownClampActive = lockdowns >= 2
  const paintClutterActive = nonShooters >= 3

  const effects: UnitSynergyEffects = {
    spacingRimBonus: spacingActive ? 0.026 : 0,
    linkThreeBonus: hasShooterPair ? 0.014 : 0,
    linkDunkBonus: hasFinisherPair ? 0.025 : 0,
    linkAssistBonus: playmakerLinkActive ? 0.022 : 0,
    rimAnchorPaintPenalty: rimAnchorActive ? 0.020 : 0,
    lockdownTovBoost: lockdownClampActive ? 0.015 : 0,
    lockdownStealBoost: lockdownClampActive ? 0.030 : 0,
    clutterPaintPenalty: paintClutterActive ? 0.026 : 0,
  }

  return {
    effects,
    summary: { shooters80, nonShooters, stretchBigs, playmakers, lockdowns, rimProtectors, weakPerimeter },
    archs,
    flags: { spacingActive, playmakerLinkActive, hasShooterPair, hasFinisherPair, rimAnchorActive, lockdownClampActive, paintClutterActive },
  }
}

/**
 * Evaluates a 5-man on-court unit's archetype & rating synergy (used by `simGame` and the rotation UI).
 */
export function analyzeUnitSynergy(unit: Player[], archMap?: Record<string, PlayerArchetype>): UnitSynergyAnalysis {
  const players = unit.filter(Boolean)
  if (!players.length) {
    return {
      score: 50,
      grade: 'F',
      items: [],
      effects: EMPTY_EFFECTS,
      summary: {
        shooters80: 0,
        nonShooters: 0,
        stretchBigs: 0,
        playmakers: 0,
        lockdowns: 0,
        rimProtectors: 0,
        weakPerimeter: 0,
      },
    }
  }

  const { effects, summary, archs, flags } = computeUnitSynergyEffects(players, archMap)
  const { shooters80, nonShooters, stretchBigs, lockdowns, rimProtectors } = summary
  const { spacingActive, playmakerLinkActive, hasShooterPair, hasFinisherPair, rimAnchorActive, lockdownClampActive, paintClutterActive } = flags

  const items: UnitSynergyItem[] = [
    {
      id: 'spacing',
      kind: 'bonus',
      label: 'Spacing Bonus',
      detail: spacingActive
        ? `${shooters80} shooter${shooters80 === 1 ? '' : 's'} (80+)${stretchBigs ? ` · ${stretchBigs} stretch big` : ''} — opens rim lanes for Slashers & Interior Forces`
        : 'Need 3+ shooters (Shooting 80+) or a Stretch Big to open driving & post lanes',
      active: spacingActive,
    },
    {
      id: 'playmakerLink',
      kind: 'bonus',
      label: 'Playmaker Link',
      detail: playmakerLinkActive
        ? `High-vision creator paired with ${hasShooterPair && hasFinisherPair ? 'shooters & lob finishers' : hasShooterPair ? 'catch-and-shoot threats' : 'high-hands finishers'} (+open 3PT% / lob efficiency)`
        : 'Pair a high-vision Floor General / Point Forward with Sharpshooters or high-hands Paint Beasts',
      active: playmakerLinkActive,
    },
    {
      id: 'rimAnchor',
      kind: 'bonus',
      label: 'Rim Anchor Coverage',
      detail: rimAnchorActive
        ? 'Elite Rim Protector backstopping weak perimeter defenders (lowers opponent paint FG%)'
        : rimProtectors >= 1
          ? 'Elite Rim Protector on floor with solid perimeter coverage'
          : 'No elite Rim Protector (84+ block/help IQ) covering perimeter gaps',
      active: rimAnchorActive,
    },
    {
      id: 'lockdownClamp',
      kind: 'bonus',
      label: 'Perimeter Clamp',
      detail: lockdownClampActive
        ? `${lockdowns} lockdown / 3&D wing defenders spiking opponent turnovers & steals`
        : 'Pair 2+ Perimeter Lockdowns / 3&D Wings to spike opponent turnover rate',
      active: lockdownClampActive,
    },
    {
      id: 'paintClutter',
      kind: 'warning',
      label: 'Paint Clutter Warning',
      detail: paintClutterActive
        ? `${nonShooters} non-shooters (<70 3PT) crowding the lane (-paint FG% penalty)`
        : 'Clean floor spacing — fewer than 3 non-shooters on the court',
      active: paintClutterActive,
    },
  ]

  const n = players.length
  const meanPillar = (fn: (a: PlayerArchetype) => number) => archs.reduce((s, a) => s + fn(a), 0) / n
  const base =
    meanPillar((a) => a.pillars.shooting) * 0.3 +
    meanPillar((a) => a.pillars.finishing) * 0.22 +
    meanPillar((a) => a.pillars.playmaking) * 0.22 +
    meanPillar((a) => (a.pillars.perimeterDefense + a.pillars.interiorDefense) * 0.5) * 0.26

  const rawScore =
    base +
    (spacingActive ? 7 : 0) +
    (playmakerLinkActive ? 6 : 0) +
    (rimAnchorActive ? 4 : 0) +
    (lockdownClampActive ? 5 : 0) -
    (paintClutterActive ? 9 : 0)

  const score = clamp(Math.round(rawScore), 25, 99)
  return {
    score,
    grade: gradeFor(score),
    items,
    effects,
    summary,
  }
}
