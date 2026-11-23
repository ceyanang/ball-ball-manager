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
  /** Go-ahead score for the winner in the final minute of the last period (buzzer: on the final possession). */
  clutch?: { playerId: string; buzzer: boolean } | null
  /** The winner's largest deficit during the game. */
  comeback?: number
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
export type OffseasonStep = 'awards' | 'recap' | 'lottery' | 'draft' | 'resign' | 'freeAgency' | 'ready'
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
export type TradeAsset = { kind: 'player'; id: string } | { kind: 'pick'; id: string }

export type NewsKind =
  | 'bigGame' | 'tripleDouble' | 'nearTriple' | 'gameWinner' | 'rookie' | 'careerHigh' | 'record' | 'streak'
  | 'comeback' | 'overtime' | 'injury' | 'series' | 'champion' | 'award' | 'hof'
export interface NewsItem {
  id: string; season: number; day: number; playoffs: boolean; kind: NewsKind; emoji: string; title: string; text: string
  playerIds: string[]; teamIds: string[]; gameId?: string; weight: number
}
export type PersonaId = 'insider' | 'stats' | 'hater' | 'superfan'
export type PostAuthor =
  | { kind: 'fan'; handle: string; name: string; seed: number; teamId: string | null }
  | { kind: 'persona'; id: PersonaId }
  | { kind: 'player'; playerId: string }
export interface Post {
  id: string; season: number; day: number; author: PostAuthor; text: string; likes: number; reposts: number
  playerIds: string[]; teamIds: string[]; gameId?: string; tone: 'hype' | 'roast' | 'neutral'
}
export type InboxKind = 'trade' | 'coach' | 'contract' | 'morale' | 'tradeRequest' | 'roster' | 'freeAgent' | 'expiring' | 'injury' | 'award'
export interface TradeOffer { teamId: string; theyGive: TradeAsset[]; youGive: TradeAsset[]; status: 'open' | 'accepted' | 'declined' | 'expired' }
export interface InboxItem {
  id: string; season: number; day: number; phase: Phase; kind: InboxKind
  /** Dedupe key: the same key is never pinged twice. */
  key: string; title: string; body: string; link?: string; read: boolean; dismissed: boolean; offer?: TradeOffer
}
export type RecordStat = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tpm'
export type RecordScope = 'game' | 'season' | 'career'
export interface RecordHolder { value: number; playerId: string; teamId: string; season: number; gameId?: string }
export interface RecordEntry extends RecordHolder { prev: RecordHolder | null }
export type RecordBook = Record<RecordScope, Partial<Record<RecordStat, RecordEntry>>>
export interface Records { league: RecordBook; teams: Record<string, RecordBook> }
export interface SeasonAwards {
  season: number; championId: string | null; championRoster: string[]
  mvp: string | null; dpoy: string | null; roy: string | null; smoy: string | null; mip: string | null
  coy: { coachId: string; teamId: string } | null; finalsMvp: string | null
  allLeague: string[][]; allDefense: string[][]; allRookie: string[]
}
export interface SeasonHistory {
  season: number; championId: string | null; runnerUpId: string | null; finals: string
  standings: { teamId: string; w: number; l: number; conf: Conference }[]
  leaders: { stat: string; playerId: string; teamId: string; value: number }[]
}
export interface HofEntry { playerId: string; season: number; score: number }
export interface CareerHigh { gp: number; pts: number; reb: number; ast: number }

export interface League {
  version: 4; name: string; seed: number; rng: { s: number }; season: number; phase: Phase; day: number
  userTeamId: string; teams: Record<string, Team>; players: Record<string, Player>; coaches: Record<string, Coach>
  games: Game[]; statLines: Record<string, StatLine>; playoffs: PlayoffBracket | null
  progress: ProgressEvent[]
  picks: DraftPick[]; draft: DraftState | null
  /** Drafted but unsigned players: playerId → teamId. */
  draftRights: Record<string, string>
  transactions: Transaction[]; deadMoney: DeadMoney[]; waivers: Waiver[]; faOffers: FaOffer[]
  offseason: OffseasonState | null
  tradeDeadlineDay: number
  news: NewsItem[]; social: Post[]; inbox: InboxItem[]
  awards: SeasonAwards[]; history: SeasonHistory[]; records: Records; hof: HofEntry[]
  /** Fan sentiment, −100..100. */
  fans: { players: Record<string, number>; teams: Record<string, number> }
  careerHighs: Record<string, CareerHigh>
  /** Counter for story ids. */
  storySeq: number
}
