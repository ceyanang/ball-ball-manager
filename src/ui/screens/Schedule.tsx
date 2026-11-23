import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { didWin, teamFull, teamGames } from '../util'

const ROUND = ['', 'First round', 'Conference semis', 'Conference finals', 'Finals']

export function Schedule() {
  const league = useStore((s) => s.league)!
  const [teamId, setTeamId] = useState(league.userTeamId)
  const team = league.teams[teamId]
  const games = teamGames(league, teamId).filter((g) => g.season === league.season)
  const sortedTeams = Object.values(league.teams).sort((a, b) => teamFull(a).localeCompare(teamFull(b)))
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Schedule</h1>
        <label className="row" style={{ gap: '0.4rem' }}>
          <span className="muted">Team</span>
          <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {sortedTeams.map((t) => <option key={t.id} value={t.id}>{teamFull(t)}</option>)}
          </select>
        </label>
      </div>
      <div className="panel table-wrap">
        <table className="stats">
          <thead><tr><th>Day</th><th className="left">Opponent</th><th className="left">Result</th><th className="left m-hide">Game</th></tr></thead>
          <tbody>
            {games.map((g) => {
              const home = g.homeId === team.id
              const opp = league.teams[home ? g.awayId : g.homeId]
              const r = g.result
              const w = r ? didWin(g, team.id) : false
              const us = r ? (home ? r.homeScore : r.awayScore) : 0
              const them = r ? (home ? r.awayScore : r.homeScore) : 0
              return (
                <tr key={g.id}>
                  <td>{g.day}</td>
                  <td className="left"><span className="row" style={{ gap: '0.5rem' }}><span className="muted" style={{ width: '1.3rem' }}>{home ? 'vs' : '@'}</span><TeamBadge team={opp} size={26} /><Link className="link" to={`/team/${opp.id}`}><span className="m-hide">{teamFull(opp)}</span><span className="m-show">{opp.name}</span></Link>{g.playoff && <span className="muted m-show">G{g.playoff.gameNum}</span>}</span></td>
                  <td className="left">{r ? <Link className="link" to={`/game/${g.id}`}><span className={w ? 'win' : 'loss'}>{w ? 'W' : 'L'}</span> {us}–{them}{r.ot ? ` (${r.ot > 1 ? r.ot : ''}OT)` : ''}</Link> : '—'}</td>
                  <td className="left muted m-hide">{g.playoff ? `${ROUND[g.playoff.round]}, game ${g.playoff.gameNum}` : 'Regular season'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
