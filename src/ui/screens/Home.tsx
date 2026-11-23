import { Link } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { Face } from '../face/Face'
import { TeamBadge } from '../components/TeamBadge'
import { GameDayHero } from '../components/GameDay'
import { NewsCard } from '../components/Stories'
import { PlayoffHub } from './PlayoffHub'
import { useStore } from '../store'
import { didWin, fullName, nextGame, one, ordinal, ovrOf, recentResults, rosterOf, rowPct, seasonLine, teamFull } from '../util'

export function Home() {
  const league = useStore((s) => s.league)!
  const team = league.teams[league.userTeamId]
  const st = computeStandings(league, league.season)
  const confRows = st[team.conf]
  const me = confRows.find((r) => r.teamId === team.id)!
  const rank = confRows.indexOf(me) + 1
  const next = nextGame(league, team.id)
  const gameDay = next && next.day === league.day ? next : null
  const records = Object.fromEntries([...st.East, ...st.West].map((r) => [r.teamId, { w: r.w, l: r.l }]))
  const last5 = recentResults(league, team.id, 5)
  const champ = league.playoffs?.championId ? league.teams[league.playoffs.championId] : null
  const performers = rosterOf(league, team.id)
    .map((p) => ({ p, line: seasonLine(league, p) }))
    .filter((x) => x.line)
    .sort((a, b) => b.line!.pg.pts - a.line!.pg.pts)
    .slice(0, 4)

  const unreadItems = league.inbox.filter((i) => !i.read && !i.dismissed)
  const unread = unreadItems.length
  const inboxTop = [...unreadItems].reverse().sort((a, b) => Number(b.offer?.status === 'open') - Number(a.offer?.status === 'open')).slice(0, 4)
  // The last couple of days' best moments, the user's team first.
  const recentDay = league.news.length ? league.news[league.news.length - 1].day : 0
  const topNews = league.news
    .filter((n) => n.season === league.season && n.day >= recentDay - 2)
    .sort((a, b) => Number(b.teamIds.includes(team.id)) - Number(a.teamIds.includes(team.id)) || b.weight - a.weight)
    .slice(0, 4)

  const myEvents = league.progress.filter((e) => e.season === league.season && e.teamId === team.id).slice(-8).reverse()
  const movers = Object.values(league.players)
    .filter((p) => p.teamId)
    .map((p) => ({ p, d: ovrOf(p) - (p.ratingHistory.find((h) => h.season === league.season)?.ovr ?? ovrOf(p)) }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => b.d - a.d)
  const risers = movers.slice(0, 3)
  const fallers = movers.filter((x) => x.d < 0).slice(-3).reverse()
  const moverRow = ({ p, d }: { p: (typeof movers)[number]['p']; d: number }) => (
    <li key={p.id}>
      <Link className="link" to={`/player/${p.id}`}>{fullName(p)} <span className="muted">{league.teams[p.teamId!].abbrev}</span></Link>
      <span className={d > 0 ? 'delta-up' : 'delta-down'}>{d > 0 ? `+${d}` : d} → {ovrOf(p)}</span>
    </li>
  )

  const inPlayoffs = league.phase === 'playoffs'
  const asgPending = league.allStars.filter((e) => e.season === league.season && !e.result).length > 0

  return (
    <div className="stack">
      {asgPending && (
        <Link to="/all-star" className="panel row" style={{ justifyContent: 'space-between', textDecoration: 'none', color: 'inherit' }}>
          <span>🌟 <strong>All-Star Weekend is here!</strong> The rosters are set — watch the game live.</span><span className="link">Open →</span>
        </Link>
      )}
      {champ && (
        <div className="scoreboard" style={{ background: `linear-gradient(120deg, ${champ.colors.primary}, ${champ.colors.secondary})` }}>
          <TeamBadge team={champ} size={64} />
          <div>
            <div className="team-line">{teamFull(champ)} are champions</div>
            <div className="sub">Season {league.season} is in the books.</div>
          </div>
        </div>
      )}
      <div className="scoreboard" style={{ background: `linear-gradient(110deg, ${team.colors.primary} 55%, ${team.colors.secondary})` }}>
        <TeamBadge team={team} size={64} />
        <div>
          <div className="team-line">{teamFull(team)}</div>
          <div className="sub">{me.w + me.l > 0 ? `${ordinal(rank)} in the ${team.conf}` : `${team.conf} · no games yet`} · {league.coaches[team.coachId].firstName} {league.coaches[team.coachId].lastName}, coach</div>
        </div>
        <div className="record" aria-label={`Record ${me.w} wins ${me.l} losses`}>{me.w}–{me.l}</div>
      </div>

      {league.phase === 'offseason' && league.offseason && (
        <Link to="/offseason" className="offseason-banner">
          <span className="gd-chip">🗓️ Offseason</span>
          <span><strong>{{ awards: 'The awards ceremony is on 🎤', recap: 'Season recap is in', lottery: 'The draft lottery is ready', draft: 'It’s draft day', resign: 'Time to re-sign your players', freeAgency: `Free agency · day ${league.offseason.faDay}`, ready: `Season ${league.season + 1} is ready to tip off` }[league.offseason.step]}</strong></span>
          <span className="muted">Continue →</span>
        </Link>
      )}
      {inPlayoffs && <PlayoffHub />}
      {!inPlayoffs && gameDay && <GameDayHero league={league} game={gameDay} team={team} records={records} />}

      {inboxTop.length > 0 && (
        <section className="panel stack" style={{ gap: '0.5rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>📬 Inbox <span className="count-pill">{unread}</span></h2>
            <Link to="/inbox" className="link muted">Open inbox</Link>
          </div>
          <ul className="progress-list">
            {inboxTop.map((i) => <li key={i.id}><Link className="link" to="/inbox"><strong>{i.title}</strong></Link>{i.offer?.status === 'open' && <span className="gd-chip">Offer</span>}</li>)}
          </ul>
        </section>
      )}

      {!inPlayoffs && (
      <div className="grid-2">
        <section className="panel stack">
          <h2>{gameDay ? 'Recent form' : 'Next game'}</h2>
          {gameDay ? null : next ? (() => {
            const home = next.homeId === team.id
            const opp = league.teams[home ? next.awayId : next.homeId]
            return (
              <div className="row">
                <TeamBadge team={opp} size={48} />
                <div>
                  <div style={{ fontWeight: 700 }}>{home ? 'vs' : 'at'} {teamFull(opp)}</div>
                  <div className="muted">Day {next.day}{next.playoff ? ` · Playoffs, game ${next.playoff.gameNum}` : ''}</div>
                </div>
              </div>
            )
          })() : <p className="muted" style={{ margin: 0 }}>No games scheduled.</p>}
          <div>
            <div className="muted" style={{ marginBottom: '0.3rem' }}>Last 5</div>
            {last5.length ? (
              <div className="row" style={{ gap: '0.3rem' }}>
                {last5.map((g) => {
                  const w = didWin(g, team.id)
                  return <Link key={g.id} to={`/game/${g.id}`} className={`result-chip ${w ? 'w' : 'l'}`} title={`${g.result!.awayScore}–${g.result!.homeScore}`}>{w ? 'W' : 'L'}</Link>
                })}
              </div>
            ) : <span className="muted">Sim a day to tip off the season.</span>}
          </div>
        </section>

        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>{team.conf} standings</h2>
            <Link to="/standings" className="link muted">Full table</Link>
          </div>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead>
              <tbody>
                {confRows.slice(0, 8).map((r) => (
                  <tr key={r.teamId} className={r.teamId === team.id ? 'me' : ''}>
                    <td><Link className="link" to={`/team/${r.teamId}`}>{league.teams[r.teamId].name}</Link></td>
                    <td>{r.w}</td><td>{r.l}</td><td>{rowPct(r)}</td><td>{r.gb === 0 ? '—' : r.gb.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      )}

      {topNews.length > 0 && (
        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>⚡ Latest highlights</h2>
            <Link to="/highlights" className="link muted">All highlights</Link>
          </div>
          <div className="stack" style={{ gap: '0.5rem' }}>{topNews.map((n) => <NewsCard key={n.id} league={league} n={n} />)}</div>
        </section>
      )}

      {!inPlayoffs && (
        <>
      <section className="panel stack">
        <h2>Progress report</h2>
        {myEvents.length === 0 && movers.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Ratings update every 10 days of the season.</p>
        ) : (
          <div className="grid-2">
            <div className="stack" style={{ gap: '0.5rem' }}>
              <h3>{team.name}</h3>
              {myEvents.length ? (
                <ul className="progress-list">
                  {myEvents.map((e, i) => {
                    const p = league.players[e.playerId]
                    const up = e.to > e.from
                    return (
                      <li key={i}>
                        <Link className="link" to={`/player/${p.id}`}>{e.breakout ? '🌱' : up ? '📈' : '📉'} {fullName(p)}</Link>
                        <span className={up || e.breakout ? 'delta-up' : 'delta-down'}>{e.breakout ? `BREAKOUT · POT ${e.breakout.potFrom} → ${e.breakout.potTo}` : `${e.from} → ${e.to}`}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : <span className="muted">No changes on your roster yet.</span>}
            </div>
            <div className="stack" style={{ gap: '0.5rem' }}>
              <h3>Around the league</h3>
              <ul className="progress-list">{risers.map(moverRow)}</ul>
              {fallers.length > 0 && <ul className="progress-list">{fallers.map(moverRow)}</ul>}
            </div>
          </div>
        )}
      </section>

      <section className="panel stack">
        <h2>Top performers</h2>
        {performers.length ? (
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {performers.map(({ p, line }) => (
              <Link key={p.id} to={`/player/${p.id}`} className="row link">
                <Face seed={p.faceSeed} age={p.age} colors={team.colors} size={52} jersey={p.jersey} title={fullName(p)} />
                <div>
                  <div style={{ fontWeight: 700 }}>{fullName(p)}</div>
                  <div className="muted">{one(line!.pg.pts)} pts · {one(line!.pg.reb)} reb · {one(line!.pg.ast)} ast</div>
                </div>
              </Link>
            ))}
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>Stats show up after your first game.</p>}
      </section>
        </>
      )}
    </div>
  )
}
