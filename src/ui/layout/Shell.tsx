import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import type { League } from '../../engine/types'
import { useStore } from '../store'
import { MobileRosterWarning, MobileSim, SimControls } from '../components/SimControls'
import { TeamBadge } from '../components/TeamBadge'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { ErrorBoundary } from '../ErrorBoundary'
import { activeTab, MORE_GROUPS, OFFSEASON, SIDEBAR, TABS } from '../nav'
import { WatchGame } from '../watch/WatchGame'

function phaseLabel(l: League, short = false): string {
  if (l.phase === 'regular') return short ? `Day ${l.day}` : `Season ${l.season} · Day ${l.day}`
  if (l.phase === 'playoffs') return short ? `Playoffs · Day ${l.day}` : `Season ${l.season} playoffs · Day ${l.day}`
  return short ? 'Offseason' : `Offseason after season ${l.season}`
}

export function Shell() {
  const league = useStore((s) => s.league)
  const error = useStore((s) => s.error)
  const clearError = useStore((s) => s.clearError)
  const notice = useStore((s) => s.notice)
  const watching = useStore((s) => s.watch !== null)
  const endWatch = useStore((s) => s.endWatch)
  const clearNotice = useStore((s) => s.clearNotice)
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  // New screen starts at the top (the More sheet closes itself via its links).
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const team = league ? league.teams[league.userTeamId] : null
  const unread = league ? league.inbox.filter((i) => !i.read && !i.dismissed).length : 0
  const record = useMemo(() => {
    if (!league) return null
    const r = computeStandings(league, league.season)[league.teams[league.userTeamId].conf].find((x) => x.teamId === league.userTeamId)
    return r ? `${r.w}–${r.l}` : null
  }, [league])
  const offseason = league?.phase === 'offseason'
  const sidebar = offseason ? [OFFSEASON, ...SIDEBAR] : SIDEBAR
  const moreGroups = offseason ? [{ title: 'Now', items: [OFFSEASON] }, ...MORE_GROUPS] : MORE_GROUPS
  const tab = activeTab(pathname)
  const inboxBadge = unread > 0 && <span className="nav-count" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>

  // Watching a game: nothing else in the app is rendered, so nothing can spoil the result.
  if (watching) return <ErrorBoundary onReset={endWatch} message="Something went wrong showing this game. The result is already saved."><WatchGame /></ErrorBoundary>

  return (
    <div className="shell">
      <aside className="side">
        <div className="wordmark">Ball Ball<br /><span>Manager</span></div>
        <nav className="nav" aria-label="Main">
          {sidebar.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'}>
              <Icon name={i.icon} size={18} /><span>{i.label}</span>{i.to === '/inbox' && inboxBadge}
            </NavLink>
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

      {/* Mobile app bar: who you are, where you are in the season, and the one action you take most — Sim. */}
      <header className="mbar">
        {league && team ? (
          <>
            <Link to="/" className="mbar-team" aria-label={`${team.name} home`}>
              <TeamBadge team={team} size={36} />
              <span className="mbar-text">
                <span className="mbar-title">{team.name}{record && <span className="mbar-rec"> {record}</span>}</span>
                <span className="mbar-sub">{phaseLabel(league, true)}</span>
              </span>
            </Link>
            <MobileSim />
          </>
        ) : (
          <div className="wordmark mbar-word">Ball Ball <span>Manager</span></div>
        )}
      </header>

      <main className="main">
        {league && (
          <div className="topbar">
            <span className="muted">{phaseLabel(league)}</span>
            <SimControls />
          </div>
        )}
        {league && <MobileRosterWarning />}
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

      {league && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} className={`tab${tab === t.to ? ' active' : ''}`} aria-current={tab === t.to ? 'page' : undefined}>
              <span className="tab-icon"><Icon name={t.icon} />{t.to === '/inbox' && inboxBadge}</span>
              <span className="tab-label">{t.label}</span>
            </Link>
          ))}
          <button className={`tab${tab === 'more' ? ' active' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
            <span className="tab-icon"><Icon name="more" />{offseason && <span className="tab-dot" aria-label="Offseason in progress" />}</span>
            <span className="tab-label">More</span>
          </button>
        </nav>
      )}

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        {moreGroups.map((g) => (
          <section key={g.title} className="more-group">
            <h3>{g.title}</h3>
            <div className="more-grid">
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} className="more-item" end onClick={() => setMoreOpen(false)}>
                  <Icon name={i.icon} /><span>{i.label}</span>
                </NavLink>
              ))}
            </div>
          </section>
        ))}
        {league && <p className="muted more-foot">{league.name} · Season {league.season}</p>}
      </Sheet>
    </div>
  )
}
