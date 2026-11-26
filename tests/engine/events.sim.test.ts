import { afterEach, describe, expect, it } from 'vitest'
import { answerEvent, setCatalogForTests } from '../../src/engine/events/engine'
import type { EventDef } from '../../src/engine/events/types'
import { createLeague } from '../../src/engine/league/create'
import { simDays, simUntil } from '../../src/engine/season/advance'

const def = (when: EventDef['when'] = 'preGame'): EventDef => ({
  id: 'sim1', when, weight: 1, emoji: '🧪', cooldownDays: 0,
  pick: (c) => ({ playerIds: [c.roster[0].id] }), title: () => 'T', text: () => 'X',
  choices: [{ label: 'ok', outcomes: [{ weight: 1, tone: 'neutral', text: () => 'fine', effects: () => [] }] }, { label: 'no', outcomes: [{ weight: 1, tone: 'neutral', text: () => 'fine', effects: () => [] }] }],
})
const fresh = () => createLeague({ seed: 21, userTeamIndex: 7, name: 'S' })
const OPTS = { stopOnOffer: true, pauseForEvents: true }
afterEach(() => setCatalogForTests(null))

describe('sim pauses for events', () => {
  it('"sim to next event" stops on a pre-game pop-up before the game is played', () => {
    setCatalogForTests([def()])
    const l = simUntil(fresh(), 'event', OPTS)
    expect(l.events.pending?.eventId).toBe('sim1')
    const today = l.games.find((g) => g.day === l.day && (g.homeId === l.userTeamId || g.awayId === l.userTeamId))
    expect(today?.result).toBeNull()
  })
  it('does nothing while an event is waiting, then plays the day once it is answered (no re-roll)', () => {
    setCatalogForTests([def()])
    const a = simUntil(fresh(), 'event', OPTS)
    const stuck = simDays(a, 3, OPTS)
    expect(stuck.day).toBe(a.day)
    expect(stuck.events.pending).not.toBeNull()
    const b = structuredClone(stuck)
    expect(answerEvent(b, 0)).not.toBeNull()
    const c = simDays(b, 1, OPTS)
    expect(c.day).toBe(a.day + 1)
    const played = c.games.find((g) => g.day === a.day && (g.homeId === c.userTeamId || g.awayId === c.userTeamId))
    expect(played?.result).not.toBeNull()
  })
  it('pops up on days off and after games too', () => {
    for (const when of ['day', 'postGame'] as const) {
      setCatalogForTests([def(when)])
      const l = simUntil(fresh(), 'event', { pauseForEvents: true })
      expect(l.events.pending?.eventId).toBe('sim1')
    }
  })
  it('with events off, sim-to-event runs to the end of the phase and never loops forever', () => {
    setCatalogForTests([def()])
    const l0 = fresh()
    l0.events.frequency = 'off'
    const l = simUntil(l0, 'event', { pauseForEvents: true })
    expect(l.events.pending).toBeNull()
    expect(l.phase).not.toBe('regular')
  })
  it('without pauseForEvents nothing is ever rolled', () => {
    setCatalogForTests([def()])
    const l = simDays(fresh(), 20, { stopOnOffer: true })
    expect(l.events.pending).toBeNull()
    expect(l.events.rolled).toBeNull()
  })
})
