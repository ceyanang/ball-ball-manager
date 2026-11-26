import type { Player } from '../types'
import {
  PILLAR_KEYS,
  PILLAR_LABELS,
  calculatePlayerOVR,
  computePillars,
  detectSfWingRole,
  type PillarKey,
  type PillarScores,
  type SfWingRole,
} from './ratings'

export { PILLAR_KEYS, PILLAR_LABELS, computePillars, detectSfWingRole }
export type { PillarKey, PillarScores, SfWingRole }

export type BaseRole =
  | '2-Way Superstar'
  | 'All-Around Threat'
  | 'Floor General'
  | 'Shot Creator'
  | 'Sharpshooter'
  | 'Slasher'
  | 'Perimeter Lockdown'
  | '3-Level Scorer'
  | '3-Level Threat'
  | '3&D Wing'
  | 'Slashing Playmaker'
  | 'Point Forward'
  | 'Wing Stopper'
  | 'Paint Beast'
  | 'Interior Force'
  | 'Stretch Four'
  | 'Stretch Five'
  | 'Glass-Cleaning Finisher'
  | 'Rim Protector'
  | 'Playmaking Big'

export type ArchetypeModifier =
  | '2-Way'
  | 'Diming'
  | 'Floor-Spacing'
  | 'Inside-Out'
  | 'Glass-Cleaning'
  | 'High-Flying'

export const BASE_ROLES: readonly BaseRole[] = [
  '2-Way Superstar',
  'All-Around Threat',
  'Floor General',
  'Shot Creator',
  'Sharpshooter',
  'Slasher',
  'Perimeter Lockdown',
  '3-Level Scorer',
  '3-Level Threat',
  '3&D Wing',
  'Slashing Playmaker',
  'Point Forward',
  'Wing Stopper',
  'Paint Beast',
  'Interior Force',
  'Stretch Four',
  'Stretch Five',
  'Glass-Cleaning Finisher',
  'Rim Protector',
  'Playmaking Big',
]

export const ARCHETYPE_MODIFIERS: readonly ArchetypeModifier[] = [
  '2-Way',
  'Diming',
  'Floor-Spacing',
  'Inside-Out',
  'Glass-Cleaning',
  'High-Flying',
]

export interface ArchetypeTendencies {
  /** Multipliers for [layup, driveDunk, standDunk, close, post, mid, three]. */
  zoneMult: [number, number, number, number, number, number, number]
  /** Multiplier on usage weight. */
  usageMult: number
  /** Multipliers on ball-handler & passer weights. */
  handlerMult: number
  passerMult: number
  /** Multiplier on draw-foul probability at the rim/drives. */
  foulDrawMult: number
  /** Additive adjustment to handler turnover probability (negative = safer ball care). */
  tovDelta: number
  /** Additive adjustment to team assist probability on made baskets. */
  assistShareDelta: number
  /** Multipliers on defensive steal & block weights. */
  stealMult: number
  blockMult: number
}

export interface PlayerArchetype {
  title: string
  baseRole: BaseRole
  modifiers: ArchetypeModifier[]
  pillars: PillarScores
  topPillar: PillarKey
  ovr: number
  tendencies: ArchetypeTendencies
}

const DEFENSIVE_ROLES = new Set<BaseRole>([
  '2-Way Superstar',
  'Perimeter Lockdown',
  'Wing Stopper',
  'Rim Protector',
  '3&D Wing',
])

const PLAYMAKER_ROLES = new Set<BaseRole>([
  '2-Way Superstar',
  'Floor General',
  'Point Forward',
  'Slashing Playmaker',
  'Playmaking Big',
])

const SHOOTING_NATIVE_ROLES = new Set<BaseRole>([
  '2-Way Superstar',
  'All-Around Threat',
  'Sharpshooter',
  'Shot Creator',
  '3-Level Scorer',
  '3-Level Threat',
  '3&D Wing',
  'Stretch Four',
  'Stretch Five',
])

const INSIDE_OUT_ROLES = new Set<BaseRole>([
  'Paint Beast',
  'Interior Force',
  'Glass-Cleaning Finisher',
  'Slashing Playmaker',
  'Floor General',
  'Point Forward',
  'Playmaking Big',
])

