import type { League, Player, Team } from '../engine/types'
import { STARTERS } from '../engine/constants'
import type { SortDir } from './tableSort'
import { fullName, money, ovrOf, seasonLine } from './util'

/** A table column that knows how to sort/filter itself. React-free; `DataTable` adds optional custom cells. */
export interface StatCol<T> {
  key: string
  label: string
  title?: string
  align?: 'left' | 'right'
  defaultDir: SortDir
  /** Sortable/filterable value; null means "no data" (shown as —, sorted last, never matches a range). */
  value: (r: T) => number | string | null
  /** Display text; falls back to the value. */
  text?: (r: T) => string
}

export type StatMode = 'pg' | 'tot'

const signed = (v: number, digits: number) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`

/** The full roster column set; stat columns are null for a player with no games. */
export function rosterColumns(league: League, mode: StatMode): StatCol<Player>[] {
  const cache = new Map<string, ReturnType<typeof seasonLine>>()
  const lineOf = (p: Player) => {
    if (!cache.has(p.id)) cache.set(p.id, seasonLine(league, p))
    return cache.get(p.id)!
  }
  const pg = mode === 'pg'
  const digits = pg ? 1 : 0
  const fmt = (v: number) => v.toFixed(digits)
  // gp > 0 guard: a stat line can exist with 0 games only through merged-team edge cases; treat as no data.
  const stat = (get: (s: NonNullable<ReturnType<typeof seasonLine>>['s'], g: number) => number): ((p: Player) => number | null) => (p) => {
    const l = lineOf(p)
    return l && l.s.gp > 0 ? get(l.s, pg ? l.s.gp : 1) : null
  }
  const num = (key: string, label: string, value: (p: Player) => number | null, title?: string, text?: (v: number) => string): StatCol<Player> => ({
    key, label, title, defaultDir: 'desc', value, text: (p) => { const v = value(p); return v === null ? '—' : (text ?? fmt)(v) },
  })
  const pctOf = (m: (s: NonNullable<ReturnType<typeof seasonLine>>['s']) => [number, number]) => (p: Player): number | null => {
    const l = lineOf(p)
    if (!l) return null
    const [made, att] = m(l.s)
    return att > 0 ? (made / att) * 100 : null
  }
  const pctCol = (key: string, label: string, title: string, m: Parameters<typeof pctOf>[0]): StatCol<Player> =>
    num(key, label, pctOf(m), title, (v) => v.toFixed(1))

  return [
    { key: 'player', label: 'Player', align: 'left', defaultDir: 'asc', value: (p) => fullName(p), text: (p) => fullName(p) },
    { key: 'pos', label: 'Pos', align: 'left', defaultDir: 'asc', value: (p) => p.pos },
    { key: 'age', label: 'Age', defaultDir: 'asc', value: (p) => p.age },
    num('ovr', 'OVR', (p) => ovrOf(p), 'Overall rating', (v) => String(v)),
    num('pot', 'POT', (p) => p.pot, 'Potential', (v) => String(v)),
    { key: 'gp', label: 'GP', title: 'Games played', defaultDir: 'desc', value: (p) => lineOf(p)?.s.gp ?? 0 },
    num('min', 'MIN', stat((s, g) => s.min / g), 'Minutes'),
    num('pts', 'PTS', stat((s, g) => s.pts / g), 'Points'),
    num('reb', 'REB', stat((s, g) => (s.oreb + s.dreb) / g), 'Rebounds'),
    num('ast', 'AST', stat((s, g) => s.ast / g), 'Assists'),
    num('stl', 'STL', stat((s, g) => s.stl / g), 'Steals'),
    num('blk', 'BLK', stat((s, g) => s.blk / g), 'Blocks'),
    num('tov', 'TOV', stat((s, g) => s.tov / g), 'Turnovers'),
    num('pf', 'PF', stat((s, g) => s.pf / g), 'Personal fouls'),
    pctCol('fg', 'FG%', 'Field goal %', (s) => [s.fgm, s.fga]),
    pctCol('tp', '3P%', 'Three-point %', (s) => [s.tpm, s.tpa]),
    pctCol('ft', 'FT%', 'Free throw %', (s) => [s.ftm, s.fta]),
    num('pm', '+/-', stat((s, g) => s.pm / g), 'Plus/minus', (v) => signed(v, digits)),
    { key: 'salary', label: 'Salary', defaultDir: 'desc', value: (p) => p.contract?.salary ?? null, text: (p) => (p.contract ? money(p.contract.salary) : '—') },
    { key: 'through', label: 'Through', defaultDir: 'desc', value: (p) => p.contract?.expires ?? null, text: (p) => (p.contract ? `Season ${p.contract.expires}` : '—') },
  ]
}

export interface RosterGroup { label: 'Starters' | 'Bench' | 'Inactive'; rows: Player[] }

/** Starters / Bench / Inactive from the team's rotation. Every player in `players` appears exactly once. */
export function groupRoster(team: Team, players: Player[]): RosterGroup[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const take = (ids: string[]) => ids.flatMap((id) => {
    const p = byId.get(id)
    if (!p || seen.has(id)) return []
    seen.add(id)
    return [p]
  })
  const starters = take(team.rotation.starters)
  const bench = take(team.rotation.bench)
  const inactive = take(team.rotation.inactive)
  const unlisted = players.filter((p) => !seen.has(p.id))

  const groups: RosterGroup[] = starters.length >= STARTERS
    ? [
        { label: 'Starters', rows: starters },
        { label: 'Bench', rows: [...bench, ...unlisted] },
        { label: 'Inactive', rows: inactive },
      ]
    : (() => {
        const byOvr = [...players].sort((a, b) => ovrOf(b) - ovrOf(a))
        return [
          { label: 'Starters' as const, rows: byOvr.slice(0, STARTERS) },
          { label: 'Bench' as const, rows: byOvr.slice(STARTERS) },
        ]
      })()
  return groups.filter((g) => g.rows.length > 0)
}
