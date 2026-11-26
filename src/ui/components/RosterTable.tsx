import { useMemo, useState } from 'react'
import { archetypeFor } from '../../engine/player/archetype'
import type { League, Player, Team } from '../../engine/types'
import { groupRoster, rosterColumns, type StatMode } from '../rosterColumns'
import { fullName, money, ovrOf, seasonLine } from '../util'
import { DataTable, type Column } from './DataTable'
import { OvrPill } from './OvrPill'
import { PlayerCell } from './PlayerCell'

export type RosterView = 'key' | 'all'

const KEY_COLS = new Set(['player', 'ovr', 'min', 'pts', 'reb', 'ast'])
const PG_LABEL: Record<string, [string, string]> = {
  min: ['MPG', 'Minutes per game'],
  pts: ['PPG', 'Points per game'],
  reb: ['RPG', 'Rebounds per game'],
  ast: ['APG', 'Assists per game'],
}
const MOBILE_KEYS = new Set(['ovr', 'min', 'pts', 'reb', 'ast'])

/**
 * A team's roster: Starters/Bench groups by default, every stat sortable, filterable by position, name or stat range.
 * Defaults to a clean overview (Player, OVR, MPG, PPG, RPG, APG) with a view dropdown and per-player expandable
 * full stats so the viewer stays readable instead of dumping 20 columns at once.
 * `compact` is the peek-sheet mode: filters tucked away and names are plain text, so tapping one can't navigate away
 * from (and lose) an in-progress trade.
 */
export function RosterTable({ league, team, players, mode: initial = 'pg', view: initialView = 'key', compact }: {
  league: League; team: Team; players: Player[]; mode?: StatMode; view?: RosterView; compact?: boolean
}) {
  const [mode, setMode] = useState<StatMode>(initial)
  const [view, setView] = useState<RosterView>(initialView)
  const [openId, setOpenId] = useState<string | null>(null)

  const allCols = useMemo(() => rosterColumns(league, mode), [league, mode])
  const columns = useMemo<Column<Player>[]>(() => {
    const base = view === 'all' ? allCols : allCols.filter((c) => KEY_COLS.has(c.key))
    const mapped = base.map<Column<Player>>((c) => {
      if (c.key === 'player') {
        return {
          ...c,
          mobile: 'main',
          cell: (p: Player) => (
            <PlayerCell
              league={league}
              p={p}
              subtitle={view === 'key' ? `${p.pos} · ${p.age}y · ${archetypeFor(p)}` : archetypeFor(p)}
              plain={compact}
            />
          ),
        }
      }
      if (c.key === 'ovr') return { ...c, mobile: 'key', cell: (p: Player) => <OvrPill value={ovrOf(p)} /> }
      if (view === 'key' && mode === 'pg' && PG_LABEL[c.key]) {
        const [label, title] = PG_LABEL[c.key]
        return { ...c, label, title, mobile: 'key' }
      }
      if (MOBILE_KEYS.has(c.key)) return { ...c, mobile: 'key' }
      return c
    })
    if (view === 'key') {
      mapped.push({
        key: 'more',
        label: '',
        defaultDir: 'asc',
        sortable: false,
        mobile: 'act',
        value: () => null,
        cell: (p: Player) => (
          <button
            className="btn rt-more-btn"
            aria-expanded={openId === p.id}
            onClick={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
          >
            {openId === p.id ? 'Hide' : 'All stats'}
          </button>
        ),
      })
    }
    return mapped
  }, [allCols, view, league, compact, mode, openId])

  const groups = useMemo(() => groupRoster(team, players), [team, players])
  const detailOf = (p: Player) => {
    if (view !== 'key' || openId !== p.id) return null
    const line = seasonLine(league, p)
    const pg = line?.pg
    const s = line?.s
    const pct = (m: number, a: number) => (a > 0 ? `${((m / a) * 100).toFixed(1)}%` : '—')
    const statItems: [string, string | number][] = [
      ['Pos', p.pos],
      ['Age', p.age],
      ['POT', p.pot],
      ['GP', s?.gp ?? 0],
      ['MIN', s ? (mode === 'pg' ? pg!.min.toFixed(1) : s.min) : '—'],
      ['PTS', s ? (mode === 'pg' ? pg!.pts.toFixed(1) : s.pts) : '—'],
      ['REB', s ? (mode === 'pg' ? pg!.reb.toFixed(1) : s.oreb + s.dreb) : '—'],
      ['AST', s ? (mode === 'pg' ? pg!.ast.toFixed(1) : s.ast) : '—'],
      ['STL', s ? (mode === 'pg' ? pg!.stl.toFixed(1) : s.stl) : '—'],
      ['BLK', s ? (mode === 'pg' ? pg!.blk.toFixed(1) : s.blk) : '—'],
      ['TOV', s ? (mode === 'pg' ? pg!.tov.toFixed(1) : s.tov) : '—'],
      ['PF', s ? (mode === 'pg' ? (s.pf / (s.gp || 1)).toFixed(1) : s.pf) : '—'],
      ['FG%', s ? pct(s.fgm, s.fga) : '—'],
      ['3P%', s ? pct(s.tpm, s.tpa) : '—'],
      ['FT%', s ? pct(s.ftm, s.fta) : '—'],
      ['+/-', s ? (() => { const v = mode === 'pg' ? s.pm / (s.gp || 1) : s.pm; return `${v > 0 ? '+' : ''}${mode === 'pg' ? v.toFixed(1) : v}` })() : '—'],
      ['Salary', p.contract ? money(p.contract.salary) : '—'],
      ['Through', p.contract ? `S${p.contract.expires}` : '—'],
    ]
    return (
      <div className="rt-pop">
        <div className="rt-pop-grid">
          {statItems.map(([k, v]) => (
            <div key={k} className="rt-pop-cell">
              <span className="muted">{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row rt-bar" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="Stat mode">
          <button className="btn" aria-pressed={mode === 'pg'} onClick={() => setMode('pg')}>Per game</button>
          <button className="btn" aria-pressed={mode === 'tot'} onClick={() => setMode('tot')}>Totals</button>
        </div>
        <label className="row" style={{ gap: '0.4rem' }}>
          <span className="muted" style={{ fontSize: '0.88rem' }}>Stats</span>
          <select
            className="select"
            aria-label="Stat columns"
            value={view}
            onChange={(e) => { setView(e.target.value as RosterView); setOpenId(null) }}
          >
            <option value="key">Key (MPG · PPG · RPG · APG)</option>
            <option value="all">All stats (full table)</option>
          </select>
        </label>
      </div>
      <DataTable
        rows={players}
        columns={columns}
        groups={groups.map((g) => ({ label: g.label, rows: g.rows, collapsed: g.label === 'Inactive' }))}
        rowKey={(p) => p.id}
        filters={{ pos: (p) => p.pos, name: fullName, range: true }}
        cards
        collapseFilters={!!compact}
        expanded={detailOf}
        ariaLabel={`${team.name} roster`}
      />
    </div>
  )
}
