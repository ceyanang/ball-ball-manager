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

/** Hot-streak callout: he has passed his season average (and at least 10 points). */
export const beatsAverage = (pts: number, ppg: number | null) => ppg !== null && pts >= 10 && pts > ppg

/** Game clock left in the period: 12:00 per quarter, 5:00 per OT. */
export function clockText(period: number, t: number): string {
  const secs = Math.ceil((1 - Math.min(1, Math.max(0, t))) * (period <= 4 ? 720 : 300) - 1e-9)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/**
 * Feed line for the newest play in a batch of fired events. A shot, a free-throw trip or a turnover starts a play;
 * assists, blocks, rebounds and steals (and an and-one free throw) attach to it.
 */
export function describePlays(events: PlayEvent[], last: (id: string) => string): string | null {
  type Play = { head: PlayEvent; ast?: string; blk?: string; reb?: { id: string; off: boolean }; stl?: string; ft: { m: number; a: number; who: string } | null }
  let cur: Play | null = null
  for (const e of events) {
    if (e.k === 'periodEnd') continue
    if (e.k === 'fg' || e.k === 'tov') cur = { head: e, ft: null }
    else if (e.k === 'ft') {
      const andOne = cur?.head.k === 'fg' && cur.head.made && cur.head.player === e.player && !cur.reb
      const sameTrip = cur?.head.k === 'ft' && cur.head.player === e.player && !cur.reb
      if (!cur || !(andOne || sameTrip)) cur = { head: e, ft: { m: 0, a: 0, who: e.player } }
      cur.ft ??= { m: 0, a: 0, who: e.player }
      cur.ft.a++
      if (e.made) cur.ft.m++
    } else {
      cur ??= { head: e, ft: null }
      if (e.k === 'ast') cur.ast = e.player
      else if (e.k === 'blk') cur.blk = e.player
      else if (e.k === 'stl') cur.stl = e.player
      else if (e.k === 'reb') cur.reb = { id: e.player, off: e.off }
    }
  }
  if (!cur) return null
  const { head } = cur
  const line = (ft: Play['ft']) => `🎯 ${last(ft!.who)} at the line: ${ft!.m}/${ft!.a}`
  const reb = cur.reb ? ` · ${last(cur.reb.id)} ${cur.reb.off ? 'grabs the offensive board' : 'with the board'}` : ''
  switch (head.k) {
    case 'fg':
      if (head.made) return `${last(head.player)} ${head.three ? 'from deep' : 'scores'}${cur.ast ? ` · dime from ${last(cur.ast)}` : ''}${cur.ft ? ` · and one! ${line(cur.ft)}` : ''}`
      if (cur.blk) return `🚫 BLK! ${last(cur.blk)} swats ${last(head.player)}${reb}`
      return `${last(head.player)} misses${head.three ? ' from three' : ''}${reb}`
    case 'ft': return `${line(cur.ft)}${reb}`
    case 'tov': return cur.stl ? `${last(cur.stl)} picks ${last(head.player)}'s pocket` : `${last(head.player)} turns it over`
    case 'reb': return `${last(head.player)} ${head.off ? 'grabs the offensive board' : 'with the board'}`
    default: return null
  }
}
