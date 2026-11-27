import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { DRAFT_PROMPTS, answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { ROSTER_MAX } from '../../src/engine/constants'
import { Rng } from '../../src/engine/rng'
import type { League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[2]
const fresh = (seed = 7): League => createCareerLeague({ seed, name: 'D', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 77 } })
function answered(seed: number, choices: number[]): League {
  const l = fresh(seed)
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, choices[i] % p.choices.length))
  return l
}
const run = (l: League) => resolveCareerDraft(l, new Rng(l.rng))

describe('draft night', () => {
  it('has at least six prompts of plain data and picks three distinct ones deterministically', () => {
    expect(DRAFT_PROMPTS.length).toBeGreaterThanOrEqual(6)
    for (const p of DRAFT_PROMPTS) { expect(p.choices.length).toBeGreaterThanOrEqual(2); expect(p.choices.length).toBeLessThanOrEqual(3) }
    const a = pickPrompts(fresh(7)).map((p) => p.id)
    expect(a).toHaveLength(3)
    expect(new Set(a).size).toBe(3)
    expect(pickPrompts(fresh(7)).map((p) => p.id)).toEqual(a)
  })
  it('records answers and tags, in order, once each', () => {
    const l = fresh()
    const [p1, p2] = pickPrompts(l)
    expect(() => answerDraftPrompt(l, p2.id, 0)).toThrow()
    answerDraftPrompt(l, p1.id, 1)
    expect(l.career!.draftAnswers).toEqual([1])
    expect(l.career!.draftTags).toEqual(p1.choices[1].tags)
    expect(() => answerDraftPrompt(l, p1.id, 0)).toThrow()
    expect(() => answerDraftPrompt(l, p2.id, 9)).toThrow()
  })
  it('same seed and answers give the same slot and team; answers can change it', () => {
    const a = run(answered(7, [0, 0, 0])), b = run(answered(7, [0, 0, 0]))
    expect(a).toEqual(b)
    const slots = new Set<number>()
    for (const c of [[0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0], [1, 0, 1]]) slots.add(run(answered(7, c)).slot)
    expect(slots.size).toBeGreaterThan(1)
  })
  it('always lands in a valid slot on a team with room, and the league follows him', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const l = answered(seed, [seed, seed + 1, seed + 2])
      const { slot, teamId } = run(l)
      const p = l.players[l.career!.playerId]
      expect(slot).toBeGreaterThanOrEqual(1)
      expect(slot).toBeLessThanOrEqual(60)
      expect(p.teamId).toBe(teamId)
      expect(l.userTeamId).toBe(teamId)
      expect(l.career!.status).toBe('active')
      expect(p.draft).toEqual({ season: l.season, round: slot <= 30 ? 1 : 2, pick: slot, teamId })
      expect(p.contract!.salary).toBeGreaterThan(0)
      expect(Object.values(l.players).filter((q) => q.teamId === teamId && !q.retired).length).toBeLessThanOrEqual(ROSTER_MAX)
      const rot = l.teams[teamId].rotation
      expect([...rot.starters, ...rot.bench, ...rot.inactive]).toContain(p.id)
    }
  })
  it('refuses to resolve before all three prompts are answered', () => {
    expect(() => run(fresh())).toThrow()
  })
})
