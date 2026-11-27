import { describe, expect, it } from 'vitest'
import { PARODY_TEAMS } from '../../src/engine/data/teams'
import { STARTING_RIVALS } from '../../src/engine/rivals/data'

describe('starting rivals', () => {
  const abbrevs = new Set(PARODY_TEAMS.map((t) => t.abbrev))
  it('every team lists 2 distinct, valid rivals that are not itself', () => {
    for (const t of PARODY_TEAMS) {
      const r = STARTING_RIVALS[t.abbrev]
      expect(r, t.abbrev).toBeDefined()
      expect(r).toHaveLength(2)
      expect(new Set(r).size).toBe(2)
      for (const x of r) { expect(abbrevs.has(x), `${t.abbrev}→${x}`).toBe(true); expect(x).not.toBe(t.abbrev) }
    }
  })
  it('has the Cavapoos↔Worriers joke and the LA derby', () => {
    expect(STARTING_RIVALS.CLE).toContain('GSW')
    expect(STARTING_RIVALS.GSW).toContain('CLE')
    expect(STARTING_RIVALS.LAF).toContain('LAK')
    expect(STARTING_RIVALS.LAK).toContain('LAF')
  })
})
