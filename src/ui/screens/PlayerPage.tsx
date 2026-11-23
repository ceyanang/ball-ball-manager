import { Link, Navigate, useParams } from 'react-router-dom'
import { perGame, playerSeasonStats } from '../../engine/stats/stats'
import type { League, Ratings, StatLine } from '../../engine/types'
import { archetypeFor } from '../../engine/player/archetype'
import { gradeFor } from '../../engine/player/grades'
import { OvrChart } from '../components/OvrChart'
import { playerAwards } from '../../engine/stories/awards'
import { fanOf } from '../../engine/stories/sentiment'
import { ratingColor } from '../ratingColor'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { isFreeAgent, tradesOpen } from '../../engine/gm/cap'
import { fullName, heightStr, money, one, ovrOf, teamFull } from '../util'

const GROUPS: [string, [keyof Ratings, string][]][] = [
  ['Offense', [['ins', 'Inside scoring'], ['mid', 'Mid-range'], ['three', 'Three-point'], ['ft', 'Free throw'], ['pass', 'Passing'], ['handle', 'Ball handling'], ['oreb', 'Offensive rebounding']]],
  ['Defense', [['perD', 'Perimeter defense'], ['intD', 'Interior defense'], ['stl', 'Steals'], ['blk', 'Blocks'], ['dreb', 'Defensive rebounding']]],
  ['Physical', [['ath', 'Athleticism'], ['stam', 'Stamina'], ['iq', 'Basketball IQ']]],
]

function sumLines(lines: StatLine[]): StatLine | null {
  if (!lines.length) return null
  const out = { ...lines[0] }
  for (const l of lines.slice(1)) for (const k of Object.keys(l) as (keyof StatLine)[]) if (typeof l[k] === 'number' && k !== 'season') (out[k] as number) += l[k] as number
  return out
}

function seasonsTable(league: League, playerId: string, playoffs: boolean) {
  const seasons = [...new Set(Object.values(league.statLines).filter((s) => s.playerId === playerId && s.playoffs === playoffs).map((s) => s.season))].sort()
  const rows = seasons.map((season) => playerSeasonStats(league, playerId, season, playoffs)!)
  const career = sumLines(rows)
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>{playoffs ? 'No playoff games yet.' : 'No games played yet.'}</p>
  const line = (label: React.ReactNode, s: StatLine, key: string, teamCell: React.ReactNode) => {
    const pg = perGame(s)
    return (
      <tr key={key}>
        <td>{label}</td><td className="left">{teamCell}</td><td>{s.gp}</td><td>{s.gs}</td><td>{one(pg.min)}</td><td>{one(pg.pts)}</td><td>{one(pg.reb)}</td><td>{one(pg.ast)}</td>
        <td>{one(pg.stl)}</td><td>{one(pg.blk)}</td><td>{one(pg.tov)}</td><td>{(pg.fgPct * 100).toFixed(1)}</td><td>{(pg.tpPct * 100).toFixed(1)}</td><td>{(pg.ftPct * 100).toFixed(1)}</td>
      </tr>
    )
  }
  return (
    <div className="table-wrap">
      <table className="stats">
        <thead><tr><th>Season</th><th className="left">Team</th><th>GP</th><th>GS</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG%</th><th>3P%</th><th>FT%</th></tr></thead>
        <tbody>{rows.map((s) => line(s.season, s, String(s.season), <Link className="link" to={`/team/${s.teamId}`}>{league.teams[s.teamId]?.abbrev ?? '—'}</Link>))}</tbody>
        {career && rows.length > 1 && <tfoot>{line('Career', career, 'career', '')}</tfoot>}
      </table>
    </div>
  )
}

