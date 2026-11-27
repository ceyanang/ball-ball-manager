import type { MomentAnswer } from '../career/types'

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
