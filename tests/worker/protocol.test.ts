import { describe, expect, it } from 'vitest'
import { simRollsEvents } from '../../src/worker/protocol'

describe('which sims roll pop-up events', () => {
  it('step-by-step sims do', () => {
    expect(simRollsEvents({ type: 'simDays', days: 1 })).toBe(true)
    expect(simRollsEvents({ type: 'simUntil', target: 'event' })).toBe(true)
    expect(simRollsEvents({ type: 'watchDay' })).toBe(true)
  })
  it('sim week and the long sims skip them', () => {
    expect(simRollsEvents({ type: 'simDays', days: 7 })).toBe(false)
    for (const target of ['deadline', 'regularEnd', 'playoffsEnd', 'seriesEnd'] as const) expect(simRollsEvents({ type: 'simUntil', target })).toBe(false)
  })
})
