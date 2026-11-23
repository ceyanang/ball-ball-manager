export type Side = 'home' | 'away'
interface Base { period: number; t: number }

/** One countable action in a game; `t` is the fraction (0–1) through its period (periodEnd uses 1). */
export type PlayEvent = Base & (
  | { k: 'fg'; side: Side; player: string; made: boolean; three: boolean; home: number; away: number }
  | { k: 'ft'; side: Side; player: string; made: boolean; home: number; away: number }
  | { k: 'reb'; side: Side; player: string; off: boolean }
  | { k: 'ast'; side: Side; player: string }
  | { k: 'stl'; side: Side; player: string }
  | { k: 'blk'; side: Side; player: string }
  | { k: 'tov'; side: Side; player: string }
  /** Opening five (slot order PG, SG, SF, PF, C) for each side, logged at the start of period 1. */
  | { k: 'lineup'; side: Side; players: string[] }
  /** A coach's swap: `in` replaces `out` in lineup slot `slot`. */
  | { k: 'sub'; side: Side; out: string; in: string; slot: number }
  | { k: 'periodEnd'; min: Record<string, number>; pm: Record<string, number> })

export interface LogBoxLine {
  pts: number; oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number
}

const blank = (): LogBoxLine => ({ pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 })

/** Rebuild the countable box-score columns from a play log. */
export function boxFromLog(log: PlayEvent[]): Record<string, LogBoxLine> {
  const box: Record<string, LogBoxLine> = {}
  for (const e of log) {
    if (e.k === 'periodEnd' || e.k === 'lineup' || e.k === 'sub') continue
    const b = (box[e.player] ??= blank())
    if (e.k === 'fg') {
      b.fga++
      if (e.three) b.tpa++
      if (e.made) {
        b.fgm++
        b.pts += e.three ? 3 : 2
        if (e.three) b.tpm++
      }
    } else if (e.k === 'ft') {
      b.fta++
      if (e.made) { b.ftm++; b.pts++ }
    } else if (e.k === 'reb') b[e.off ? 'oreb' : 'dreb']++
    else b[e.k]++
  }
  return box
}

/** Per-period scores, from the running score recorded on each fg/ft. */
export function quartersFromLog(log: PlayEvent[]): { home: number[]; away: number[] } {
  const home: number[] = [], away: number[] = []
  let h = 0, a = 0
  for (const e of log) {
    if (e.k === 'fg' || e.k === 'ft') { h = e.home; a = e.away }
    else if (e.k === 'periodEnd') {
      home.push(h - home.reduce((s, x) => s + x, 0))
      away.push(a - away.reduce((s, x) => s + x, 0))
    }
  }
  return { home, away }
}
