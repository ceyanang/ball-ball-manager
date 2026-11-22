import { Link } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { Face } from '../face/Face'
import { TeamBadge } from '../components/TeamBadge'
import { GameDayHero } from '../components/GameDay'
import { useStore } from '../store'
import { didWin, fullName, nextGame, one, ovrOf, pct, rosterOf, seasonLine, teamFull, teamGames } from '../util'

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
  const played = teamGames(league, team.id).filter((g) => g.result)
  const last5 = played.slice(-5)
  const champ = league.playoffs?.championId ? league.teams[league.playoffs.championId] : null
  const performers = rosterOf(league, team.id)
    .map((p) => ({ p, line: seasonLine(league, p) }))
    .filter((x) => x.line)
    .sort((a, b) => b.line!.pg.pts - a.line!.pg.pts)
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

  return (
    <div className="stack">
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
          <div className="sub">{rank}{['st', 'nd', 'rd'][rank - 1] ?? 'th'} in the {team.conf} · {league.coaches[team.coachId].firstName} {league.coaches[team.coachId].lastName}, coach</div>
        </div>
        <div className="record" aria-label={`Record ${me.w} wins ${me.l} losses`}>{me.w}–{me.l}</div>
      </div>

      {league.phase === 'offseason' && league.offseason && (
        <Link to="/offseason" className="offseason-banner">
          <span className="gd-chip">🗓️ Offseason</span>
          <span><strong>{{ recap: 'Season recap is in', lottery: 'The draft lottery is ready', draft: 'It’s draft day', resign: 'Time to re-sign your players', freeAgency: `Free agency · day ${league.offseason.faDay}`, ready: `Season ${league.season + 1} is ready to tip off` }[league.offseason.step]}</strong></span>
          <span className="muted">Continue →</span>
        </Link>
      )}
      {gameDay && <GameDayHero league={league} game={gameDay} team={team} records={records} />}

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
                    <td>{r.w}</td><td>{r.l}</td><td>{pct(r.pct)}</td><td>{r.gb === 0 ? '—' : r.gb.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

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
                        <Link className="link" to={`/player/${p.id}`}>{up ? '📈' : '📉'} {fullName(p)}</Link>
                        <span className={up ? 'delta-up' : 'delta-down'}>{e.from} → {e.to}</span>
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
    </div>
  )
}
