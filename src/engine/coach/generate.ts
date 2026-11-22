import { FIRST_NAMES, LAST_NAMES } from '../data/names'
import type { Rng } from '../rng'
import type { Coach, CoachStyle } from '../types'

const STYLES: CoachStyle[] = ['pace', 'three', 'defense', 'balanced']

export function generateCoach(rng: Rng): Coach {
  return {
    id: rng.id('c_'),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    faceSeed: rng.int(1, 2 ** 31 - 1),
    age: rng.int(38, 68),
    style: rng.pick(STYLES),
    dev: Math.max(30, Math.min(95, Math.round(rng.normal(60, 12)))),
    teamId: null,
    wins: 0,
    losses: 0,
  }
}
