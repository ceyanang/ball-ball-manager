import { useState } from 'react'
import { Link } from 'react-router-dom'
import { leaders, type LeaderStat } from '../../engine/stats/stats'
import type { Player, Team } from '../../engine/types'
import { DataTable, type Column } from '../components/DataTable'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName } from '../util'

const STATS: [LeaderStat, string][] = [
  ['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'],
  ['tpm', '3-pointers made'], ['fgPct', 'Field goal %'], ['tpPct', '3-point %'], ['ftPct', 'Free throw %'],
]
const fmt = (stat: LeaderStat, v: number) => (stat.endsWith('Pct') ? (v * 100).toFixed(1) + '%' : v.toFixed(1))

interface BoardRow { rank: number; p: Player; t: Team | null; value: number }

export function Leaders() {
  const league = useStore((s) => s.league)!
  const [open, setOpen] = useState<LeaderStat | null>(null)
  const colorsOf = (pid: string) => {
    const t = league.players[pid].teamId
    return t ? league.teams[t].colors : { primary: '#5b6378', secondary: '#fff' }
  }
  return (
    <div className="stack">
      <h1>League leaders</h1>
      <p className="muted" style={{ margin: 0 }}>Per game, season {league.season}. Players need to have played 70% of their team’s games to qualify.</p>
      <div className="leader-cards">
        {STATS.map(([stat, label]) => {
          const top = leaders(league, league.season, stat, 5)
          return (
            <button key={stat} className="leader-card" aria-pressed={open === stat} onClick={() => setOpen(open === stat ? null : stat)}>
              <h3>{label}</h3>
              {top.length === 0 && <span className="muted">No qualified players yet.</span>}
              {top.map((x, i) => {
                const p = league.players[x.playerId]
                const t = p.teamId ? league.teams[p.teamId] : null
                return (
                  <div key={x.playerId} className={`leader-line ${i === 0 ? 'leader-top' : ''}`}>
                    <span className="muted">{i + 1}</span>
                    <Face seed={p.faceSeed} age={p.age} colors={colorsOf(p.id)} size={i === 0 ? 40 : 26} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName(p)} <span className="muted">{t?.abbrev}</span></span>
                    <span className="val">{fmt(stat, x.value)}</span>
                  </div>
                )
              })}
            </button>
          )
        })}
      </div>
      {open && (
        <section className="panel stack">
          <h2>Top 25 · {STATS.find(([s]) => s === open)![1]}</h2>
          <DataTable<BoardRow>
            ariaLabel={`Top 25 ${STATS.find(([s]) => s === open)![1]}`}
            rows={leaders(league, league.season, open, 25).map((x, i) => {
              const p = league.players[x.playerId]
              return { rank: i + 1, p, t: p.teamId ? league.teams[p.teamId] : null, value: x.value }
            })}
            rowKey={(r) => r.p.id}
            rowClass={(r) => (r.p.teamId === league.userTeamId ? 'me' : undefined)}
            columns={boardColumns(open)}
            filters={{ name: (r) => fullName(r.p) }}
          />
        </section>
      )}
    </div>
  )
}

const boardColumns = (stat: LeaderStat): Column<BoardRow>[] => [
  { key: 'rank', label: '#', defaultDir: 'asc', value: (r) => r.rank },
  { key: 'player', label: 'Player', align: 'left', defaultDir: 'asc', value: (r) => fullName(r.p), cell: (r) => <Link className="link" to={`/player/${r.p.id}`}>{fullName(r.p)}</Link> },
  { key: 'team', label: 'Team', align: 'left', defaultDir: 'asc', value: (r) => r.t?.name ?? 'Free agent', cell: (r) => (r.t ? <Link className="link" to={`/team/${r.t.id}`}>{r.t.name}</Link> : 'Free agent') },
  { key: 'value', label: 'Value', defaultDir: 'desc', value: (r) => r.value, text: (r) => fmt(stat, r.value) },
]
