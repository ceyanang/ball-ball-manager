import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { DEFAULT_MOMENT_RATE, momentOutcome, type MomentPlay } from '../../src/engine/sim/moments'
import type { PlayEvent } from '../../src/engine/sim/playlog'
import type { GameMods } from '../../src/engine/events/mods'

const name = (id: string) => id.toUpperCase()
const fg = (player: string, made: boolean, three = false): PlayEvent => ({ k: 'fg', period: 1, t: 0.5, side: 'home', player, made, three, home: 0, away: 0 })
const ft = (player: string, made: boolean): PlayEvent => ({ k: 'ft', period: 1, t: 0.5, side: 'home', player, made, home: 0, away: 0 })

describe('momentOutcome', () => {
  it('calls a dunk, a miss, a block, a foul, an and-one and a dime', () => {
    const dunk: MomentPlay = { kind: 'drive', shooter: 'me', zone: 'driveDunk' }
    expect(momentOutcome([fg('me', true)], 0, dunk, 'me', name)?.text).toContain('THROWS IT DOWN')
    expect(momentOutcome([fg('me', false)], 0, dunk, 'me', name)).toMatchObject({ good: false, endAt: 0 })
    const blk = momentOutcome([fg('me', false), { k: 'blk', period: 1, t: 0.5, side: 'away', player: 'big' }], 0, dunk, 'me', name)
    expect(blk).toMatchObject({ good: false, endAt: 1 })
    expect(blk!.text).toContain('BIG')
    const fouled = momentOutcome([ft('me', true), ft('me', false)], 0, dunk, 'me', name)
    expect(fouled).toMatchObject({ endAt: 1, good: true })
    expect(fouled!.text).toContain('1/2')
    const andOne = momentOutcome([fg('me', true), ft('me', true)], 0, dunk, 'me', name)
    expect(andOne).toMatchObject({ endAt: 1 })
    expect(andOne!.text).toContain('AND ONE')
    const pass: MomentPlay = { kind: 'pass', shooter: 'mate', zone: 'three' }
    const dime = momentOutcome([fg('mate', true, true), { k: 'ast', period: 1, t: 0.5, side: 'home', player: 'me' }], 0, pass, 'me', name)
    expect(dime).toMatchObject({ endAt: 1, good: true })
    expect(dime!.text).toContain('DIME')
    expect(dime!.text).toContain('MATE')
  })

  it('every moment in real games has a call', () => {
    const l = createLeague({ seed: 21, userTeamIndex: 0, name: 'M' })
    const ids = Object.keys(l.teams)
    let n = 0
    for (let i = 0; i < 12; i++) {
      const home = l.teams[ids[i % ids.length]], away = l.teams[ids[(i + 5) % ids.length]]
      const star = home.rotation.starters[0]
      const marks: number[] = [], plays: MomentPlay[] = []
      const mods: GameMods = { shooting: {}, defense: {}, energy: {}, sit: [], chemistry: {}, career: { playerId: star, rate: DEFAULT_MOMENT_RATE, answers: [], auto: true, marks, plays } }
      const log: PlayEvent[] = []
      simGame(home, away, l.players, l.coaches, Rng.fromSeed(900 + i), log, mods)
      expect(plays.length).toBe(marks.length)
      for (let k = 0; k < marks.length; k++) {
        expect(momentOutcome(log, marks[k], plays[k], star, name)).not.toBeNull()
        n++
      }
    }
    expect(n).toBeGreaterThan(10)
  })
})
