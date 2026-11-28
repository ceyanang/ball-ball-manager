import { RATING_KEYS } from '../player/ratings'
import type { Rng } from '../rng'
import type { League, Player, Ratings } from '../types'
import { CAREER_FLOOR, ovrOf } from './careerOvr'

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
      const options = RATING_KEYS.filter((k) => k !== 'intangibles' && p.ratings[k] > CAREER_FLOOR)
      if (!options.length) break
      const k = rng.weighted(options, (key) => (ATHLETIC.has(key) ? 3 : 1))
      p.ratings[k] -= 1
      c?.growth.push({ season: l.season, day: l.day, key: k, delta: -1, source: 'aging' })
    }
  }
  p.pot = p.age >= 30 ? ovrOf(p) : 99
}
