import { Link } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { teamFull, teamOvr } from '../util'

export function TeamsBrowser() {
  const league = useStore((s) => s.league)!
  const st = computeStandings(league, league.season)
  return (
    <div className="stack">
      <h1>Teams</h1>
      {(['East', 'West'] as const).map((conf) => (
        <section key={conf} className="stack">
          <h2>{conf}</h2>
          <div className="team-cards">
            {st[conf].map((r) => {
              const t = league.teams[r.teamId]
              return (
                <Link key={t.id} to={`/team/${t.id}`} className="team-tile">
                  <TeamBadge team={t} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{teamFull(t)}</div>
                    <div className="muted">{r.w}–{r.l}</div>
                  </div>
                  <span className="num" style={{ fontSize: '1.6rem' }} title="Team overall">{teamOvr(league, t.id)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
