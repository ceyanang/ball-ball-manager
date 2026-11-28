import { storyRng } from '../stories/state'
import { RATING_KEYS } from '../player/ratings'
import type { Rng } from '../rng'
import type { Injury, League, Player, Ratings } from '../types'
import { CAREER_FLOOR, ovrOf } from './careerOvr'
import type { CareerState, GrowthEntry } from './types'

export interface Grant { key: keyof Ratings; amount: number }

/** Share of a grant he keeps: a played game counts full, a simmed one half (1 before any game). */
export function rewardShare(c: CareerState): number {
  const n = c.played + c.simmed
  return n === 0 ? 1 : (c.played + 0.5 * c.simmed) / n
}

/** Growth by age: fastest 19–24, slower after 27, nothing left to learn from 32 (decline takes over). */
export function ageMult(age: number): number {
  if (age <= 24) return 1
  if (age <= 27) return 0.7
  if (age <= 30) return 0.4
  if (age === 31) return 0.2
  return 0
}

const HEALTH: Record<Injury['severity'], number> = { dtd: 0.9, short: 0.75, long: 0.5, season: 0.35 }
const healthMult = (p: Player) => (p.injury ? HEALTH[p.injury.severity] : 1)

/**
 * Permanently raises the followed player's ratings (the only way he grows). Each grant is scaled by age, reward share
 * and health, rounded with seeded luck, capped at his max build, and logged. Returns the changes made.
 */
export function growPlayer(l: League, playerId: string, grants: Grant[], source: string): GrowthEntry[] {
  const c = l.career
  const p = l.players[playerId]
  if (!c || !p || !p.careerBuild || p.id !== c.playerId) return []
  const rng = storyRng(l, 700 + c.growth.length)
  const scale = ageMult(p.age) * rewardShare(c) * healthMult(p)
  const out: GrowthEntry[] = []
  for (const g of grants) {
    const raw = g.amount * scale
    const whole = Math.floor(raw)
    const want = whole + (rng.chance(raw - whole) ? 1 : 0)
    const room = p.careerBuild.max[g.key] - p.ratings[g.key]
    const delta = Math.max(0, Math.min(want, room))
    if (delta === 0) continue
    p.ratings[g.key] += delta
    out.push({ season: l.season, day: l.day, key: g.key, delta, source })
  }
  c.growth.push(...out)
  return out
}

const ATHLETIC = new Set<keyof Ratings>(['speed', 'agility', 'vertical', 'stamina', 'speedWithBall'])

/**
 * Offseason aging for the followed player (replaces the normal development roll): nothing happens while he is young,
 * he starts to lose a step after 31 (athleticism first), and his POT is 99 until 30, then his ceiling is today.
 */
export function ageCareerPlayer(l: League, p: Player, rng: Rng): void {
  const c = l.career
  if (p.age >= 32) {
    const points = Math.max(1, Math.round(0.8 + (p.age - 31) * 0.7))
    for (let i = 0; i < points; i++) {
      const options = RATING_KEYS.filter((k) => p.ratings[k] > CAREER_FLOOR)
      if (!options.length) break
      const k = rng.weighted(options, (key) => (ATHLETIC.has(key) ? 3 : 1))
      p.ratings[k] -= 1
      c?.growth.push({ season: l.season, day: l.day, key: k, delta: -1, source: 'aging' })
    }
  }
  p.pot = p.age >= 30 ? ovrOf(p) : 99
}
