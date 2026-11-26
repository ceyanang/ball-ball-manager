import { pickName } from '../data/names'
import { encodeHeritage, rollHeritage } from '../face/heritage'
import { Rng } from '../rng'
import type { Coach, CoachStyle } from '../types'

const STYLES: CoachStyle[] = ['pace', 'three', 'defense', 'balanced']

export function generateCoach(rng: Rng): Coach {
  const id = rng.id('c_')
  rng.next(); rng.next() // legacy name draws, kept so the league RNG stream is unchanged
  const rawSeed = rng.int(1, 2 ** 31 - 1)
  const idRng = Rng.fromSeed((rawSeed ^ 0x2545f491) >>> 0)
  const heritage = rollHeritage(idRng)
  const { firstName, lastName } = pickName(idRng, heritage)
  return {
    id,
    firstName,
    lastName,
    faceSeed: encodeHeritage(rawSeed, heritage),
    age: rng.int(38, 68),
    style: rng.pick(STYLES),
    dev: Math.max(30, Math.min(95, Math.round(rng.normal(60, 12)))),
    teamId: null,
    wins: 0,
    losses: 0,
  }
}
