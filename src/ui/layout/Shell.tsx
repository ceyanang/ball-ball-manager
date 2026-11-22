import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store'
import { SimControls } from '../components/SimControls'
import { TeamBadge } from '../components/TeamBadge'

const LINKS: [string, string][] = [
  ['/', 'Home'], ['/my-team', 'My Team'], ['/schedule', 'Schedule'], ['/standings', 'Standings'],
  ['/leaders', 'Leaders'], ['/teams', 'Teams'], ['/saves', 'Saves'],
]

export function Shell() {
  const league = useStore((s) => s.league)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)
  const team = league ? league.teams[league.userTeamId] : null
  return (
    <div className="shell">
      <aside className="side">
        <div className="wordmark">Ball Ball<br /><span>Manager</span></div>
        <nav className="nav" aria-label="Main">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
          ))}
        </nav>
        {team && (
          <div className="side-team row" style={{ marginTop: 'auto' }}>
            <TeamBadge team={team} size={34} />
            <div style={{ lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700 }}>{team.name}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{league!.name} · Season {league!.season}</div>
            </div>
          </div>
        )}
      </aside>
      <main className="main">
        {league && (
          <div className="topbar">
            <span className="muted">
              {league.phase === 'regular' ? `Regular season · Day ${league.day}` : league.phase === 'playoffs' ? `Playoffs · Day ${league.day}` : 'Offseason'}
            </span>
            <SimControls />
          </div>
        )}
        {error && (
          <div className="error-bar" role="alert">
            <span>{error}</span>
            <button className="btn" onClick={clearError}>Dismiss</button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
