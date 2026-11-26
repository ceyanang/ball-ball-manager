import { describe, expect, it } from 'vitest'
import { ovr } from '../../src/engine/gm/cap'
import { startOffseason } from '../../src/engine/gm/offseason'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import type { Injury } from '../../src/engine/types'

const base = createLeague({ seed: 11, userTeamIndex: 0, name: 'T' })

describe('offseason development', () => {
  it('heals every injury over the summer, including season-ending ones', () => {
    const l = structuredClone(base)
    const hurt: Injury = { type: 'Ruptured Achilles', severity: 'season', gamesRemaining: 999 }
    const ids = Object.values(l.players).slice(0, 30).map((p) => p.id)
    for (const id of ids) l.players[id].injury = { ...hurt }
    startOffseason(l, Rng.fromSeed(5))
    expect(Object.values(l.players).filter((p) => p.injury).length).toBe(0)
  })

  it('Achilles recovery is mixed: some come back whole, some lose athleticism and ceiling', () => {
    let whole = 0, worse = 0
    for (let s = 0; s < 40; s++) {
      const l = structuredClone(base)
      const star = Object.values(l.players).filter((p) => p.teamId && p.age <= 28).sort((a, b) => ovr(b) - ovr(a))[0]
      const spd = star.ratings.speed
      star.injury = { type: 'Ruptured Achilles', severity: 'season', gamesRemaining: 999 }
      startOffseason(l, Rng.fromSeed(100 + s))
      if (star.ratings.speed >= spd - 2) whole++
      else worse++
    }
    expect(whole).toBeGreaterThan(5)
    expect(worse).toBeGreaterThan(5)
  })

  it('nobody outgrows his ceiling in a normal offseason', () => {
    for (let s = 0; s < 3; s++) {
      const l = structuredClone(base)
      const before = Object.fromEntries(Object.values(l.players).map((p) => [p.id, { o: ovr(p), pot: p.pot }]))
      startOffseason(l, Rng.fromSeed(700 + s))
      for (const p of Object.values(l.players)) {
        if (p.retired || !before[p.id]) continue // the new draft class has no 'before'
        expect(ovr(p)).toBeLessThanOrEqual(Math.max(before[p.id].o, before[p.id].pot))
      }
    }
  })

  it('players in their prime or still young rarely crater in one summer', () => {
    let n = 0, big = 0
    for (let s = 0; s < 3; s++) {
      const l = structuredClone(base)
      const before = Object.fromEntries(Object.values(l.players).map((p) => [p.id, ovr(p)]))
      startOffseason(l, Rng.fromSeed(900 + s))
      for (const p of Object.values(l.players)) {
        if (p.retired || p.age > 28) continue // ages are already +1
        n++
        if (before[p.id] - ovr(p) >= 4) big++
      }
    }
    expect(big / n).toBeLessThan(0.01)
  })

  it('a young player who dipped still has a ceiling to climb back to', () => {
    const l = structuredClone(base)
    const p = Object.values(l.players).find((x) => x.teamId && x.age === 23 && ovr(x) < 80)!
    p.pot = ovr(p) + 6
    startOffseason(l, Rng.fromSeed(3))
    expect(p.pot).toBeGreaterThanOrEqual(ovr(p))
  })
})
