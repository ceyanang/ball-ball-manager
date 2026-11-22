import { useState } from 'react'
import { Link } from 'react-router-dom'
import { leaders, type LeaderStat } from '../../engine/stats/stats'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName } from '../util'

const STATS: [LeaderStat, string][] = [
  ['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['stl', 'Steals'], ['blk', 'Blocks'],
  ['tpm', '3-pointers made'], ['fgPct', 'Field goal %'], ['tpPct', '3-point %'], ['ftPct', 'Free throw %'],
]
const fmt = (stat: LeaderStat, v: number) => (stat.endsWith('Pct') ? (v * 100).toFixed(1) + '%' : v.toFixed(1))

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
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>#</th><th className="left">Player</th><th className="left">Team</th><th>Value</th></tr></thead>
              <tbody>
                {leaders(league, league.season, open, 25).map((x, i) => {
                  const p = league.players[x.playerId]
                  const t = p.teamId ? league.teams[p.teamId] : null
                  return (
                    <tr key={x.playerId} className={p.teamId === league.userTeamId ? 'me' : ''}>
                      <td>{i + 1}</td><td className="left"><Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link></td>
                      <td className="left">{t ? <Link className="link" to={`/team/${t.id}`}>{t.name}</Link> : 'Free agent'}</td><td>{fmt(open, x.value)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
