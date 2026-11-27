import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { RosterTable } from '../components/RosterTable'
import { TeamBadge } from '../components/TeamBadge'
import { Face } from '../face/Face'
import { allRivals, rivalLabel } from '../rivals'
import { useStore } from '../store'
import { RecordTable } from './History'
import { rankOf, teamStatRows } from '../teamStats'
import { one, ovrOf, rosterOf, teamFull } from '../util'

const STYLE: Record<string, string> = { pace: 'Fast pace', three: 'Three-point heavy', defense: 'Defense first', balanced: 'Balanced' }
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`

export function TeamPage() {
  const { id } = useParams()
  const league = useStore((s) => s.league)!
  const [recScope, setRecScope] = useState<'game' | 'season' | 'career'>('game')
  const team = id && Object.hasOwn(league.teams, id) ? league.teams[id] : undefined
  if (!team) return <Navigate to="/teams" replace />
  const st = computeStandings(league, league.season)[team.conf]
  const row = st.find((r) => r.teamId === team.id)!
  const coach = league.coaches[team.coachId]
  const roster = rosterOf(league, team.id).sort((a, b) => ovrOf(b) - ovrOf(a))
  const rows = teamStatRows(league, league.season)
  const mine = rows.find((r) => r.teamId === team.id)!
  const stats: [string, string, number][] = [
    ['Points', one(mine.pts), rankOf(rows, team.id, 'pts')],
    ['Opp. points', one(mine.opp), rankOf(rows, team.id, 'opp', true)],
    ['Rebounds', one(mine.reb), rankOf(rows, team.id, 'reb')],
    ['Assists', one(mine.ast), rankOf(rows, team.id, 'ast')],
    ['Steals', one(mine.stl), rankOf(rows, team.id, 'stl')],
    ['Blocks', one(mine.blk), rankOf(rows, team.id, 'blk')],
    ['Turnovers', one(mine.tov), rankOf(rows, team.id, 'tov', true)],
    ['FG%', (mine.fgPct * 100).toFixed(1), rankOf(rows, team.id, 'fgPct')],
    ['3P%', (mine.tpPct * 100).toFixed(1), rankOf(rows, team.id, 'tpPct')],
    ['FT%', (mine.ftPct * 100).toFixed(1), rankOf(rows, team.id, 'ftPct')],
  ]
  const rivals = allRivals(league, team.id)
  return (
    <div className="stack">
      <div className="page-head" style={{ background: `linear-gradient(110deg, ${team.colors.primary} 55%, ${team.colors.secondary})` }}>
        <TeamBadge team={team} size={72} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="title">{teamFull(team)}</h1>
          <div className="sub">{row.w}–{row.l} · {ord(st.indexOf(row) + 1)} in the {team.conf}</div>
        </div>
        <div className="row" style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 12, padding: '0.5rem 0.8rem', cursor: 'default' }}>
          <Face seed={coach.faceSeed} age={coach.age} colors={{ primary: '#2a2f3d', secondary: '#ffffff' }} size={48} />
          <div>
            <div style={{ fontWeight: 700 }}>Coach {coach.firstName} {coach.lastName}</div>
            <div className="sub">{STYLE[coach.style]} · {coach.wins}–{coach.losses}</div>
          </div>
        </div>
      </div>
      {rivals.length > 0 && (
        <section className="panel stack">
          <h2>🔥 Rivals</h2>
          <div className="row" style={{ gap: '0.9rem', flexWrap: 'wrap' }}>
            {rivals.map((id) => (
              <Link key={id} className="link row" style={{ gap: '0.45rem' }} to={`/team/${id}`}>
                <TeamBadge team={league.teams[id]} size={28} />
                <span>{teamFull(league.teams[id])}</span>
                {rivalLabel(league, team.id, id) === 'dynamic' && <span className="muted">🔥 new</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="panel stack">
        <h2>Roster</h2>
        <RosterTable league={league} team={team} players={roster} />
      </section>
      {league.history.length > 0 && (
        <section className="panel stack">
          <h2>Season by season</h2>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Season</th><th>W</th><th>L</th><th className="left">Result</th></tr></thead>
              <tbody>{[...league.history].reverse().map((h) => {
                const r = h.standings.find((x) => x.teamId === team.id)
                if (!r) return null
                const confRank = h.standings.filter((x) => x.conf === r.conf).indexOf(r) + 1
                return <tr key={h.season}><td>{h.season}</td><td>{r.w}</td><td>{r.l}</td><td className="left">{h.championId === team.id ? '🏆 Champions' : h.runnerUpId === team.id ? '🥈 Lost Finals' : `${ord(confRank)} in the ${r.conf}`}</td></tr>
              })}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2>Franchise records</h2>
          <div className="seg" role="group" aria-label="Record scope">
            {([['game', 'Single game'], ['season', 'Single season'], ['career', 'Career']] as const).map(([k, label]) => (
              <button key={k} className="btn" aria-pressed={recScope === k} onClick={() => setRecScope(k)}>{label}</button>
            ))}
          </div>
        </div>
        <RecordTable league={league} book={league.records.teams[team.id]} scope={recScope} />
      </section>

      <section className="panel stack">
        <h2>Team stats</h2>
        <div className="table-wrap">
          <table className="stats">
            <thead><tr><th>Per game</th><th>Value</th><th>League rank</th></tr></thead>
            <tbody>{stats.map(([k, v, r]) => <tr key={k}><td>{k}</td><td>{mine.gp ? v : '—'}</td><td>{mine.gp ? ord(r) : '—'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