function pickBaseRole(p: Player, pillars: PillarScores, top: PillarKey, ovr: number): BaseRole {
  const r = p.ratings
  let pillars82 = 0
  if (pillars.shooting >= 82) pillars82++
  if (pillars.finishing >= 82) pillars82++
  if (pillars.playmaking >= 82) pillars82++
  if (pillars.perimeterDefense >= 82) pillars82++
  if (pillars.interiorDefense >= 82) pillars82++
  if (pillars.rebounding >= 82) pillars82++

  if (ovr >= 88 && pillars82 >= 4) {
    return pillars.perimeterDefense >= 82 || pillars.interiorDefense >= 82
      ? '2-Way Superstar'
      : 'All-Around Threat'
  }

  if (p.pos === 'PG' || p.pos === 'SG') {
    if (pillars.shooting >= 82 && pillars.finishing >= 82) {
      return '3-Level Scorer'
    }
    if (
      p.pos === 'SG' &&
      pillars.perimeterDefense >= Math.max(pillars.shooting, pillars.finishing, pillars.playmaking) - 1 &&
      pillars.shooting >= 76 &&
      pillars.playmaking < 78
    ) {
      return '3&D Wing'
    }
    if (
      top === 'playmaking' ||
      (p.pos === 'PG' && pillars.playmaking >= Math.max(pillars.shooting, pillars.finishing) - 2 && r.passVision >= 78)
    ) {
      return 'Floor General'
    }
    if (top === 'perimeterDefense' || top === 'interiorDefense') return 'Perimeter Lockdown'
    if (top === 'finishing' || top === 'rebounding') return 'Slasher'
    return r.midRangeShot >= r.threePointShot - 2 || (r.ballHandle >= 78 && r.midRangeShot >= 75)
      ? 'Shot Creator'
      : 'Sharpshooter'
  }

  if (p.pos === 'SF') {
    const wingRole = detectSfWingRole(r, pillars)
    if (wingRole === 'pointForward') {
      return pillars.finishing > pillars.shooting + 6 && pillars.shooting < 76 ? 'Slashing Playmaker' : 'Point Forward'
    }
    if (wingRole === 'threeAndD') {
      return pillars.shooting >= 75 || r.threePointShot >= 78 ? '3&D Wing' : 'Wing Stopper'
    }
    if (wingRole === 'slashingWing') {
      return pillars.playmaking >= 76 && r.passVision >= 74 ? 'Slashing Playmaker' : 'Slasher'
    }
    if (pillars.shooting >= 79 && pillars.finishing >= 79 && r.midRangeShot >= 74) {
      return r.midRangeShot >= 82 ? '3-Level Scorer' : '3-Level Threat'
    }
    return r.midRangeShot >= r.threePointShot - 2 || (r.ballHandle >= 76 && r.midRangeShot >= 75)
      ? 'Shot Creator'
      : 'Sharpshooter'
  }

  // Bigs (PF / C)
  if (top === 'playmaking' || (pillars.playmaking >= 76 && r.passVision >= 78 && r.passAccuracy >= 78)) {
    return 'Playmaking Big'
  }
  if (
    top === 'shooting' ||
    (r.threePointShot >= 78 &&
      pillars.shooting >= 74 &&
      pillars.shooting >= Math.max(pillars.finishing, pillars.rebounding, pillars.interiorDefense) - 4)
  ) {
    return p.pos === 'PF' ? 'Stretch Four' : 'Stretch Five'
  }
  if (top === 'interiorDefense' && (pillars.interiorDefense >= pillars.rebounding + 2 || r.block >= r.defensiveRebound)) {
    return 'Rim Protector'
  }
  if (top === 'rebounding') {
    return pillars.interiorDefense >= pillars.finishing + 5 && r.block >= 80 ? 'Rim Protector' : 'Glass-Cleaning Finisher'
  }
  const postScore = (r.postControl + r.postHook + r.postFade) / 3
  const dunkScore = (r.standingDunk + r.drivingDunk) / 2
  return postScore >= dunkScore - 4 || r.postControl >= 78 ? 'Interior Force' : 'Paint Beast'
}