export function PlayerPage() {
  const { id } = useParams()
  const league = useStore((s) => s.league)!
  const p = id ? league.players[id] : undefined
  if (!p) return <Navigate to="/" replace />
  const team = p.teamId ? league.teams[p.teamId] : null
  const colors = team?.colors ?? { primary: '#5b6378', secondary: '#ffffff' }
  const ovr = ovrOf(p)
  const seasonStart = p.ratingHistory.find((h) => h.season === league.season)?.ovr ?? ovr
  const delta = ovr - seasonStart
  const awards = playerAwards(league, p.id)
  const hof = league.hof.find((h) => h.playerId === p.id)
  const highs = league.careerHighs[p.id]
  const moves = league.transactions.filter((t) => t.playerIds.includes(p.id)).slice(-12).reverse()
  const fans = fanOf(league, p.id)
  const chartPoints = [...p.ratingHistory.map((h) => ({ label: `S${h.season}`, ovr: h.ovr })), ...(delta !== 0 ? [{ label: 'Now', ovr }] : [])]
  return (
    <div className="stack">
      <div className="page-head" style={{ background: `linear-gradient(110deg, ${colors.primary} 55%, ${colors.secondary})` }}>
        <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: '0.4rem 0.6rem 0' }}>
          <Face seed={p.faceSeed} age={p.age} colors={colors} size={110} jersey={p.jersey} title={fullName(p)} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="title">{fullName(p)}</div>
          <div className="sub">#{p.jersey} · {p.pos} · {team ? teamFull(team) : p.retired ? 'Retired' : league.draftRights[p.id] ? `Draft rights: ${league.teams[league.draftRights[p.id]].name}` : 'Free agent'}</div>
          <span className="archetype-chip">{archetypeFor(p)}</span>
          {hof && <span className="archetype-chip hof-chip">🎖️ Hall of Fame · S{hof.season}</span>}
          {p.injury && <div style={{ marginTop: '0.4rem', fontWeight: 700 }}>🤕 {p.injury.type} — {p.injury.gamesRemaining >= 999 ? 'out for the season' : `out ${p.injury.gamesRemaining} more game${p.injury.gamesRemaining === 1 ? '' : 's'}`}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="big-num" style={{ color: ratingColor(ovr), textShadow: '0 1px 0 rgba(0,0,0,0.35)', background: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: '0.2rem 0.6rem' }}>{ovr}</div>
          <div className="sub">Overall {gradeFor(ovr)} · potential {gradeFor(p.pot)}</div>
          {delta !== 0 && <div className={delta > 0 ? 'delta-up' : 'delta-down'} style={{ color: '#fff' }}>{delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} this season</div>}
        </div>
      </div>

      {!p.retired && (team ? team.id !== league.userTeamId && tradesOpen(league) : isFreeAgent(league, p)) && (
        <div className="row">
          {team
            ? <Link className="btn btn-primary" style={{ textDecoration: 'none' }} to={`/trade?team=${team.id}&get=${p.id}`}>🔄 Trade for {p.lastName}</Link>
            : <Link className="btn btn-primary" style={{ textDecoration: 'none' }} to="/free-agents">✍️ Make an offer</Link>}
        </div>
      )}

      <section className="panel">
        <dl className="facts">
          <div><dt>Age</dt><dd>{p.age}</dd></div>
          <div><dt>Height</dt><dd>{heightStr(p.heightIn)}</dd></div>
          <div><dt>Hometown</dt><dd>{p.hometown}</dd></div>
          <div><dt>College</dt><dd>{p.college}</dd></div>
          <div><dt>Team</dt><dd>{team ? <Link className="link" to={`/team/${team.id}`}>{teamFull(team)}</Link> : 'Free agent'}</dd></div>
          <div><dt>Contract</dt><dd>{p.contract ? `${money(p.contract.salary)} through season ${p.contract.expires}` : 'None'}</dd></div>
          {!p.retired && <div><dt>Morale</dt><dd>{p.morale >= 70 ? '😄' : p.morale >= 45 ? '🙂' : p.morale >= 30 ? '😕' : '😠'} {p.morale}</dd></div>}
          {!p.retired && <div><dt>Fans</dt><dd>{fans > 25 ? '🔥 Loved' : fans < -25 ? '🥶 Getting roasted' : '😐 Neutral'} ({fans > 0 ? '+' : ''}{fans})</dd></div>}
          {highs && <div><dt>Career highs</dt><dd>{highs.pts} pts · {highs.reb} reb · {highs.ast} ast</dd></div>}
          <div><dt>Draft</dt><dd>{p.draft ? `Season ${p.draft.season}, round ${p.draft.round}, pick ${p.draft.pick}` : p.ratingHistory[0].season > 1 ? 'Undrafted' : 'Original roster'}</dd></div>
        </dl>
      </section>

      {awards.length > 0 && (
        <section className="panel stack">
          <h2>🏅 Awards</h2>
          <div className="chips">{awards.map((a, i) => <span key={i} className="chip on" style={{ cursor: 'default' }}>S{a.season} · {a.label}</span>)}</div>
        </section>
      )}

      <section className="panel stack">
        <h2>Ratings</h2>
        <div className="ratings">
          {GROUPS.map(([g, keys]) => (
            <div key={g} className="stack" style={{ gap: '0.55rem' }}>
              <h3>{g}</h3>
              {keys.map(([k, label]) => (
                <div key={k} className="rating-row">
                  <span>{label}</span>
                  <span className="grade">{gradeFor(p.ratings[k])}</span>
                  <strong style={{ textAlign: 'right' }}>{p.ratings[k]}</strong>
                  <div className="rating-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, (p.ratings[k] - 40) / 59) * 100}%`, background: ratingColor(p.ratings[k]) }} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h2>Overall by season</h2>
        <OvrChart points={chartPoints} />
      </section>

      <section className="panel stack">
        <h2>Regular season</h2>
        {seasonsTable(league, p.id, false)}
        <h2>Playoffs</h2>
        {seasonsTable(league, p.id, true)}
      </section>

      {moves.length > 0 && (
        <section className="panel stack">
          <h2>Transactions</h2>
          <ul className="tx-list">{moves.map((t, i) => <li key={i}><span className="muted">S{t.season}{t.phase === 'offseason' ? ' offseason' : ` · day ${t.day}`}:</span> {t.text}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
