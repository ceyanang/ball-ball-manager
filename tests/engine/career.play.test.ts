import { describe, expect, it } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { createCareerLeague } from '../../src/engine/career/create'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../src/engine/career/draftNight'
import { careerPlayDay, type DayResult } from '../../src/engine/career/play'
import { Rng } from '../../src/engine/rng'
import type { Game, League } from '../../src/engine/types'

const t = BUILD_TEMPLATES[0]
function active(seed = 11): League {
  const l = createCareerLeague({ seed, name: 'P', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })
  pickPrompts(l).forEach((p, i) => answerDraftPrompt(l, p.id, i % p.choices.length))
  resolveCareerDraft(l, new Rng(l.rng))
  return l
}
const me = (l: League) => l.players[l.career!.playerId]
const gameToday = (l: League): Game | undefined =>
  l.games.find((g) => g.day === l.day && !g.result && !g.playoff && (g.homeId === me(l).teamId || g.awayId === me(l).teamId))
/** Sims days until the followed player's team has a game today. */
function toGameDay(l: League): League {
  for (let i = 0; i < 60 && !gameToday(l); i++) l = careerPlayDay(l, 'sim').league
  expect(gameToday(l)).toBeDefined()
  return l
}
function playThrough(l: League, pick: (r: Extract<DayResult, { kind: 'moment' }>) => import('../../src/engine/sim/moments').MomentAnswer = () => ({ kind: 'shoot' })) {
  let res = careerPlayDay(l, 'play')
  let moments = 0
  while (res.kind === 'moment') {
    moments++
    res = careerPlayDay(res.league, 'play', pick(res))
    expect(moments).toBeLessThan(100)
  }
  return { league: res.league, moments }
}

describe('careerPlayDay', () => {
  it('sim mode never asks and counts a simmed game', () => {
    let l = toGameDay(active())
    const before = l.career!.simmed
    const res = careerPlayDay(l, 'sim')
    expect(res.kind).toBe('done')
    l = res.league
    expect(l.career!.played).toBe(0)
    expect(l.career!.pending).toBeNull()
    expect(l.career!.simmed).toBeGreaterThanOrEqual(before)
  })

  it('play mode asks moments, then finishes, counts a played game and leaves box = score', () => {
    // Find a game day where he actually gets moments.
    let l = active(12)
    let found = false
    for (let i = 0; i < 40 && !found; i++) {
      l = toGameDay(l)
      const g = gameToday(l)!
      const playedBefore = l.career!.played
      const out = playThrough(l)
      if (out.moments > 0) {
        found = true
        const done = out.league
        const played = done.games.find((x) => x.id === g.id)!
        expect(played.result).not.toBeNull()
        expect(played.result!.box.filter((b) => b.teamId === g.homeId).reduce((s, b) => s + b.pts, 0)).toBe(played.result!.homeScore)
        expect(played.result!.box.filter((b) => b.teamId === g.awayId).reduce((s, b) => s + b.pts, 0)).toBe(played.result!.awayScore)
        expect(done.career!.played).toBe(playedBefore + 1)
        expect(done.career!.pending).toBeNull()
      }
      l = careerPlayDay(out.league, 'sim').league
    }
    expect(found).toBe(true)
  })

  it('a reload mid-moment asks the same moment again, not a re-roll', () => {
    let l = active(12)
    for (let i = 0; i < 40; i++) {
      l = toGameDay(l)
      const first = careerPlayDay(l, 'play')
      if (first.kind === 'moment') {
        const saved = JSON.parse(JSON.stringify(first.league)) as League
        expect(saved.career!.pending).not.toBeNull()
        const again = careerPlayDay(saved, 'play')
        expect(again.kind).toBe('moment')
        if (again.kind === 'moment') expect(again.prompt).toEqual(first.prompt)
        // answer, save, reload, and the next moment is also stable
        const next = careerPlayDay(saved, 'play', { kind: 'shoot' })
        if (next.kind === 'moment') {
          const reloaded = JSON.parse(JSON.stringify(next.league)) as League
          const re = careerPlayDay(reloaded, 'play')
          expect(re.kind === 'moment' && re.prompt).toEqual(next.prompt)
        }
        return
      }
      l = first.league
    }
    throw new Error('never got a moment')
  })

  it('an injured followed player gets no prompt and the game auto-sims', () => {
    let l = toGameDay(active(12))
    me(l).injury = { type: 'Ankle sprain', gamesRemaining: 5, severity: 'short' }
    const res = careerPlayDay(l, 'play')
    expect(res.kind).toBe('done')
    expect(res.league.career!.played).toBe(0)
    expect(res.league.career!.pending).toBeNull()
    l = res.league
    expect(l.games.every((g) => g.day >= l.day || g.result)).toBe(true)
  })

  it('a day without his game just advances the calendar', () => {
    let l = active(12)
    for (let i = 0; i < 30 && gameToday(l); i++) l = careerPlayDay(l, 'sim').league
    if (!gameToday(l)) {
      const d = l.day
      expect(careerPlayDay(l, 'play').kind).toBe('done')
      expect(careerPlayDay(l, 'play').league.day).toBe(d + 1)
    }
  })

  it('normal simDays in a career league never prompts', async () => {
    const { simDays } = await import('../../src/engine/season/advance')
    const l = simDays(toGameDay(active(13)), 10)
    expect(l.career!.pending).toBeNull()
    expect(l.career!.played).toBe(0)
  })
  it('watching: a moment pauses with a preview log whose events up to the moment are what really happens', () => {
    let l = active(12)
    let checked = 0
    for (let i = 0; i < 40 && checked < 3; i++) {
      l = toGameDay(l)
      let res = careerPlayDay(l, 'play', undefined, { watch: true })
      while (res.kind === 'moment') {
        const { watch, prompt, preview } = res
        expect(watch).toBeTruthy()
        expect(preview?.result).toBeTruthy()
        const pos = watch!.moments![prompt.index]
        expect(pos).toBeGreaterThanOrEqual(0)
        expect(res.league.games.find((g) => g.id === watch!.gameId)!.result).toBeNull()
        res = careerPlayDay(res.league, 'play', { kind: 'drive' }, { watch: true })
        const strip = (es: NonNullable<typeof watch>['log']) => es.slice(0, pos).map(({ t: _t, ...e }) => e)
        expect(strip(res.watch!.log)).toEqual(strip(watch!.log))
        expect(res.watch!.moments![prompt.index]).toBe(pos)
        checked++
      }
      expect(res.watch?.gameId).toBe(gameToday(l)!.id)
      expect(res.league.career!.played).toBeGreaterThan(l.career!.played)
      l = res.league
    }
    expect(checked).toBeGreaterThan(0)
  })
})
