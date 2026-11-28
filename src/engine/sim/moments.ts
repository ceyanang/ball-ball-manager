import type { MomentAnswer } from '../career/types'
import type { PlayEvent } from './playlog'
import type { ShotZone } from './game'

export type { MomentAnswer }
export type Look = 'green' | 'yellow' | 'red'
export interface MomentOption { answer: MomentAnswer; label: string; look: Look }
export interface MomentPrompt {
  index: number; period: number
  /** Approximate seconds left in the period. */
  clock: number
  score: { home: number; away: number }
  options: MomentOption[]
  clutch: boolean; rival: boolean
}

/** Thrown out of `simGame` when a "you're open" moment has no answer yet; the driver asks, then re-sims with the answer locked in. */
export class MomentPause extends Error {
  prompt: MomentPrompt
  constructor(prompt: MomentPrompt) {
    super('MomentPause')
    this.name = 'MomentPause'
    this.prompt = prompt
  }
}

/** `GameMods.career`: the followed player, how often he gets the ball in a moment, and the answers locked in so far. */
export interface CareerMods {
  playerId: string
  rate: number
  answers: MomentAnswer[]
  /** Never pause: take the best-looking option at every moment (a simmed game). */
  auto: boolean
  playoffs?: boolean
  /** Watching: filled with the play-log position of each moment (by index), so a replay can pause right there. */
  marks?: number[]
  /** Watching: filled with what he chose at each moment (by index) and the shot that came of it, for the result call. */
  plays?: MomentPlay[]
}

/** What a moment turned into: his choice, who ended up shooting, and from where. */
export interface MomentPlay { kind: MomentAnswer['kind']; shooter: string; zone: ShotZone }

/** The call for how his moment played out, and the last log index it covers (show it once the replay passes there). */
export interface MomentOutcome { text: string; good: boolean; endAt: number }

const MADE: Record<ShotZone, [string, string]> = {
  three: ['💦 SPLASH! drains the three', 'nails it from deep'],
  mid: ['💰 Cash! buries the jumper', 'knocks down the jumper'],
  layup: ['😮‍💨 Smooth — finishes at the rim', 'lays it in'],
  driveDunk: ['💥 THROWS IT DOWN!', 'throws down the dunk'],
  standDunk: ['💥 Rises up and SLAMS it', 'flushes the dunk'],
  close: ['🧈 Soft touch — drops it in', 'scores in close'],
  post: ['🪝 Hook shot — buckets', 'scores in the post'],
}
const MISSED: Record<ShotZone, string> = {
  three: '🧱 BRICK from deep', mid: '🧱 Jumper rims out', layup: '😬 Layup rolls off the rim',
  driveDunk: '😬 Dunk clanks off the back iron', standDunk: '😬 Dunk rattles out', close: '😬 Short one won’t drop', post: '😬 Hook rims out',
}

/**
 * Reads how moment `play` (made at log position `at`) played out: make / miss / block / foul / and-one, plus a dime when
 * he passed and got the assist. `name` gives a player's display name. Null if the log has nothing for it.
 */
export function momentOutcome(log: PlayEvent[], at: number, play: MomentPlay, youId: string, name: (id: string) => string): MomentOutcome | null {
  const first = log[at]
  if (!first || (first.k !== 'fg' && first.k !== 'ft') || first.player !== play.shooter) return null
  const you = play.shooter === youId
  const who = you ? 'You' : name(play.shooter)
  const passed = !you
  const fts = (from: number) => {
    let i = from, made = 0, n = 0
    while (log[i]?.k === 'ft' && (log[i] as { player: string }).player === play.shooter) { n++; if ((log[i] as { made: boolean }).made) made++; i++ }
    return { made, n, end: i - 1 }
  }
  if (first.k === 'ft') {
    const f = fts(at)
    const text = `🚨 ${who} ${you ? 'get' : 'gets'} fouled — ${f.made}/${f.n} at the line`
    return { text: passed ? `🎯 Your pass → ${text.slice(2)}` : text, good: f.made > 0, endAt: f.end }
  }
  let end = at
  if (first.made) {
    const astBy = log[at + 1]?.k === 'ast' ? (log[at + 1] as { player: string }).player : null
    if (astBy) end = at + 1
    const f = fts(end + 1)
    const andOne = f.n > 0 ? ` + AND ONE${f.made ? '' : ' (missed the FT)'}` : ''
    if (f.n > 0) end = f.end
    const [hype, plain] = MADE[play.zone]
    if (passed) {
      const dime = astBy === youId
      return { text: `${dime ? '🎯 WHAT A DIME!' : '👌 Good pass!'} ${who} ${plain}${andOne}${dime ? ' — assist to you' : ''}`, good: true, endAt: end }
    }
    return { text: `${hype}${andOne}`, good: true, endAt: end }
  }
  if (log[at + 1]?.k === 'blk') {
    const by = (log[at + 1] as { player: string }).player
    return { text: `🚫 SWATTED! ${name(by)} blocks ${you ? 'your' : `${who}'s`} shot`, good: false, endAt: at + 1 }
  }
  return { text: passed ? `Your pass → ${who}: ${MISSED[play.zone].replace(/^\S+ /, '').toLowerCase()}` : MISSED[play.zone], good: false, endAt: end }
}

/** Per-attempt chance he gets a moment when he is the selected shooter (tuned for about 3–6 a game). */
export const DEFAULT_MOMENT_RATE = 0.3
/** Make-probability cut-offs for the colour descriptors (monotonic). */
export const LOOK_CUTOFF = { green: 0.58, yellow: 0.46 }

export const lookFor = (p: number): Look => (p >= LOOK_CUTOFF.green ? 'green' : p >= LOOK_CUTOFF.yellow ? 'yellow' : 'red')
export const LOOK_RANK: Record<Look, number> = { red: 0, yellow: 1, green: 2 }

/** The best-looking option; ties go to the earliest (the plain shot). */
export function bestOption(options: MomentOption[]): MomentOption {
  return options.reduce((a, b) => (LOOK_RANK[b.look] > LOOK_RANK[a.look] ? b : a))
}

/** Deterministic trigger from (game seed, possession, attempt) — never touches the sim's Rng. */
export function momentTriggers(seed: number, possNo: number, attempt: number, rate: number): boolean {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (const v of [possNo, attempt, 0x51ed270b]) {
    h = Math.imul(h ^ (v >>> 0), 0x85ebca6b) >>> 0
    h = (h ^ (h >>> 13)) >>> 0
    h = Math.imul(h, 0xc2b2ae35) >>> 0
    h = (h ^ (h >>> 16)) >>> 0
  }
  return h / 4294967296 < rate
}
