import { MAX_SALARY, MIN_SALARY } from './constants'
import { computeOvr } from './player/ratings'
import type { Player } from './types'

/** Market salary (thousands) from OVR, discounted for age > 32. Rounded to 100. */
export function salaryForPlayer(p: Player): number {
  const ovr = computeOvr(p.ratings, p.pos)
  let s: number
  if (ovr <= 50) s = MIN_SALARY
  else if (ovr >= 88) s = MAX_SALARY
  else s = MIN_SALARY + (MAX_SALARY - MIN_SALARY) * ((ovr - 50) / 38) ** 2.2
  if (p.age > 32) s *= Math.max(0, 1 - 0.1 * (p.age - 32))
  return Math.max(MIN_SALARY, Math.round(s / 100) * 100)
}
