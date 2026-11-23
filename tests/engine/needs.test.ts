import { describe, expect, it } from 'vitest'
import { needLevels, needThresholds, teamNeeds, type Slot } from '../../src/engine/gm/needs'
import { createLeague } from '../../src/engine/league/create'

const th = { excellent: 75, good: 65, solid: 58 }
const S = (pos: Slot['pos'], o: number): Slot => ({ pos, ovr: o })
const filler: Slot[] = [S('PG', 80), S('PG', 70), S('SG', 80), S('SG', 70), S('SF', 80), S('SF', 70), S('PF', 80), S('PF', 70)]

describe('needLevels', () => {
  it('excellent starter + solid backup is green', () => expect(needLevels([...filler, S('C', 80), S('C', 62)], th).C).toBe('green'))
  it('excellent starter with no backup is yellow', () => expect(needLevels([...filler, S('C', 80)], th).C).toBe('yellow'))
  it('adjacent cover alone never makes green', () => expect(needLevels([S('C', 80), S('PF', 70)], th).C).toBe('yellow'))
  it('good starter with weak backup is yellow', () => expect(needLevels([...filler, S('C', 68), S('C', 40)], th).C).toBe('yellow'))
  it('weak starter is red', () => expect(needLevels([...filler, S('C', 55), S('C', 54)], th).C).toBe('red'))
  it('empty position is red', () => expect(needLevels(filler, th).C).toBe('red'))
  it('good starter, no backup, no adjacent cover is red', () => expect(needLevels([S('C', 68)], th).C).toBe('red'))
})

describe('teamNeeds', () => {
  it('hypothetical add/remove changes the level and does not mutate', () => {
    const l = createLeague({ seed: 5, userTeamIndex: 0, name: 'N' })
    const t = needThresholds(l)
    const before = teamNeeds(l, l.userTeamId, {}, t)
    const after = teamNeeds(l, l.userTeamId, { add: [{ pos: 'C', ovr: 99 }, { pos: 'C', ovr: 99 }] }, t)
    expect(after.C).toBe('green')
    expect(teamNeeds(l, l.userTeamId, {}, t)).toEqual(before)
  })
})
