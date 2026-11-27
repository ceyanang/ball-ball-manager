import type { Game, League, Player } from '../types'
import type { Effect } from './effects'
import type { Subjects } from './state'

export type EventWhen = 'preGame' | 'postGame' | 'day'

export interface EventCtx {
  l: League
  when: EventWhen
  game: Game | null
  /** postGame only: how the user's game went. */
  userGame: { won: boolean; margin: number } | null
  /** The user's roster, healthy players first, best OVR first. */
  roster: Player[]
}

export interface OutcomeDef {
  weight: number
  tone: 'good' | 'bad' | 'neutral'
  text(s: Subjects, l: League): string
  effects(s: Subjects, l: League): Effect[]
}
export interface ChoiceDef { label: string; emoji?: string; outcomes: OutcomeDef[] }

export interface EventDef {
  id: string
  when: EventWhen
  /** Relative frequency among eligible events. */
  weight: number
  cooldownDays?: number
  /** A player asking for something (used for labelling). */
  kind?: 'request'
  playoffsOnly?: boolean
  /** MyCareer events only roll in career leagues (and normal events never do). */
  career?: boolean
  /** Picks who the event is about, or null when it can't fire right now. */
  pick(ctx: EventCtx): Subjects | null
  emoji: string
  title(s: Subjects, l: League): string
  text(s: Subjects, l: League): string
  /** 2–3 choices. */
  choices: ChoiceDef[]
}
