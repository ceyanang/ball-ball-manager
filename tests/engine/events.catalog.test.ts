import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../src/engine/events/catalog'
import { answerEvent, setCatalogForTests } from '../../src/engine/events/engine'
import type { EventCtx, EventDef } from '../../src/engine/events/types'
import { committed, ovr } from '../../src/engine/gm/cap'
import { createLeague } from '../../src/engine/league/create'
import { simDays } from '../../src/engine/season/advance'
import type { League } from '../../src/engine/types'

const leagues = [1, 2, 3, 4, 5].map((seed) => createLeague({ seed, userTeamIndex: seed * 4, name: 'c' }))
const GAMES = [{ won: true, margin: 20 }, { won: false, margin: 20 }, { won: true, margin: 2 }, { won: false, margin: 2 }]
const ctxFor = (l: League, def: EventDef, userGame: EventCtx['userGame']): EventCtx => ({
  l, when: def.when, game: null, userGame,
  roster: committed(l, l.userTeamId).sort((a, b) => Number(!!a.injury) - Number(!!b.injury) || ovr(b) - ovr(a)),
})
const asPlayoffs = (l: League) => ({ ...l, phase: 'playoffs' as const })

describe('event catalog', () => {
  it('has the launch set', () => {
    const n = (f: (d: EventDef) => boolean) => CATALOG.filter(f).length
    expect(n((d) => d.when === 'preGame')).toBeGreaterThanOrEqual(12)
    expect(n((d) => d.kind === 'request')).toBeGreaterThanOrEqual(15)
    expect(n((d) => d.when === 'postGame')).toBeGreaterThanOrEqual(12)
    expect(n((d) => d.when === 'day')).toBeGreaterThanOrEqual(12)
    expect(n((d) => !!d.playoffsOnly)).toBeGreaterThanOrEqual(4)
    expect(CATALOG.length).toBeGreaterThanOrEqual(78)
  })
  it('has unique ids and sane shapes', () => {
    expect(new Set(CATALOG.map((d) => d.id)).size).toBe(CATALOG.length)
    for (const d of CATALOG) {
      expect(d.choices.length, d.id).toBeGreaterThanOrEqual(2)
      expect(d.choices.length, d.id).toBeLessThanOrEqual(3)
      expect(d.weight, d.id).toBeGreaterThan(0)
      const all = d.choices.flatMap((c) => c.outcomes)
      expect(all.some((o) => o.tone === 'good'), `${d.id} needs a good outcome`).toBe(true)
      expect(all.some((o) => o.tone !== 'good'), `${d.id} needs a risk`).toBe(true)
      for (const c of d.choices) {
        expect(c.outcomes.length, `${d.id}/${c.label}`).toBeGreaterThan(0)
        expect(c.outcomes.every((o) => o.tone === 'good') && c.outcomes.length > 0, `${d.id}/${c.label} is a free lunch`).toBe(false)
        for (const o of c.outcomes) expect(o.weight).toBeGreaterThan(0)
      }
    }
  })
  it('every event can fire for someone, renders clean text, and only touches its own subjects', () => {
    for (const d of CATALOG) {
      let fired = 0
      for (const base of leagues) {
        const l = d.playoffsOnly ? asPlayoffs(base) : base
        for (const ug of d.when === 'postGame' ? GAMES : [null]) {
        const s = d.pick(ctxFor(l, d, ug))
        if (!s) continue
        fired++
        const roster = new Set(committed(l, l.userTeamId).map((p) => p.id))
        for (const id of s.playerIds) expect(roster.has(id), d.id).toBe(true)
        for (const t of [d.title(s, l), d.text(s, l), ...d.choices.flatMap((c) => c.outcomes.map((o) => o.text(s, l)))]) {
          expect(t, d.id).not.toMatch(/undefined|\{|\[object/)
          expect(t.length, d.id).toBeGreaterThan(3)
        }
        for (const c of d.choices) for (const o of c.outcomes) for (const e of o.effects(s, l)) {
          const target = 'target' in e && e.target !== 'team' && e.target !== 'roster' ? e.target.player : 'player' in e ? e.player : null
          if (target) expect(s.playerIds, `${d.id} effect target`).toContain(target)
        }
        }
      }
      expect(fired, `${d.id} never fires`).toBeGreaterThan(0)
    }
  })
  it('a full season on "lots" produces a healthy number of events and survives answering them all', () => {
    setCatalogForTests(null)
    let l = createLeague({ seed: 8, userTeamIndex: 9, name: 'season' })
    let events = 0
    for (let guard = 0; l.phase === 'regular' && guard < 400; guard++) {
      l = simDays(l, 1, { pauseForEvents: true })
      if (l.events.pending) { events++; expect(answerEvent(l, 0)).not.toBeNull() }
    }
    expect(events).toBeGreaterThanOrEqual(12)
    expect(events).toBeLessThanOrEqual(40)
  })
})