function pickModifiers(p: Player, baseRole: BaseRole, pillars: PillarScores): ArchetypeModifier[] {
  if (baseRole === '2-Way Superstar' || baseRole === 'All-Around Threat') return []
  const r = p.ratings
  const out: ArchetypeModifier[] = []

  if (!DEFENSIVE_ROLES.has(baseRole) && Math.max(pillars.perimeterDefense, pillars.interiorDefense) >= 82) {
    out.push('2-Way')
  }
  if (!PLAYMAKER_ROLES.has(baseRole) && (r.passVision + r.passAccuracy) / 2 >= 82) {
    out.push('Diming')
  }
  if (!SHOOTING_NATIVE_ROLES.has(baseRole) && r.threePointShot >= 81) {
    const insideOut =
      INSIDE_OUT_ROLES.has(baseRole) || (baseRole === 'Slasher' && r.midRangeShot >= 78)
    out.push(insideOut ? 'Inside-Out' : 'Floor-Spacing')
  }
  if (r.drivingDunk >= 86 && r.vertical >= 85) {
    out.push('High-Flying')
  }
  if (baseRole !== 'Glass-Cleaning Finisher' && pillars.rebounding >= 83) {
    out.push('Glass-Cleaning')
  }

  return out.slice(0, 2)
}

function formatTitle(baseRole: BaseRole, modifiers: ArchetypeModifier[]): string {
  if (!modifiers.length) return baseRole
  if (modifiers.includes('Glass-Cleaning') && (baseRole === 'Stretch Four' || baseRole === 'Stretch Five')) {
    const other = modifiers.filter((m) => m !== 'Glass-Cleaning')
    return [...other, 'Stretch Glass Cleaner'].join(' ')
  }
  return [...modifiers, baseRole].join(' ')
}

