import { useMemo, useState } from 'react'
import type { League, Player, Team } from '../../engine/types'
import { archetypeFor } from '../../engine/player/archetype'
import { groupRoster, rosterColumns, type StatMode } from '../rosterColumns'
import { fullName, ovrOf } from '../util'
import { DataTable, type Column } from './DataTable'
import { OvrPill } from './OvrPill'
import { PlayerCell } from './PlayerCell'

/** A team's roster: Starters/Bench groups by default, every stat sortable, filterable by position, name or stat range. */
export function RosterTable({ league, team, players, mode: initial = 'pg' }: { league: League; team: Team; players: Player[]; mode?: StatMode }) {
  const [mode, setMode] = useState<StatMode>(initial)
  const columns = useMemo<Column<Player>[]>(() => rosterColumns(league, mode).map((c) => {
    if (c.key === 'player') return { ...c, cell: (p: Player) => <PlayerCell league={league} p={p} subtitle={archetypeFor(p)} /> }
    if (c.key === 'ovr') return { ...c, cell: (p: Player) => <OvrPill value={ovrOf(p)} pot={p.pot} /> }
    return c
  }), [league, mode])
  const groups = useMemo(() => groupRoster(team, players), [team, players])
  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Stat mode">
        <button className="btn" aria-pressed={mode === 'pg'} onClick={() => setMode('pg')}>Per game</button>
        <button className="btn" aria-pressed={mode === 'tot'} onClick={() => setMode('tot')}>Totals</button>
      </div>
      <DataTable
        rows={players}
        columns={columns}
        groups={groups.map((g) => ({ label: g.label, rows: g.rows, collapsed: g.label === 'Inactive' }))}
        rowKey={(p) => p.id}
        filters={{ pos: (p) => p.pos, name: fullName, range: true }}
        ariaLabel={`${team.name} roster`}
      />
    </div>
  )
}
