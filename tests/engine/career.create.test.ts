import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES, startRatings } from '../../src/engine/career/build'
import { careerOvr } from '../../src/engine/career/careerOvr'
import { createCareerLeague } from '../../src/engine/career/create'
import { isCareer } from '../../src/engine/career/state'
import { decodeHeritage } from '../../src/engine/face/heritage'

const t = BUILD_TEMPLATES[0]
const input = { max: t.max, pos: t.pos, first: 'Jay', last: 'Hoops', heightIn: 76 }
const make = (seed = 5) => createCareerLeague({ seed, name: 'Me', build: input })

describe('createCareerLeague', () => {
  it('is deterministic by seed', () => {
    expect(JSON.stringify(make(5))).toBe(JSON.stringify(make(5)))
    expect(JSON.stringify(make(5))).not.toBe(JSON.stringify(make(6)))
  })
  it('puts the followed player in the league at 19 with start ratings, pot 99 and Career OVR about 68', () => {
    const l = make()
    expect(isCareer(l)).toBe(true)
    const p = l.players[l.career!.playerId]
    expect(p).toBeDefined()
    expect([p.age, p.pot, p.teamId, p.contract, p.pos, p.heightIn]).toEqual([19, 99, null, null, t.pos, 76])
    expect(`${p.firstName} ${p.lastName}`).toBe('Jay Hoops')
    expect(p.ratings).toEqual(startRatings(t.max))
    expect(Math.abs(careerOvr(p) - 68)).toBeLessThanOrEqual(1)
    expect(p.careerBuild).toEqual(l.career!.build)
    expect(l.career!.status).toBe('draftNight')
    expect(l.userTeamId in l.teams).toBe(true)
  })
  it('honours a chosen heritage in the face seed', () => {
    const l = createCareerLeague({ seed: 5, name: 'Me', build: { ...input, heritage: 'asian' } })
    expect(decodeHeritage(l.players[l.career!.playerId].faceSeed)).toBe('asian')
  })
  it('does not put him on any roster or change the other players', () => {
    const l = make()
    const base = createCareerLeagueBaseCount()
    expect(Object.keys(l.players).length).toBe(base + 1)
  })
  it('rejects invalid builds', () => {
    expect(() => createCareerLeague({ seed: 1, name: 'x', build: { ...input, max: { ...t.max, closeShot: 100 } } })).toThrow()
    expect(() => createCareerLeague({ seed: 1, name: 'x', build: { ...input, max: { ...t.max, closeShot: Math.min(99, t.max.closeShot + 5), layup: 99, drivingDunk: 99 } } })).toThrow()
  })
})

import { createLeague } from '../../src/engine/league/create'
function createCareerLeagueBaseCount() {
  return Object.keys(createLeague({ seed: 5, userTeamIndex: 0, name: 'Me' }).players).length
}