const BASE_TENDENCIES: Record<BaseRole, ArchetypeTendencies> = {
  '2-Way Superstar': {
    zoneMult: [1.1, 1.12, 1.05, 1.05, 1.0, 1.1, 1.12],
    usageMult: 1.08,
    handlerMult: 1.12,
    passerMult: 1.12,
    foulDrawMult: 1.02,
    tovDelta: -0.005,
    assistShareDelta: 0.02,
    stealMult: 1.14,
    blockMult: 1.14,
  },
  'All-Around Threat': {
    zoneMult: [1.1, 1.1, 1.04, 1.05, 1.02, 1.12, 1.12],
    usageMult: 1.08,
    handlerMult: 1.12,
    passerMult: 1.12,
    foulDrawMult: 1.02,
    tovDelta: -0.004,
    assistShareDelta: 0.02,
    stealMult: 1.02,
    blockMult: 1.02,
  },
  'Floor General': {
    zoneMult: [1.06, 0.96, 0.85, 1.02, 0.85, 1.04, 1.06],
    usageMult: 0.98,
    handlerMult: 1.32,
    passerMult: 1.36,
    foulDrawMult: 0.98,
    tovDelta: -0.012,
    assistShareDelta: 0.045,
    stealMult: 1.04,
    blockMult: 0.95,
  },
  'Shot Creator': {
    zoneMult: [1.02, 1.0, 0.86, 1.0, 0.92, 1.34, 1.12],
    usageMult: 1.05,
    handlerMult: 1.14,
    passerMult: 1.04,
    foulDrawMult: 1.0,
    tovDelta: -0.002,
    assistShareDelta: 0.008,
    stealMult: 1.0,
    blockMult: 0.95,
  },
  Sharpshooter: {
    zoneMult: [0.9, 0.86, 0.8, 0.92, 0.78, 0.98, 1.4],
    usageMult: 1.02,
    handlerMult: 0.92,
    passerMult: 0.96,
    foulDrawMult: 0.92,
    tovDelta: 0,
    assistShareDelta: 0,
    stealMult: 0.98,
    blockMult: 0.94,
  },
  Slasher: {
    zoneMult: [1.32, 1.36, 1.1, 1.14, 0.88, 0.88, 0.84],
    usageMult: 1.04,
    handlerMult: 1.08,
    passerMult: 0.98,
    foulDrawMult: 1.12,
    tovDelta: 0.002,
    assistShareDelta: 0,
    stealMult: 1.02,
    blockMult: 1.02,
  },
  'Perimeter Lockdown': {
    zoneMult: [1.02, 1.02, 0.92, 0.98, 0.85, 0.95, 1.06],
    usageMult: 0.9,
    handlerMult: 0.94,
    passerMult: 0.98,
    foulDrawMult: 0.96,
    tovDelta: 0,
    assistShareDelta: 0,
    stealMult: 1.26,
    blockMult: 1.04,
  },
  '3-Level Scorer': {
    zoneMult: [1.14, 1.14, 0.94, 1.08, 0.98, 1.24, 1.18],
    usageMult: 1.07,
    handlerMult: 1.1,
    passerMult: 1.04,
    foulDrawMult: 1.02,
    tovDelta: -0.002,
    assistShareDelta: 0.008,
    stealMult: 1.0,
    blockMult: 0.98,
  },
  '3-Level Threat': {
    zoneMult: [1.12, 1.14, 1.02, 1.08, 1.04, 1.2, 1.16],
    usageMult: 1.06,
    handlerMult: 1.06,
    passerMult: 1.04,
    foulDrawMult: 1.02,
    tovDelta: -0.001,
    assistShareDelta: 0.008,
    stealMult: 1.02,
    blockMult: 1.02,
  },
  '3&D Wing': {
    zoneMult: [0.96, 0.98, 0.92, 0.94, 0.82, 0.94, 1.32],
    usageMult: 0.96,
    handlerMult: 0.88,
    passerMult: 0.96,
    foulDrawMult: 0.94,
    tovDelta: -0.002,
    assistShareDelta: 0,
    stealMult: 1.18,
    blockMult: 1.06,
  },
  'Slashing Playmaker': {
    zoneMult: [1.26, 1.28, 1.06, 1.1, 0.9, 0.94, 0.92],
    usageMult: 1.04,
    handlerMult: 1.2,
    passerMult: 1.2,
    foulDrawMult: 1.08,
    tovDelta: -0.006,
    assistShareDelta: 0.025,
    stealMult: 1.02,
    blockMult: 1.0,
  },
  'Point Forward': {
    zoneMult: [1.1, 1.08, 0.98, 1.04, 0.96, 1.04, 1.06],
    usageMult: 1.02,
    handlerMult: 1.24,
    passerMult: 1.28,
    foulDrawMult: 1.0,
    tovDelta: -0.009,
    assistShareDelta: 0.036,
    stealMult: 1.02,
    blockMult: 1.02,
  },
  'Wing Stopper': {
    zoneMult: [1.04, 1.06, 1.02, 1.0, 0.88, 0.94, 1.02],
    usageMult: 0.9,
    handlerMult: 0.9,
    passerMult: 0.96,
    foulDrawMult: 0.96,
    tovDelta: 0,
    assistShareDelta: 0,
    stealMult: 1.24,
    blockMult: 1.12,
  },
  'Paint Beast': {
    zoneMult: [1.14, 1.16, 1.36, 1.24, 1.12, 0.78, 0.68],
    usageMult: 1.0,
    handlerMult: 0.86,
    passerMult: 0.92,
    foulDrawMult: 1.03,
    tovDelta: 0.002,
    assistShareDelta: 0,
    stealMult: 0.96,
    blockMult: 1.14,
  },
  'Interior Force': {
    zoneMult: [1.06, 1.02, 1.16, 1.24, 1.62, 0.94, 0.64],
    usageMult: 1.04,
    handlerMult: 0.92,
    passerMult: 0.98,
    foulDrawMult: 1.03,
    tovDelta: 0.002,
    assistShareDelta: 0.005,
    stealMult: 0.94,
    blockMult: 1.06,
  },
  'Stretch Four': {
    zoneMult: [0.94, 0.94, 0.92, 0.96, 0.9, 1.06, 1.38],
    usageMult: 1.0,
    handlerMult: 0.92,
    passerMult: 1.0,
    foulDrawMult: 0.95,
    tovDelta: -0.001,
    assistShareDelta: 0.004,
    stealMult: 0.98,
    blockMult: 1.02,
  },
  'Stretch Five': {
    zoneMult: [0.9, 0.88, 0.94, 0.98, 0.92, 1.04, 1.42],
    usageMult: 1.0,
    handlerMult: 0.9,
    passerMult: 1.02,
    foulDrawMult: 0.95,
    tovDelta: -0.001,
    assistShareDelta: 0.006,
    stealMult: 0.96,
    blockMult: 1.08,
  },
  'Glass-Cleaning Finisher': {
    zoneMult: [1.1, 1.14, 1.28, 1.18, 1.06, 0.82, 0.76],
    usageMult: 0.96,
    handlerMult: 0.86,
    passerMult: 0.94,
    foulDrawMult: 1.0,
    tovDelta: 0,
    assistShareDelta: 0,
    stealMult: 0.98,
    blockMult: 1.14,
  },
  'Rim Protector': {
    zoneMult: [0.98, 1.02, 1.2, 1.1, 0.94, 0.8, 0.76],
    usageMult: 0.88,
    handlerMult: 0.84,
    passerMult: 0.94,
    foulDrawMult: 0.96,
    tovDelta: 0,
    assistShareDelta: 0,
    stealMult: 0.98,
    blockMult: 1.28,
  },
  'Playmaking Big': {
    zoneMult: [1.02, 0.96, 1.04, 1.12, 1.18, 1.04, 1.02],
    usageMult: 1.02,
    handlerMult: 1.18,
    passerMult: 1.34,
    foulDrawMult: 0.98,
    tovDelta: -0.009,
    assistShareDelta: 0.036,
    stealMult: 0.98,
    blockMult: 1.02,
  },
}

