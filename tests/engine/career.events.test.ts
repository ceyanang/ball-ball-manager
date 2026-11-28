import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { CAREER_EVENTS } from '../../src/engine/events/catalog/career'
import { applyEffects } from '../../src/engine/events/effects'
import { eventDef, rollEvent } from '../../src/engine/events/engine'
import type { EventCtx, EventDef } from '../../src/engine/events/types'
import { createLeague } from '../../src/engine/league/create'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import { Rng } from '../../src/engine/rng'
import type { League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[1]
function active(seed = 9): League {
  const l = createCareerLeague({ seed, name: 'E', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 77 } })
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
  resolveCareerDraft(l, new Rng(l.rng))
  return l
}
const me = (l: League) => l.players[l.career!.playerId]
const ctxFor = (l: League, def: EventDef): EventCtx => ({
  l, when: def.when, game: null, userGame: def.when === 'postGame' ? { won: true, margin: 8 } : null,
  roster: Object.values(l.players).filter((p) => p.teamId === l.userTeamId).sort((a, b) => Number(!!a.injury) - Number(!!b.injury)),
})

describe('career event catalog', () => {
  it('has about a dozen well-formed events, all flagged career', () => {
    expect(CAREER_EVENTS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(CAREER_EVENTS.map((d) => d.id)).size).toBe(CAREER_EVENTS.length)
    const whens = new Set(CAREER_EVENTS.map((d) => d.when))
    expect(whens.has('day') && whens.has('preGame') && whens.has('postGame')).toBe(true)
    const l = active()
    for (const d of CAREER_EVENTS) {
      expect(d.career, d.id).toBe(true)
      expect(d.choices.length, d.id).toBeGreaterThanOrEqual(2)
      expect(d.choices.length, d.id).toBeLessThanOrEqual(3)
      expect(d.weight, d.id).toBeGreaterThan(0)
      const s = d.pick(ctxFor(l, d))
      if (!s) continue
      expect(s.playerIds).toEqual([me(l).id])
      for (const c of d.choices) {
        expect(c.outcomes.length).toBeGreaterThan(0)
        for (const o of c.outcomes) {
          expect(o.weight).toBeGreaterThan(0)
          expect(o.text(s, l)).not.toMatch(/undefined|\{|\[object/)
          for (const e of o.effects(s, l)) if (e.kind === 'grow') for (const g of e.grants) { expect(RATING_KEYS).toContain(g.key); expect(g.amount).toBeGreaterThan(0) }
        }
      }
    }
  })

  it('most events can fire for the followed player and several choices grow named stats', () => {
    const l = active()
    const fireable = CAREER_EVENTS.filter((d) => d.pick(ctxFor(l, d)))
    expect(fireable.length).toBeGreaterThanOrEqual(10)
    const growers = CAREER_EVENTS.filter((d) => d.choices.some((c) => c.outcomes.some((o) => o.effects({ playerIds: [me(l).id], teamId: l.userTeamId }, l).some((e) => e.kind === 'grow'))))
    expect(growers.length).toBeGreaterThanOrEqual(9)
  })

  it('career events never fire in normal leagues, and normal events never in career leagues', () => {
    const normal = createLeague({ seed: 3, userTeamIndex: 0, name: 'N' })
    const career = active()
    for (const [l, wantCareer] of [[normal, false], [career, true]] as const) {
      l.events.frequency = 'lots'
      let fired = 0
      for (let day = 1; day <= 400; day++) {
        l.day = day
        for (const when of ['day', 'preGame', 'postGame'] as const) {
          l.events.pending = null
          l.events.rolled = null
          l.events.cooldowns = {}
          const game = when === 'day' ? null : l.games.find((g) => g.homeId === l.userTeamId || g.awayId === l.userTeamId) ?? null
          if (rollEvent(l, when, game)) {
            fired++
            expect(!!eventDef(l.events.pending!.eventId)!.career).toBe(wantCareer)
          }
        }
      }
      expect(fired).toBeGreaterThan(5)
    }
  })

  it('respects injury: nothing about training fires for an injured followed player', () => {
    const l = active()
    me(l).injury = { type: 'Knee', gamesRemaining: 20, severity: 'long' }
    const gym = CAREER_EVENTS.find((d) => d.id === 'career-gym-night')!
    expect(gym.pick(ctxFor(l, gym))).toBeNull()
    const scare = CAREER_EVENTS.find((d) => d.id === 'career-injury-scare')!
    expect(scare.pick(ctxFor(l, scare))).toBeNull()
  })

  it('a card that goes his way pays skill points and edits nobody\'s ratings', () => {
    const l = active()
    const all = JSON.stringify(Object.values(l.players).map((p) => p.ratings))
    const gym = CAREER_EVENTS.find((d) => d.id === 'career-gym-night')!
    const s = gym.pick(ctxFor(l, gym))!
    let paid = false
    for (const c of gym.choices) for (const o of c.outcomes) {
      const copy = structuredClone(l)
      const lines = applyEffects(copy, o.effects(s, copy))
      if ((copy.career!.sp ?? 0) > 0) { paid = true; expect(lines.join(' ')).toMatch(/\+\d+ SP/) }
      expect(JSON.stringify(Object.values(copy.players).map((p) => p.ratings))).toEqual(all)
    }
    expect(paid).toBe(true)
  })
})
