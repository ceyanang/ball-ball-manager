export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'
export type Conference = 'East' | 'West'
export type CoachStyle = 'pace' | 'three' | 'defense' | 'balanced'
export type Phase = 'regular' | 'playoffs' | 'offseason'

export interface Ratings {
  ins: number; mid: number; three: number; ft: number; pass: number; handle: number; oreb: number
  perD: number; intD: number; stl: number; blk: number; dreb: number; ath: number; stam: number; iq: number
}
export interface Contract { salary: number; expires: number }
export interface Injury { type: string; gamesRemaining: number; severity: 'dtd' | 'short' | 'long' | 'season' }
export interface DraftInfo { season: number; round: number; pick: number; teamId: string }
export interface Player {
  id: string; firstName: string; lastName: string; age: number; heightIn: number; pos: Position
  jersey: number; hometown: string; college: string; ratings: Ratings; pot: number; faceSeed: number
  teamId: string | null; contract: Contract | null; injury: Injury | null; morale: number; draft: DraftInfo | null
  ratingHistory: { season: number; ovr: number }[]
  /** Set once a player hangs it up; retired players stay in the save for history. */
  retired?: boolean
}
/** Every rostered player id appears exactly once across the three lists. */
export interface Rotation { starters: string[]; bench: string[]; inactive: string[] }
export interface Team {
  id: string; city: string; name: string; abbrev: string; conf: Conference
  colors: { primary: string; secondary: string }; coachId: string; rotation: Rotation
}
export interface Coach {
  id: string; firstName: string; lastName: string; faceSeed: number; age: number
  style: CoachStyle; dev: number; teamId: string | null; wins: number; losses: number
}
export interface BoxLine {
  playerId: string; teamId: string; gs: boolean; min: number; pts: number; oreb: number; dreb: number
  ast: number; stl: number; blk: number; tov: number; pf: number; fgm: number; fga: number; tpm: number; tpa: number
  ftm: number; fta: number; pm: number
}
export interface GameResult {
  homeScore: number; awayScore: number; quarters: { home: number[]; away: number[] }
  ot: number; box: BoxLine[]; potg: string
}
export interface Game {
  id: string; season: number; day: number; homeId: string; awayId: string
  playoff: { round: number; seriesId: string; gameNum: number } | null; result: GameResult | null
}
export interface StatLine extends Omit<BoxLine, 'pm' | 'gs'> {
  season: number; playoffs: boolean; gp: number; gs: number; pm: number
}
export interface Series {
  id: string; round: number; conf: Conference | null; highSeedId: string; lowSeedId: string
  highSeed: number; lowSeed: number; highWins: number; lowWins: number; bestOf: 5 | 7; winnerId: string | null
}
export interface PlayoffBracket { season: number; series: Series[]; championId: string | null }
export interface ProgressEvent { season: number; day: number; playerId: string; teamId: string; from: number; to: number }
export interface DraftPick { id: string; season: number; round: 1 | 2; originalTeamId: string; ownerId: string }
export type TxType = 'trade' | 'sign' | 'resign' | 'release' | 'claim' | 'draft' | 'retire' | 'fire' | 'hire'
export interface Transaction { season: number; day: number; phase: Phase; type: TxType; teamIds: string[]; playerIds: string[]; text: string }
export interface DeadMoney { teamId: string; playerId: string; salary: number; expires: number }
export interface Waiver { playerId: string; fromTeamId: string; contract: Contract }
export interface FaOffer { playerId: string; teamId: string; salary: number; years: number }
export interface DraftSlot { pick: number; round: 1 | 2; teamId: string; pickId: string; playerId: string | null }
export interface LotteryEntry { teamId: string; odds: number; preSlot: number; pick: number }
export interface DraftState {
  season: number; prospects: string[]; lottery: LotteryEntry[]; order: DraftSlot[]
  /** Hidden scouting noise per prospect: shown OVR is a range around the truth, POT a fuzzy grade. */
  scout: Record<string, { ovrLo: number; ovrHi: number; pot: number }>
}
export type OffseasonStep = 'recap' | 'lottery' | 'draft' | 'resign' | 'freeAgency' | 'ready'
export interface OffseasonReport {
  retired: { playerId: string; teamId: string | null; age: number; ovr: number }[]
  changes: { playerId: string; teamId: string | null; from: number; to: number }[]
  coaching: { teamId: string; firedId: string | null; hiredId: string }[]
}
export interface OffseasonState {
  step: OffseasonStep; faDay: number; report: OffseasonReport
  /** Rejected re-sign offers per player; at 3 he walks. */
  resignTries: Record<string, number>
}
export interface League {
  version: 3; name: string; seed: number; rng: { s: number }; season: number; phase: Phase; day: number
  userTeamId: string; teams: Record<string, Team>; players: Record<string, Player>; coaches: Record<string, Coach>
  games: Game[]; statLines: Record<string, StatLine>; playoffs: PlayoffBracket | null
  progress: ProgressEvent[]
  picks: DraftPick[]; draft: DraftState | null
  /** Drafted but unsigned players: playerId → teamId. */
  draftRights: Record<string, string>
  transactions: Transaction[]; deadMoney: DeadMoney[]; waivers: Waiver[]; faOffers: FaOffer[]
  offseason: OffseasonState | null
  tradeDeadlineDay: number
}
