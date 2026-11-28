import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { BUILD_TEMPLATES, makeBuild } from '../../src/engine/career/build'
import { CAREER_FLOOR, careerOvr, ovrOf } from '../../src/engine/career/careerOvr'
import { computeOvr } from '../../src/engine/player/ratings'
import { autoRotation, coachRotation } from '../../src/engine/sim/rotation'
import type { Player } from '../../src/engine/types'

/** A weak player whose Career OVR reads ~90+ while his true league OVR stays low. */
function followed(l: ReturnType<typeof createLeague>) {
  const team = Object.values(l.teams)[0]
  const roster = Object.values(l.players).filter((p) => p.teamId === team.id)
  const weak = [...roster].sort((a, b) => computeOvr(a.ratings, a.pos) - computeOvr(b.ratings, b.pos))[0]
  for (const k of Object.keys(weak.ratings) as (keyof typeof weak.ratings)[]) weak.ratings[k] = Math.max(CAREER_FLOOR, weak.ratings[k])
  const max = { ...weak.ratings }
  for (const k of Object.keys(max) as (keyof typeof max)[]) max[k] = max[k]
  weak.careerBuild = makeBuild(max, weak.pos)
  return { roster, weak }
}

describe('Career OVR seam', () => {
  it('a followed player reads his Career OVR, which differs from the league formula', () => {
    const l = createLeague({ seed: 3, userTeamIndex: 0, name: 'S' })
    const { weak } = followed(l)
    const t = BUILD_TEMPLATES[0]
    const rookie: Player = { ...weak, ratings: { ...t.max }, careerBuild: makeBuild(t.max, weak.pos) }
    expect(ovrOf(rookie)).toBe(careerOvr(rookie))
    expect(ovrOf(weak)).toBe(careerOvr(weak))
    expect(ovrOf(weak)).not.toBe(computeOvr(weak.ratings, weak.pos))
    expect(ovrOf(weak)).toBeGreaterThanOrEqual(88)
    const other = Object.values(l.players).find((p) => !p.careerBuild)!
    expect(ovrOf(other)).toBe(computeOvr(other.ratings, other.pos))
  })

  it('computeOvr/calculatePlayerOVR is only called from the allowed files', () => {
    const allowed = new Set(['engine/player/ratings.ts', 'engine/career/careerOvr.ts', 'engine/player/generate.ts', 'engine/player/archetype.ts'])
    const files = import.meta.glob('../../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    const bad = Object.entries(files)
      .filter(([path, text]) => !allowed.has(path.replace('../../src/', '')) && /\b(computeOvr|calculatePlayerOVR)\(/.test(text))
      .map(([path]) => path)
    expect(Object.keys(files).length).toBeGreaterThan(100)
    expect(bad).toEqual([])
  })

  it('auto and coach rotations start a Career-OVR-90 player on a normal roster', () => {
    const l = createLeague({ seed: 3, userTeamIndex: 0, name: 'S' })
    const { roster, weak } = followed(l)
    expect(ovrOf(weak)).toBeGreaterThanOrEqual(88)
    expect(autoRotation(roster).starters).toContain(weak.id)
    expect(coachRotation(roster).starters).toContain(weak.id)
  })

  it('the coach always dresses the followed player, even when his Career OVR is the lowest on the team', () => {
    const l = createLeague({ seed: 3, userTeamIndex: 0, name: 'S' })
    const { roster, weak } = followed(l)
    // Make him the worst player by Career OVR: ratings at the floor read 58.
    weak.careerBuild = { ...weak.careerBuild!, startProgress: 0.5 }
    weak.careerBuild.max = { ...weak.careerBuild.max }
    for (const k of Object.keys(weak.ratings) as (keyof typeof weak.ratings)[]) weak.ratings[k] = 25
    expect(ovrOf(weak)).toBeLessThan(Math.min(...roster.filter((p) => p !== weak).map(ovrOf)))
    for (const rot of [autoRotation(roster), coachRotation(roster)]) {
      expect(rot.inactive).not.toContain(weak.id)
      expect([...rot.starters, ...rot.bench]).toContain(weak.id)
    }
  })
})
