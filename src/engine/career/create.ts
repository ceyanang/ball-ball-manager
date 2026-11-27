import { createLeague } from '../league/create'
import { Rng } from '../rng'
import { encodeHeritage, type Heritage } from '../face/heritage'
import { generatePlayer } from '../player/generate'
import type { League, Player, Position, Ratings } from '../types'
import { isValidBuild, makeBuild, startRatings } from './build'
import { careerOvr } from './careerOvr'
import { emptyCareer } from './state'

export interface CareerBuildInput { max: Ratings; pos: Position; first: string; last: string; heritage?: Heritage; heightIn: number }

/** A normal league plus the followed player (undrafted, age 19) and `career` in draft-night status. */
export function createCareerLeague(opts: { seed: number; name: string; build: CareerBuildInput; season?: number }): League {
  const b = opts.build
  if (!isValidBuild(b.max)) throw new Error('That build is not valid: every maximum must be 25–99 and the points must fit the budget.')
  const season = opts.season ?? 1
  const league = createLeague({ seed: opts.seed, userTeamIndex: 0, name: opts.name, season })
  // The player rolls from his own seeded stream so the league itself is exactly the normal one for this seed.
  const base = generatePlayer(Rng.fromSeed((opts.seed ^ 0x6d79c0de) >>> 0), { season, age: 19, pos: b.pos, targetOvr: 60 })
  const careerBuild = makeBuild(b.max, b.pos)
  const p: Player = {
    ...base,
    firstName: b.first.trim() || 'Rookie', lastName: b.last.trim() || 'Hooper',
    heightIn: b.heightIn, pos: b.pos, age: 19, pot: 99,
    faceSeed: b.heritage ? encodeHeritage(base.faceSeed, b.heritage) : base.faceSeed,
    ratings: startRatings(b.max), careerBuild, teamId: null, contract: null, injury: null, morale: 70, draft: null,
  }
  p.ratingHistory = [{ season, ovr: careerOvr(p) }]
  league.players[p.id] = p
  league.career = { ...emptyCareer(p.id, careerBuild), status: 'draftNight' }
  return league
}
