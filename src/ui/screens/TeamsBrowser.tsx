import { Link } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { SubNav } from '../components/SubNav'
import { TeamBadge } from '../components/TeamBadge'
import { LEAGUE_SUBNAV } from '../nav'
import { useStore } from '../store'
import { teamFull, teamOvr } from '../util'

export function TeamsBrowser() {
  const league = useStore((s) => s.league)!
  const st = computeStandings(league, league.season)
  return (
    <div className="stack">
      <SubNav items={LEAGUE_SUBNAV} label="League sections" />
      <h1>Teams</h1>
      {(['East', 'West'] as const).map((conf) => (
        <section key={conf} className="stack">
          <h2>{conf}</h2>
          <div className="team-cards">
            {st[conf].map((r) => {
              const t = league.teams[r.teamId]
              const isMe = t.id === league.userTeamId
              return (
                <Link
                  key={t.id}
                  to={`/team/${t.id}`}
                  className="team-tile"
                  style={isMe ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)' } : undefined}
                >
                  <TeamBadge team={t} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{teamFull(t)}</div>
                    <div className="muted">{r.w}–{r.l}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block', textAlign: 'right', lineHeight: 1 }}>OVR</span>
                    <span className="num" style={{ fontSize: '1.6rem' }} title="Team overall">{teamOvr(league, t.id)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
