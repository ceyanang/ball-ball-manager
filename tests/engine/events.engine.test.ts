import { afterEach, describe, expect, it } from 'vitest'
import { answerEvent, eventClock, rollEvent, setCatalogForTests, skipEvent } from '../../src/engine/events/engine'
import type { EventDef } from '../../src/engine/events/types'
import { createLeague } from '../../src/engine/league/create'
import type { League } from '../../src/engine/types'

const mk = (over: Partial<EventDef> = {}): EventDef => ({
  id: 'e1', when: 'preGame', weight: 1, emoji: '🧪',
  pick: (c) => ({ playerIds: [c.roster[0].id] }),
  title: () => 'Test', text: () => 'Hello',
  choices: [{
    label: 'Gamble',
    outcomes: [
      { weight: 1, tone: 'good', text: () => 'yay', effects: (s) => [{ kind: 'morale', target: { player: s.playerIds[0] }, delta: 7 }] },
      { weight: 1, tone: 'bad', text: () => 'boo', effects: (s) => [{ kind: 'morale', target: { player: s.playerIds[0] }, delta: -7 }] },
    ],
  }, { label: 'Safe', outcomes: [{ weight: 1, tone: 'neutral', text: () => 'meh', effects: () => [] }] }],
  ...over,
})
const fresh = (): League => createLeague({ seed: 4, userTeamIndex: 5, name: 'ev' })
const fire = (l: League, when: 'preGame' | 'postGame' | 'day' = 'preGame') => {
  for (let d = 1; d < 400 && !l.events.pending; d++) { l.day = d; rollEvent(l, when, null) }
  return l.events.pending
}
afterEach(() => setCatalogForTests(null))

describe('answerEvent', () => {
  it('gives the same outcome after a reload and does nothing when nothing is pending', () => {
    setCatalogForTests([mk()])
    const l = fresh()
    expect(fire(l)).not.toBeNull()
    const a = structuredClone(l), b = structuredClone(l)
    const ea = answerEvent(a, 0)!, eb = answerEvent(b, 0)!
    expect(ea.changes).toEqual(eb.changes)
    expect(ea.tone).toBe(eb.tone)
    expect(a.events.pending).toBeNull()
    expect(a.events.history).toHaveLength(1)
    expect(answerEvent(a, 0)).toBeNull()
  })
  it('drops the event with no effects when its player has left', () => {
    setCatalogForTests([mk()])
    const l = fresh()
    fire(l)
    const p = l.players[l.events.pending!.subjects.playerIds[0]]
    const morale = p.morale
    p.teamId = null
    expect(answerEvent(l, 0)).toBeNull()
    expect(l.events.pending).toBeNull()
    expect(p.morale).toBe(morale)
  })
})

describe('rollEvent', () => {
  it('never fires when off, or when pick() has nobody', () => {
    setCatalogForTests([mk()])
    const off = fresh(); off.events.frequency = 'off'
    for (let d = 1; d < 200; d++) { off.day = d; expect(rollEvent(off, 'preGame', null)).toBe(false) }
    setCatalogForTests([mk({ pick: () => null })])
    const none = fresh()
    for (let d = 1; d < 200; d++) { none.day = d; expect(rollEvent(none, 'preGame', null)).toBe(false) }
  })
  it('fires on a sensible share of pre-game days on "lots"', () => {
    setCatalogForTests([mk()])
    const l = fresh()
    let n = 0
    for (let d = 1; d <= 200; d++) { l.day = d; l.events.pending = null; l.events.cooldowns = {}; if (rollEvent(l, 'preGame', null)) n++ }
    expect(n / 200).toBeGreaterThan(0.15)
    expect(n / 200).toBeLessThan(0.5)
  })
  it('rolls each day/slot only once', () => {
    setCatalogForTests([mk()])
    const l = fresh()
    l.day = 3
    rollEvent(l, 'preGame', null)
    l.events.pending = null
    expect(rollEvent(l, 'preGame', null)).toBe(false)
  })
  it('respects cooldowns', () => {
    setCatalogForTests([mk({ cooldownDays: 30 })])
    const l = fresh()
    fire(l)
    const day = l.day
    answerEvent(l, 1)
    expect(l.events.cooldowns.e1).toBe(eventClock(l) + 30)
    for (let d = day + 1; d < day + 30; d++) { l.day = d; expect(rollEvent(l, 'preGame', null)).toBe(false) }
  })
  it('ignores playoff-only events in the regular season', () => {
    setCatalogForTests([mk({ playoffsOnly: true })])
    const l = fresh()
    for (let d = 1; d < 200; d++) { l.day = d; expect(rollEvent(l, 'preGame', null)).toBe(false) }
  })
})

describe('skipEvent', () => {
  it('skips between-day events but not game-day ones', () => {
    setCatalogForTests([mk({ id: 'd1', when: 'day' }), mk({ id: 'p1', when: 'preGame' })])
    const l = fresh()
    fire(l, 'day')
    expect(skipEvent(l)).toBe(true)
    expect(l.events.pending).toBeNull()
    l.events.rolled = null
    fire(l, 'preGame')
    expect(skipEvent(l)).toBe(false)
    expect(l.events.pending).not.toBeNull()
  })
})
