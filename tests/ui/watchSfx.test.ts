import { describe, expect, it } from 'vitest'
import type { PlayEvent } from '../../src/engine/sim/playlog'
import { sfxFor } from '../../src/audio/watchSfx'

const fg = (made: boolean, three = false): PlayEvent => ({ k: 'fg', side: 'home', player: 'p', made, three, home: 0, away: 0, period: 1, t: 0 })
const ft = (made: boolean): PlayEvent => ({ k: 'ft', side: 'home', player: 'p', made, home: 0, away: 0, period: 1, t: 0 })

describe('sfxFor', () => {
  it('made basket swishes, and a three also gets the crowd', () => {
    expect(sfxFor(fg(true))).toEqual(['swish'])
    expect(sfxFor(fg(true, true))).toEqual(['swish', 'crowd'])
  })
  it('a miss clanks, unless the next event is a block', () => {
    expect(sfxFor(fg(false))).toEqual(['clank'])
    expect(sfxFor(fg(false), { k: 'blk', side: 'away', player: 'q', period: 1, t: 0 })).toEqual(['block'])
  })
  it('free throws tick, then swish or clank', () => {
    expect(sfxFor(ft(true))).toEqual(['ftTick', 'swish'])
    expect(sfxFor(ft(false))).toEqual(['ftTick', 'clank'])
  })
  it('rebounds, subs and lineups are silent', () => {
    expect(sfxFor({ k: 'reb', side: 'home', player: 'p', off: false, period: 1, t: 0 })).toEqual([])
    expect(sfxFor({ k: 'sub', side: 'home', out: 'a', in: 'b', slot: 0, period: 1, t: 0 })).toEqual([])
    expect(sfxFor({ k: 'lineup', side: 'home', players: [], period: 1, t: 0 })).toEqual([])
  })
})
