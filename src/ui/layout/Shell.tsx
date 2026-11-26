import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { setSettings, useAudioSettings } from '../../audio/settings'
import { computeStandings } from '../../engine/standings'
import type { League } from '../../engine/types'
import { useStore } from '../store'
import { MobileRosterWarning, MobileSim, SimControls } from '../components/SimControls'
import { TeamBadge } from '../components/TeamBadge'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { RosterPeek } from '../components/RosterPeek'
import { ErrorBoundary } from '../ErrorBoundary'
import { activeTab, matchesNav, MORE_GROUPS, OFFSEASON, SAVES, SIDEBAR_GROUPS, TABS } from '../nav'
import { WatchGame } from '../watch/WatchGame'
import { useMusic } from '../../audio/useMusic'

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
  const [peekOpen, setPeekOpen] = useState(false)
  const audio = useAudioSettings()
  useMusic(pathname, watching)
  // New screen starts at the top (the More sheet closes itself via its links).
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  // A notice belongs to the screen it was raised on: drop it when the user moves on. A notice raised by the same
  // action that navigated (e.g. a move that sends you to another page) is tagged with the new path, so it survives.
  const noticeAt = useRef<string | null>(null)
  useEffect(() => { if (notice) noticeAt.current = pathname }, [notice]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (notice && noticeAt.current !== null && noticeAt.current !== pathname) clearNotice()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const team = league ? league.teams[league.userTeamId] : null
  const unread = league ? league.inbox.filter((i) => !i.read && !i.dismissed).length : 0
  const record = useMemo(() => {
    if (!league) return null
    const r = computeStandings(league, league.season)[league.teams[league.userTeamId].conf].find((x) => x.teamId === league.userTeamId)
    return r ? `${r.w}–${r.l}` : null
  }, [league])
  const offseason = league?.phase === 'offseason'
  const sidebarGroups = !league
    ? [{ title: 'Start', items: [{ to: '/new', label: 'New League', icon: 'sun' as const, match: ['/new'] }, SAVES] }]
    : offseason
      ? [{ title: 'Now', items: [OFFSEASON] }, ...SIDEBAR_GROUPS]
      : SIDEBAR_GROUPS
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
          {sidebarGroups.map((g) => (
            <div key={g.title} className="nav-group">
              <div className="nav-head">{g.title}</div>
              {g.items.map((i) => {
                const active = matchesNav(pathname, i)
                return (
                  <NavLink key={i.to} to={i.to} className={() => (active ? 'active' : undefined)}>
                    <Icon name={i.icon} size={18} />
                    <span>{i.label}</span>
                    {i.to === '/inbox' && inboxBadge}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        {team && (
          <Link to="/my-team" className="side-team row" title="View your rotation and contracts">
            <TeamBadge team={team} size={34} />
            <div style={{ lineHeight: 1.15, minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name} {record ? `· ${record}` : ''}</div>
              <div style={{ fontSize: '0.78rem', opacity: 0.7 }}>{league!.name} · S{league!.season}</div>
            </div>
          </Link>
        )}
      </aside>

      {/* Mobile app bar: who you are, where you are in the season, and the one action you take most — Watch or Sim. */}
      <header className="mbar">
        {league && team ? (
          <>
            <Link to="/" className="mbar-team" aria-label={`${team.name} home`}>
              <TeamBadge team={team} size={36} />
              <span className="mbar-text">
                <span className="mbar-title"><span className="mbar-name">{team.name}</span>{record && <span className="mbar-rec">{record}</span>}</span>
                <span className="mbar-sub">{phaseLabel(league, true)}</span>
              </span>
            </Link>
            <button className="icon-btn" onClick={() => setPeekOpen(true)} aria-label="My team stats" title="My team stats"><Icon name="chart" /></button>
            <MobileSim />
          </>
        ) : (
          <div className="mbar-pre">
            <div className="wordmark mbar-word">Ball Ball <span>Manager</span></div>
            <Link className="btn" to="/saves">Saves</Link>
          </div>
        )}
      </header>

      <main className="main">
        {league && (
          <div className="topbar">
            <span className="muted topbar-phase">{phaseLabel(league)}</span>
            <div className="topbar-actions">
              <button className="btn" onClick={() => setPeekOpen(true)} title="Quick look at your roster's full stats">📊 My team stats</button>
              <SimControls />
            </div>
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
        <ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>
      </main>

      {league && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} className={`tab${tab === t.to ? ' active' : ''}`} aria-current={tab === t.to ? 'page' : undefined}>
              <span className="tab-icon"><Icon name={t.icon} /></span>
              <span className="tab-label">{t.label}</span>
            </Link>
          ))}
          <button className={`tab${tab === 'more' ? ' active' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
            <span className="tab-icon">
              <Icon name="more" />
              {inboxBadge || (offseason && <span className="tab-dot" aria-label="Offseason in progress" />)}
            </span>
            <span className="tab-label">More</span>
          </button>
        </nav>
      )}

      {league && <RosterPeek open={peekOpen} onClose={() => setPeekOpen(false)} teamId={league.userTeamId} />}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu">
        {moreGroups.map((g) => (
          <section key={g.title} className="more-group">
            <h3>{g.title}</h3>
            <div className="more-grid">
              {g.items.map((i) => {
                const active = matchesNav(pathname, i)
                return (
                  <NavLink key={i.to} to={i.to} className={`more-item${active ? ' active' : ''}`} onClick={() => setMoreOpen(false)}>
                    <span className="more-item-icon">
                      <Icon name={i.icon} />
                      {i.to === '/inbox' && inboxBadge}
                    </span>
                    <span>{i.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </section>
        ))}
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', paddingTop: '0.25rem', borderTop: '1px solid var(--line)' }}>
          <button
            className="btn"
            aria-pressed={audio.muted}
            onClick={() => setSettings({ muted: !audio.muted })}
          >
            {audio.muted ? '🔇 Sound muted' : '🔊 Sound on'}
          </button>
          {league && <span className="muted more-foot">{league.name} · Season {league.season}</span>}
        </div>
      </Sheet>
    </div>
  )
}
