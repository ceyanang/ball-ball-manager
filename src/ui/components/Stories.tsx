import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AWARD_NAMES } from '../../engine/stories/awards'
import { PERSONAS } from '../../engine/stories/social'
import { perGame, playerSeasonStats } from '../../engine/stats/stats'
import type { League, NewsItem, Post, SeasonAwards } from '../../engine/types'
import { Face } from '../face/Face'
import { PlayerCell } from './PlayerCell'
import { TeamBadge } from './TeamBadge'
import { fullName, one } from '../util'

const NEUTRAL = { primary: '#5b6378', secondary: '#ffffff' }

const whenLabel = (season: number, day: number, playoffs = false) => `S${season} · ${playoffs ? 'Playoffs · ' : ''}Day ${day}`

export function NewsCard({ league, n }: { league: League; n: NewsItem }) {
  const team = n.teamIds[0] ? league.teams[n.teamIds[0]] : null
  const p = n.playerIds[0] ? league.players[n.playerIds[0]] : null
  return (
    <article className={`news-card${n.weight >= 8 ? ' big' : ''}`} style={{ borderLeftColor: team?.colors.primary ?? 'var(--accent)' }}>
      <div className="news-emoji" aria-hidden="true">{n.emoji}</div>
      <div className="news-body">
        <div className="news-title">{n.title}</div>
        <div className="muted">{n.text}</div>
        <div className="news-meta">
          <span>{whenLabel(n.season, n.day, n.playoffs)}</span>
          {p && <Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link>}
          {n.gameId && league.games.some((g) => g.id === n.gameId && g.result?.box.length) && <Link className="link" to={`/game/${n.gameId}`}>Box score →</Link>}
        </div>
      </div>
      {p && <Face seed={p.faceSeed} age={p.age} colors={p.teamId ? league.teams[p.teamId].colors : NEUTRAL} size={46} title={fullName(p)} />}
    </article>
  )
}

const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n))

export function PostCard({ league, post }: { league: League; post: Post }) {
  const a = post.author
  let face: React.ReactNode, name: React.ReactNode, handle: string, badge = ''
  if (a.kind === 'player') {
    const p = league.players[a.playerId]
    const colors = p?.teamId ? league.teams[p.teamId].colors : NEUTRAL
    face = p ? <Face seed={p.faceSeed} age={p.age} colors={colors} size={42} title={fullName(p)} /> : null
    name = p ? <Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link> : 'Former player'
    handle = p ? `${p.firstName[0]}${p.lastName}${p.jersey}`.replace(/[^A-Za-z0-9]/g, '') : 'player'
    badge = '✔️'
  } else if (a.kind === 'persona') {
    const per = PERSONAS[a.id]
    face = <Face seed={per.seed} age={34} colors={{ primary: '#1c2030', secondary: '#f5b400' }} size={42} title={per.name} />
    name = per.name
    handle = per.handle
    badge = a.id === 'insider' || a.id === 'stats' ? '✔️' : ''
  } else {
    const t = a.teamId ? league.teams[a.teamId] : null
    face = <Face seed={a.seed} age={26} colors={t?.colors ?? NEUTRAL} size={42} title={a.name} />
    name = a.name
    handle = a.handle
  }
  return (
    <article className={`post tone-${post.tone}`}>
      <div className="post-face">{face}</div>
      <div className="post-body">
        <div className="post-head"><strong>{name}</strong>{badge && <span className="verified" title="Verified">{badge}</span>}<span className="muted">@{handle} · {whenLabel(post.season, post.day)}</span></div>
        <p className="post-text">{post.text}</p>
        <div className="post-foot muted">
          <span>🔁 {compact(post.reposts)}</span><span>❤️ {compact(post.likes)}</span>
          {post.playerIds.slice(0, 2).map((id) => league.players[id] && <Link key={id} className="link" to={`/player/${id}`}>{fullName(league.players[id])}</Link>)}
          {post.gameId && league.games.some((g) => g.id === post.gameId && g.result?.box.length) && <Link className="link" to={`/game/${post.gameId}`}>Game →</Link>}
        </div>
      </div>
    </article>
  )
}

function statSub(league: League, playerId: string, season: number): string {
  const s = playerSeasonStats(league, playerId, season, false)
  if (!s) return ''
  const pg = perGame(s)
  return `${one(pg.pts)} pts · ${one(pg.reb)} reb · ${one(pg.ast)} ast`
}

/** The awards, revealed one at a time (or all at once). */
export function AwardsCeremony({ league, a, reveal = true }: { league: League; a: SeasonAwards; reveal?: boolean }) {
  const singles = (['mvp', 'finalsMvp', 'dpoy', 'roy', 'smoy', 'mip'] as const).filter((k) => a[k]).reverse()
  const total = singles.length + (a.coy ? 1 : 0) + 1
  const [shown, setShown] = useState(reveal ? 1 : total)
  const champ = a.championId ? league.teams[a.championId] : null
  const cards: React.ReactNode[] = []
  if (champ) cards.push(
    <div key="champ" className="award-card champ-card" style={{ background: `linear-gradient(120deg, ${champ.colors.primary}, ${champ.colors.secondary})` }}>
      <TeamBadge team={champ} size={56} />
      <div><div className="award-name">🏆 Champions</div><div className="award-winner">{champ.city} {champ.name}</div></div>
    </div>,
  )
  if (a.coy) {
    const c = league.coaches[a.coy.coachId]
    cards.push(
      <div key="coy" className="award-card">
        <Face seed={c.faceSeed} age={c.age} colors={league.teams[a.coy.teamId].colors} size={56} />
        <div><div className="award-name">Coach of the Year</div><div className="award-winner">{c.firstName} {c.lastName}</div><div className="muted">{league.teams[a.coy.teamId].name}</div></div>
      </div>,
    )
  }
  for (const k of singles) {
    const p = league.players[a[k]!]
    cards.push(
      <div key={k} className={`award-card${k === 'mvp' ? ' mvp' : ''}`}>
        <Face seed={p.faceSeed} age={p.age} colors={p.teamId ? league.teams[p.teamId].colors : NEUTRAL} size={56} title={fullName(p)} />
        <div><div className="award-name">{k === 'mvp' ? '👑 ' : '🏅 '}{AWARD_NAMES[k]}</div><Link className="award-winner link" to={`/player/${p.id}`}>{fullName(p)}</Link><div className="muted">{statSub(league, p.id, a.season)}</div></div>
      </div>,
    )
  }
  const done = shown >= cards.length
  return (
    <div className="stack">
      <div className="award-grid">{cards.slice(0, shown)}</div>
      {!done && (
        <div className="row">
          <button className="btn btn-primary" onClick={() => setShown(shown + 1)}>🎤 And the next award goes to…</button>
          <button className="btn" onClick={() => setShown(cards.length)}>Show all</button>
        </div>
      )}
      {done && (
        <div className="grid-2">
          {[...a.allLeague.map((t, i) => [`All-League ${['1st', '2nd', '3rd'][i]} team`, t] as const), ...a.allDefense.map((t, i) => [`All-Defense ${['1st', '2nd'][i]} team`, t] as const), ...(a.allRookie.length ? [['All-Rookie team', a.allRookie] as const] : [])].map(([label, ids]) => (
            <section key={label} className="panel stack" style={{ gap: '0.5rem' }}>
              <h3>{label}</h3>
              {ids.map((id) => league.players[id] && <PlayerCell key={id} league={league} p={league.players[id]} showInjury={false} subtitle={`${league.players[id].pos} · ${statSub(league, id, a.season)}`} />)}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
