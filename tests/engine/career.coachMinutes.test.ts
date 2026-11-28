import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { ovrOf } from '../../src/engine/career/careerOvr'
import { Rng } from '../../src/engine/rng'
import { CAREER_COACH_BONUS, coachRotation } from '../../src/engine/sim/rotation'

describe('coach favours the MyCareer player', () => {
  it('ranks him ahead of teammates within the bonus of his OVR, never ahead of clearly better ones', () => {
    const t = BUILD_TEMPLATES[0]
    const l = createCareerLeague({ seed: 12, name: 'P', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })
    pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
    resolveCareerDraft(l, new Rng(l.rng))
    const me = l.players[l.career!.playerId]
    const roster = Object.values(l.players).filter((p) => p.teamId === me.teamId)
    const rot = coachRotation(roster)
    const mine = ovrOf(me)
    const i = rot.bench.indexOf(me.id)
    expect(i).toBeGreaterThanOrEqual(0)
    // Nobody he jumped is clearly better than him; nobody ahead of him on the bench is worse than him + bonus.
    for (const id of rot.bench.slice(i + 1)) expect(ovrOf(l.players[id])).toBeLessThanOrEqual(mine + CAREER_COACH_BONUS)
    for (const id of rot.bench.slice(0, i)) expect(ovrOf(l.players[id])).toBeGreaterThan(mine + CAREER_COACH_BONUS)
    // He is no longer the 12th man.
    expect(i).toBeLessThan(rot.bench.length - 1)
  })
})
