import type { WatchCapture } from '../engine/season/advance'
import type { MomentAnswer, MomentPrompt } from '../engine/sim/moments'
import type { Game, League } from '../engine/types'
import type { SimCommand, SimResponse } from './protocol'

let worker: Worker | null = null
let nextId = 1
type Reply = { league: League; watch: WatchCapture | null; moment: MomentPrompt | null; preview: Game | null }
const pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<SimResponse>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if ('error' in e.data) p.reject(new Error(e.data.error))
    else p.resolve({ league: e.data.league, watch: e.data.watch ?? null, moment: e.data.moment ?? null, preview: e.data.preview ?? null })
  }
  const fail = (msg: string) => {
    for (const p of pending.values()) p.reject(new Error(msg))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  worker.onerror = (e: ErrorEvent | { message?: string }) => fail(`The simulator crashed (${e.message ?? 'unknown error'}). Try again.`)
  worker.onmessageerror = () => fail('The simulator sent back data the app couldn’t read. Try again.')
  return worker
}

function request(league: League, cmd: SimCommand): Promise<Reply> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, cmd, league })
  })
}

export function runSim(league: League, cmd: SimCommand): Promise<League> {
  return request(league, cmd).then((r) => r.league)
}

/** Plays one day and returns the user's game as a play log (null on an off day). */
export function runWatch(league: League): Promise<{ league: League; watch: WatchCapture | null }> {
  return request(league, { type: 'watchDay' }).then(({ league: next, watch }) => ({ league: next, watch }))
}

/** MyCareer: the whole offseason in one go (it stops for a contract choice). */
export function runCareerOffseason(league: League): Promise<League> {
  return request(league, { type: 'careerOffseason' }).then((r) => r.league)
}

/** MyCareer: plays or sims one day; a returned `moment` means the game is paused waiting for an answer. */
export function runCareerDay(league: League, cmd: { mode: 'play' | 'sim' } | { answer: MomentAnswer }): Promise<{ league: League; moment: MomentPrompt | null }> {
  return request(league, 'answer' in cmd ? { type: 'careerAnswer', answer: cmd.answer } : { type: 'careerDay', mode: cmd.mode }).then(({ league: next, moment }) => ({ league: next, moment }))
}

/**
 * MyCareer, watched live: plays today (or locks in `answer` and re-runs it) and returns his game's play log. With a
 * `moment`, the game is paused: the log is a preview that is exact up to `watch.moments[moment.index]`.
 */
export function runCareerWatch(league: League, cmd: { mode: 'play' } | { answer: MomentAnswer }): Promise<Reply> {
  return request(league, 'answer' in cmd ? { type: 'careerAnswer', answer: cmd.answer, watch: true } : { type: 'careerDay', mode: 'play', watch: true })
}
