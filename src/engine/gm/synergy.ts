import { gradeFor } from '../player/grades'
import { computeOvr } from '../player/ratings'
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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Evaluates how well a roster fits together across the four NBA 2K construction pillars:
 * spacing, playmaking + finishing synergy, rim/help anchor coverage, and rebounding + hustle.
 */
export function rosterSynergy(roster: Player[]): RosterSynergy {
  const core = [...roster]
    .filter((p) => !p.retired)
    .sort((a, b) => computeOvr(b.ratings, b.pos) - computeOvr(a.ratings, a.pos))
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
