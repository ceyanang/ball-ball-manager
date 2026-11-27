import { stepDay, type Capture, type WatchCapture } from '../season/advance'
import { Rng } from '../rng'
import { MomentPause, type MomentAnswer, type MomentPrompt } from '../sim/moments'
import type { Game, League } from '../types'

export type { PendingGame } from './types'
/**
 * `watch` (only when asked for): his game's play log. On a moment it is a preview — the rest of the game played out
 * with the best-looking option — whose events up to `watch.moments[prompt.index]` are exactly what really happened,
 * so a replay can run up to there and pause; `preview` is that preview's game (for the box/lineups while paused).
 */
export type DayResult =
  | { kind: 'done'; league: League; watch?: WatchCapture | null }
  | { kind: 'moment'; league: League; prompt: MomentPrompt; watch?: WatchCapture | null; preview?: Game }

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
export function careerPlayDay(l: League, mode: 'play' | 'sim', answer?: MomentAnswer, opts: { pauseForEvents?: boolean; watch?: boolean } = {}): DayResult {
  const base = structuredClone(l)
  if (base.phase === 'offseason') return { kind: 'done', league: base }
  const c = base.career
  const game = followedGame(base)
  const p = c ? base.players[c.playerId] : null
  const asking = mode === 'play' && !!c && c.status === 'active' && !!game && !!p && !p.injury
  const capture = (): Capture | undefined => (opts.watch ? { teamId: base.userTeamId, out: null } : undefined)

  if (!asking) {
    if (c) c.pending = null
    const cap = capture()
    stepDay(base, new Rng(base.rng), cap, opts.pauseForEvents, true)
    return { kind: 'done', league: base, ...(cap && { watch: cap.out }) }
  }

  let pend = c!.pending
  if (!pend || pend.gameId !== game!.id || pend.rngState !== base.rng.s) pend = { gameId: game!.id, answers: [], rngState: base.rng.s }
  pend = { ...pend, answers: answer ? [...pend.answers, answer] : pend.answers }
  c!.pending = pend

  const attempt = structuredClone(base)
  const cap = capture()
  try {
    stepDay(attempt, new Rng(attempt.rng), cap, opts.pauseForEvents, false)
  } catch (e) {
    if (!(e instanceof MomentPause)) throw e
    if (!opts.watch) return { kind: 'moment', league: base, prompt: e.prompt }
    // Same day, same seed, answers so far locked in, the rest auto-picked: identical up to this moment.
    const preview = structuredClone(base)
    const pc = capture()!
    stepDay(preview, new Rng(preview.rng), pc, opts.pauseForEvents, true)
    return { kind: 'moment', league: base, prompt: e.prompt, watch: pc.out, preview: preview.games.find((g) => g.id === game!.id) }
  }
  if (attempt.career) attempt.career.pending = null
  return { kind: 'done', league: attempt, ...(cap && { watch: cap.out }) }
}
