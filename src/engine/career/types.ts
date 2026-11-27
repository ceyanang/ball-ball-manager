import type { Ratings } from '../types'

export type CareerStatus = 'building' | 'draftNight' | 'active' | 'retired'
/** One answer to an in-game "you're open" moment. */
export type MomentAnswer = { kind: 'shoot' } | { kind: 'pass'; to: string } | { kind: 'drive' }
export interface CareerBuild { max: Ratings; startFraction: number; startProgress: number; archetype: string }
export interface GrowthEntry { season: number; day: number; key: keyof Ratings; delta: number; source: string }
/** The game being played right now: saved so a reload asks the same moment again (Task 7 fills `rngState`). */
export interface PendingGame { gameId: string; answers: MomentAnswer[]; rngState?: number }
export interface CareerState {
  playerId: string; status: CareerStatus; build: CareerBuild
  draftTags: string[]; draftAnswers: number[]
  /** Game counts used for the reward share (played = full, simmed = half). */
  played: number; simmed: number
  growth: GrowthEntry[]; log: { season: number; text: string }[]
  pending: PendingGame | null
  ending: { id: string; title: string; lines: string[] } | null
}
