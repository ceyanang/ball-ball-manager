import type { Ratings } from '../types'

export type CareerStatus = 'building' | 'draftNight' | 'active' | 'retired'
/** One answer to an in-game "you're open" moment. */
export type MomentAnswer = { kind: 'shoot' } | { kind: 'pass'; to: string } | { kind: 'drive' }
/** `floor` is 40 for builds made on (or migrated to) the 40 rating floor; missing on older 25-floor saves. */
export interface CareerBuild { max: Ratings; startFraction: number; startProgress: number; archetype: string; floor?: number }
export interface GrowthEntry { season: number; day: number; key: keyof Ratings; delta: number; source: string }
/** The game being played right now: saved so a reload asks the same moment again (Task 7 fills `rngState`). */
export interface PendingGame { gameId: string; answers: MomentAnswer[]; rngState?: number }
export interface CareerOffer { teamId: string; salary: number; years: number; note: string }
/** A big move that should pop up over everything until he dismisses it. */
export interface CareerAlert { kind: 'trade' | 'cut'; title: string; lines: string[]; fromTeamId: string; toTeamId: string | null; season: number; day: number }
export interface CareerState {
  playerId: string; status: CareerStatus; build: CareerBuild
  draftTags: string[]; draftAnswers: number[]
  /** Game counts used for the reward share (played = full, simmed = half). */
  played: number; simmed: number
  growth: GrowthEntry[]; log: { season: number; text: string }[]
  pending: PendingGame | null
  /** A contract decision waiting on him (expiry, a cut): the calendar and the offseason stop until he picks. */
  offers?: CareerOffer[] | null
  /** A retirement prompt waiting on him (suggested: he may refuse; forced: he may not). */
  retirement?: { kind: 'suggest' | 'forced'; text: string } | null
  /** How many times he has refused to retire. */
  refusals?: number
  /** He suffered a season-ending injury this season (the summer heals `injury`, so the prompt reads this). */
  seasonInjury?: boolean
  /** He walked away by choice (not because the prompt forced it). */
  retiredEarly?: boolean
  /** The latest trade/cut, shown as a pop-up until dismissed. */
  alert?: CareerAlert | null
  ending: { id: string; title: string; lines: string[] } | null
}
