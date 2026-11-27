import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'

/** FNV-1a 32-bit over a string. */
function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Guard: games with no mods must stay bit-identical to the recorded hash through every MyCareer change. */
describe('golden sim snapshot', () => {
  it('40 seeded games hash to the recorded value', () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
    const ids = Object.keys(l.teams)
    let acc = ''
    for (let s = 1; s <= 40; s++) {
      const home = l.teams[ids[s % ids.length]]
      const away = l.teams[ids[(s * 7 + 3) % ids.length === s % ids.length ? (s + 1) % ids.length : (s * 7 + 3) % ids.length]]
      const r = simGame(home, away, l.players, l.coaches, Rng.fromSeed(s))
      acc += fnv(JSON.stringify(r))
    }
    const hash = fnv(acc)
    expect(hash).toBe('0fdf4af2')
  })
})
