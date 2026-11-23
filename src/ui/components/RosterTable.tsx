import type { League, Player } from '../../engine/types'
import { money, one, ovrOf, seasonLine } from '../util'
import { archetypeFor } from '../../engine/player/archetype'
import { OvrPill } from './OvrPill'
import { PlayerCell } from './PlayerCell'

export function RosterTable({ league, players }: { league: League; players: Player[] }) {
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead>
          <tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>GP</th><th>PTS</th><th>REB</th><th>AST</th><th>Salary</th><th>Through</th></tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const line = seasonLine(league, p)
            return (
              <tr key={p.id}>
                <td><PlayerCell league={league} p={p} subtitle={archetypeFor(p)} /></td>
                <td>{p.pos}</td><td>{p.age}</td><td><OvrPill value={ovrOf(p)} pot={p.pot} /></td>
                <td>{line?.s.gp ?? 0}</td><td>{line ? one(line.pg.pts) : '—'}</td><td>{line ? one(line.pg.reb) : '—'}</td><td>{line ? one(line.pg.ast) : '—'}</td>
                <td>{p.contract ? money(p.contract.salary) : '—'}</td><td>{p.contract ? `Season ${p.contract.expires}` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
