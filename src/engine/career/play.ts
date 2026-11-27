import { stepDay } from '../season/advance'
import { Rng } from '../rng'
import { MomentPause, type MomentAnswer, type MomentPrompt } from '../sim/moments'
import type { Game, League } from '../types'

export type { PendingGame } from './types'
export type DayResult = { kind: 'done'; league: League } | { kind: 'moment'; league: League; prompt: MomentPrompt }

/** The followed player's own game today, if he is signed and his team plays. */
function followedGame(l: League): Game | undefined {
  const p = l.career ? l.players[l.career.playerId] : null
  if (!p?.teamId) return undefined
  return l.games.find((g) => g.day === l.day && !g.result && (l.phase === 'playoffs') === (g.playoff !== null) && (g.homeId === p.teamId || g.awayId === p.teamId))
}

/**
 * One calendar day. `sim` never asks. `play` stops at each "you're open" moment: the returned league carries
 * `career.pending` (the game and the answers so far) and is otherwise untouched, so asking again — even after a
 * reload — replays the same day from the same seed and reaches the same moment. Pass the user's `answer` to lock it in.
 */
export function careerPlayDay(l: League, mode: 'play' | 'sim', answer?: MomentAnswer, opts: { pauseForEvents?: boolean } = {}): DayResult {
  const base = structuredClone(l)
  if (base.phase === 'offseason') return { kind: 'done', league: base }
  const c = base.career
  const game = followedGame(base)
  const p = c ? base.players[c.playerId] : null
  const asking = mode === 'play' && !!c && c.status === 'active' && !!game && !!p && !p.injury

  if (!asking) {
    if (c) c.pending = null
    stepDay(base, new Rng(base.rng), undefined, opts.pauseForEvents, true)
    return { kind: 'done', league: base }
  }

  let pend = c!.pending
  if (!pend || pend.gameId !== game!.id || pend.rngState !== base.rng.s) pend = { gameId: game!.id, answers: [], rngState: base.rng.s }
  pend = { ...pend, answers: answer ? [...pend.answers, answer] : pend.answers }
  c!.pending = pend

  const attempt = structuredClone(base)
  try {
    stepDay(attempt, new Rng(attempt.rng), undefined, opts.pauseForEvents, false)
  } catch (e) {
    if (e instanceof MomentPause) return { kind: 'moment', league: base, prompt: e.prompt }
    throw e
  }
  if (attempt.career) attempt.career.pending = null
  return { kind: 'done', league: attempt }
}
