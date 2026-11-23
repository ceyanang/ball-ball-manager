import type { PlayEvent } from '../../engine/sim/playlog'

export const QUARTER_MS = 15000
/** Wall-clock length of a period in the replay (OT is a 5-minute period vs 12). */
export const periodMs = (period: number) => period <= 4 ? QUARTER_MS : QUARTER_MS * 5 / 12
export const periodLabel = (period: number) => period <= 4 ? `Q${period}` : period === 5 ? 'OT' : `${period - 4}OT`

export interface LiveLine {
  pts: number; reb: number; oreb: number; dreb: number; ast: number; stl: number; blk: number; tov: number
  fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number
  byPeriod: number[]
  min: number; pm: number
}
export interface ReplayState { cursor: number; period: number; home: number; away: number; lines: Record<string, LiveLine> }

const blank = (): LiveLine => ({
  pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
  fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, byPeriod: [], min: 0, pm: 0,
})

export function periodCount(log: PlayEvent[]): number {
  return log.reduce((m, e) => Math.max(m, e.period), 0)
}

export const initState = (): ReplayState => ({ cursor: 0, period: 1, home: 0, away: 0, lines: {} })

function addPoints(l: LiveLine, period: number, n: number) {
  l.pts += n
  while (l.byPeriod.length < period) l.byPeriod.push(0)
  l.byPeriod[period - 1] += n
}

function apply(lines: Record<string, LiveLine>, e: PlayEvent) {
  const line = (id: string) => (lines[id] = lines[id] ? { ...lines[id], byPeriod: [...lines[id].byPeriod] } : blank())
  switch (e.k) {
    case 'fg': {
      const l = line(e.player)
      l.fga++
      if (e.three) l.tpa++
      if (e.made) {
        l.fgm++
        if (e.three) l.tpm++
        addPoints(l, e.period, e.three ? 3 : 2)
      }
      break
    }
    case 'ft': {
      const l = line(e.player)
      l.fta++
      if (e.made) { l.ftm++; addPoints(l, e.period, 1) }
      break
    }
    case 'reb': {
      const l = line(e.player)
      l.reb++
      l[e.off ? 'oreb' : 'dreb']++
      break
    }
    case 'periodEnd':
      for (const id of new Set([...Object.keys(e.min), ...Object.keys(e.pm)])) {
        const l = line(id)
        l.min = e.min[id] ?? l.min
        l.pm = e.pm[id] ?? l.pm
      }
      break
    default:
      line(e.player)[e.k]++
  }
}

/** Apply every not-yet-applied event with (period, t) <= target; t = 1 includes that period's periodEnd. Never mutates `s`. */
export function advanceTo(log: PlayEvent[], s: ReplayState, period: number, t: number): { state: ReplayState; fired: PlayEvent[] } {
  let i = s.cursor
  const lines = { ...s.lines }
  let { home, away, period: cur } = s
  const fired: PlayEvent[] = []
  while (i < log.length) {
    const e = log[i]
    if (e.period > period || (e.period === period && e.t > t)) break
    apply(lines, e)
    if (e.k === 'fg' || e.k === 'ft') { home = e.home; away = e.away }
    cur = Math.max(cur, e.period)
    fired.push(e)
    i++
  }
  if (!fired.length) return { state: s, fired }
  return { state: { cursor: i, period: cur, home, away, lines }, fired }
}

export function finalState(log: PlayEvent[]): ReplayState {
  return advanceTo(log, initState(), periodCount(log) || 1, 1).state
}

/** Sum of the given players' live lines (byPeriod element-wise). */
export function benchLine(state: ReplayState, ids: string[]): LiveLine {
  const out = blank()
  for (const id of ids) {
    const l = state.lines[id]
    if (!l) continue
    for (const k of Object.keys(out) as (keyof LiveLine)[]) {
      if (k === 'byPeriod') l.byPeriod.forEach((v, i) => { out.byPeriod[i] = (out.byPeriod[i] ?? 0) + v })
      else (out[k] as number) += l[k] as number
    }
  }
  return out
}

/** Fraction of regulation (48 min) elapsed; OT periods are 5 minutes. */
export function elapsedFraction(period: number, t: number): number {
  const done = Math.min(period - 1, 4) * 12 + Math.max(period - 5, 0) * 5
  return (done + t * (period <= 4 ? 12 : 5)) / 48
}

export const isHot = (pts: number, ppg: number | null, frac: number) =>
  ppg !== null && pts >= 10 && pts - ppg * frac >= 8

export const onPace = (pts: number, frac: number) => frac === 0 ? 0 : Math.round(pts / frac)

export function standout(state: ReplayState, ppg: Record<string, number | null>, frac: number, ids: string[]): string | null {
  let best: string | null = null, bestScore = -Infinity
  for (const id of ids) {
    const score = (state.lines[id]?.pts ?? 0) - (ppg[id] ?? 0) * frac
    if (score > bestScore) { best = id; bestScore = score }
  }
  return best
}