function buildTendencies(baseRole: BaseRole, modifiers: ArchetypeModifier[]): ArchetypeTendencies {
  const b = BASE_TENDENCIES[baseRole]
  const zoneMult: [number, number, number, number, number, number, number] = [...b.zoneMult]
  let { usageMult, handlerMult, passerMult, foulDrawMult, tovDelta, assistShareDelta, stealMult, blockMult } = b

  for (const mod of modifiers) {
    if (mod === '2-Way') {
      stealMult *= 1.1
      blockMult *= 1.1
    } else if (mod === 'Diming') {
      handlerMult *= 1.1
      passerMult *= 1.2
      tovDelta -= 0.005
      assistShareDelta += 0.02
    } else if (mod === 'Floor-Spacing' || mod === 'Inside-Out') {
      zoneMult[6] *= 1.26
      if (mod === 'Inside-Out') zoneMult[5] *= 1.08
    } else if (mod === 'High-Flying') {
      zoneMult[1] *= 1.24
      foulDrawMult *= 1.05
    }
  }

  return { zoneMult, usageMult, handlerMult, passerMult, foulDrawMult, tovDelta, assistShareDelta, stealMult, blockMult }
}

/**
 * Dynamic NBA 2K-style archetype generator powered directly by the player's position and 36 attributes.
 */
export function generatePlayerArchetype(p: Player): PlayerArchetype {
  const pillars = computePillars(p.ratings, p.pos)
  const ovr = calculatePlayerOVR(p.ratings, p.pos)
  let topPillar: PillarKey = 'shooting'
  let topVal = pillars.shooting
  if (pillars.finishing > topVal) { topVal = pillars.finishing; topPillar = 'finishing' }
  if (pillars.playmaking > topVal) { topVal = pillars.playmaking; topPillar = 'playmaking' }
  if (pillars.perimeterDefense > topVal) { topVal = pillars.perimeterDefense; topPillar = 'perimeterDefense' }
  if (pillars.interiorDefense > topVal) { topVal = pillars.interiorDefense; topPillar = 'interiorDefense' }
  if (pillars.rebounding > topVal) { topPillar = 'rebounding' }
  const baseRole = pickBaseRole(p, pillars, topPillar, ovr)
  const modifiers = pickModifiers(p, baseRole, pillars)
  const title = formatTitle(baseRole, modifiers)
  const tendencies = modifiers.length ? buildTendencies(baseRole, modifiers) : BASE_TENDENCIES[baseRole]
  return { title, baseRole, modifiers, pillars, topPillar, ovr, tendencies }
}

/** 2K-style archetype title from ratings. */
export function archetypeFor(p: Player): string {
  return generatePlayerArchetype(p).title
}
