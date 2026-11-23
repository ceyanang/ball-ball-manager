import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store'
import { SimControls } from '../components/SimControls'
import { TeamBadge } from '../components/TeamBadge'
import { ErrorBoundary } from '../ErrorBoundary'

const LINKS: [string, string][] = [
  ['/', 'Home'], ['/inbox', 'Inbox'], ['/my-team', 'My Team'], ['/office', 'Front Office'], ['/schedule', 'Schedule'], ['/standings', 'Standings'],
  ['/leaders', 'Leaders'], ['/highlights', 'Highlights'], ['/social', 'Social'], ['/history', 'History'], ['/teams', 'Teams'], ['/saves', 'Saves'],
]

export function Shell() {
  const league = useStore((s) => s.league)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)
  const notice = useStore((s) => s.notice)
  const clearNotice = useStore((s) => s.clearNotice)
  const team = league ? league.teams[league.userTeamId] : null
  const unread = league ? league.inbox.filter((i) => !i.read && !i.dismissed).length : 0
  return (
    <div className="shell">
      <aside className="side">
        <div className="wordmark">Ball Ball<br /><span>Manager</span></div>
        <nav className="nav" aria-label="Main">
          {(league?.phase === 'offseason' ? [['/offseason', 'Offseason'] as [string, string], ...LINKS] : LINKS).map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}{to === '/inbox' && unread > 0 && <span className="nav-count" aria-label={`${unread} unread`}>{unread}</span>}</NavLink>
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
              {league.phase === 'regular' ? `Season ${league.season} · Day ${league.day}` : league.phase === 'playoffs' ? `Season ${league.season} playoffs · Day ${league.day}` : `Offseason after season ${league.season}`}
            </span>
            <SimControls />
          </div>
        )}
        {notice && (
          <div className="notice-bar" role="status">
            <span>{notice}</span>
            <button className="btn" onClick={clearNotice}>OK</button>
          </div>
        )}
        {error && (
          <div className="error-bar" role="alert">
            <span>{error}</span>
            <button className="btn" onClick={clearError}>Dismiss</button>
          </div>
        )}
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </main>
    </div>
  )
}
