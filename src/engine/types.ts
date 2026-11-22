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
export interface League {
  version: 2; name: string; seed: number; rng: { s: number }; season: number; phase: Phase; day: number
  userTeamId: string; teams: Record<string, Team>; players: Record<string, Player>; coaches: Record<string, Coach>
  games: Game[]; statLines: Record<string, StatLine>; playoffs: PlayoffBracket | null
  progress: ProgressEvent[]
}
