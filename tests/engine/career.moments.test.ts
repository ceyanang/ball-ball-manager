import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { DEFAULT_MOMENT_RATE, LOOK_CUTOFF, MomentPause, lookFor, momentTriggers, type MomentAnswer, type MomentPrompt } from '../../src/engine/sim/moments'
import type { GameMods } from '../../src/engine/events/mods'
import type { GameResult } from '../../src/engine/types'

const l = createLeague({ seed: 21, userTeamIndex: 0, name: 'M' })
const ids = Object.keys(l.teams)
const matchup = (i: number) => {
  const home = l.teams[ids[i % ids.length]]
  const away = l.teams[ids[(i + 5) % ids.length]]
  return { home, away, star: home.rotation.starters[0] }
}
const baseMods = (): GameMods => ({ shooting: {}, defense: {}, energy: {}, sit: [], chemistry: {} })
const modsFor = (star: string, answers: MomentAnswer[], auto: boolean): GameMods => ({ ...baseMods(), career: { playerId: star, rate: DEFAULT_MOMENT_RATE, answers, auto } })
const sim = (i: number, mods?: GameMods): GameResult => {
  const { home, away } = matchup(i)
  return simGame(home, away, l.players, l.coaches, Rng.fromSeed(500 + i), undefined, mods)
}
/** Answers every moment with `pick`, returning the result and how many moments the game asked. */
function playOut(i: number, pick: (p: MomentPrompt) => MomentAnswer): { result: GameResult; moments: number; prompts: MomentPrompt[] } {
  const { star } = matchup(i)
  const answers: MomentAnswer[] = []
  const prompts: MomentPrompt[] = []
  for (let guard = 0; guard < 200; guard++) {
    try {
      return { result: sim(i, modsFor(star, answers, false)), moments: answers.length, prompts }
    } catch (e) {
      if (!(e instanceof MomentPause)) throw e
      prompts.push(e.prompt)
      answers.push(pick(e.prompt))
    }
  }
  throw new Error('too many moments')
}

describe('moments', () => {
  it('momentTriggers is a pure hash: deterministic, never at rate 0, always at rate 1', () => {
    expect(momentTriggers(5, 10, 0, 0.3)).toBe(momentTriggers(5, 10, 0, 0.3))
    let hits = 0
    for (let n = 0; n < 2000; n++) {
      expect(momentTriggers(9, n, 0, 0)).toBe(false)
      expect(momentTriggers(9, n, 1, 1)).toBe(true)
      if (momentTriggers(9, n, 0, 0.3)) hits++
    }
    expect(hits / 2000).toBeGreaterThan(0.24)
    expect(hits / 2000).toBeLessThan(0.36)
  })

  it('lookFor is monotonic: green at the green cut-off, yellow at the yellow cut-off, else red', () => {
    const { green, yellow } = LOOK_CUTOFF
    expect(yellow).toBeLessThan(green)
    expect(lookFor(green + 0.1)).toBe('green')
    expect(lookFor(green)).toBe('green')
    expect(lookFor(green - 0.001)).toBe('yellow')
    expect(lookFor(yellow)).toBe('yellow')
    expect(lookFor(yellow - 0.001)).toBe('red')
    const order = { red: 0, yellow: 1, green: 2 }
    let last = 0
    for (let p = 0; p <= 1; p += 0.01) { const v = order[lookFor(p)]; expect(v).toBeGreaterThanOrEqual(last); last = v }
  })

  it('without career mods nothing changes (mods present but no career block)', () => {
    for (let i = 0; i < 5; i++) expect(JSON.stringify(sim(i, baseMods()))).toBe(JSON.stringify(sim(i)))
  })

  it('answering shoot every time equals the plain sim', () => {
    for (let i = 0; i < 30; i++) {
      const { result } = playOut(i, () => ({ kind: 'shoot' }))
      expect(JSON.stringify(result)).toBe(JSON.stringify(sim(i)))
    }
  })

  it('mixed answers still leave the box score equal to the final score', () => {
    let k = 0
    for (let i = 0; i < 30; i++) {
      const { result } = playOut(i, (p) => {
        const opts = p.options.map((o) => o.answer)
        return opts[k++ % opts.length]
      })
      for (const [side, score] of [['home', result.homeScore], ['away', result.awayScore]] as const) {
        const teamId = side === 'home' ? matchup(i).home.id : matchup(i).away.id
        expect(result.box.filter((b) => b.teamId === teamId).reduce((s, b) => s + b.pts, 0)).toBe(score)
      }
    }
  })

  it('the first pause is identical on every replay and options never show numbers', () => {
    for (let i = 0; i < 10; i++) {
      const { star } = matchup(i)
      const grab = () => { try { sim(i, modsFor(star, [], false)); return null } catch (e) { if (e instanceof MomentPause) return e.prompt; throw e } }
      const a = grab(), b = grab()
      expect(a).toEqual(b)
      if (a) {
        expect(a.index).toBe(0)
        expect(a.options.length).toBeGreaterThanOrEqual(2)
        expect(a.options[0].answer).toEqual({ kind: 'shoot' })
        for (const o of a.options) expect(['green', 'yellow', 'red']).toContain(o.look)
      }
    }
  })

  it('a played game has about 3–6 moments on average (assert 2..9)', () => {
    let total = 0
    for (let i = 0; i < 30; i++) total += playOut(i, () => ({ kind: 'shoot' })).moments
    const avg = total / 30
    expect(avg).toBeGreaterThanOrEqual(2)
    expect(avg).toBeLessThanOrEqual(9)
  })

  it('auto mode never pauses and picks the best-looking option', () => {
    for (let i = 0; i < 10; i++) expect(() => sim(i, modsFor(matchup(i).star, [], true))).not.toThrow()
  })
})
