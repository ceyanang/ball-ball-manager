import { retiredByLines } from '../components/JerseyRafters'
import { Link, Navigate, useParams } from 'react-router-dom'
import { perGame, playerSeasonStats } from '../../engine/stats/stats'
import type { League, StatLine } from '../../engine/types'
import { RATING_GROUPS } from '../playerFilter'
import { RATING_MAX, RATING_MIN, groupAverage } from '../../engine/player/ratings'
import { PILLAR_KEYS, PILLAR_LABELS, generatePlayerArchetype } from '../../engine/player/archetype'
import { gradeFor } from '../../engine/player/grades'
import { OvrChart } from '../components/OvrChart'
import { AwardChips } from '../components/AwardChips'
import { playerAwards } from '../../engine/stories/awards'
import { TRAINING_SLOTS, isTraining, startTraining, stopTraining } from '../../engine/gm/training'
import { fanBreakdown, fanLabel, fanOf } from '../../engine/stories/sentiment'
import { ratingColor } from '../ratingColor'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { isFreeAgent, tradesOpen } from '../../engine/gm/cap'
import { fullName, heightStr, money, moodOf, one, ovrOf, teamFull } from '../util'

const GROUPS = RATING_GROUPS

function sumLines(lines: StatLine[]): StatLine | null {
  if (!lines.length) return null
  const out = { ...lines[0] }
  for (const l of lines.slice(1)) for (const k of Object.keys(l) as (keyof StatLine)[]) if (typeof l[k] === 'number' && k !== 'season') (out[k] as number) += l[k] as number
  return out
}

function seasonsTable(league: League, playerId: string, playoffs: boolean) {
  const seasons = [...new Set(Object.values(league.statLines).filter((s) => s.playerId === playerId && s.playoffs === playoffs).map((s) => s.season))].sort((a, b) => a - b)
  const rows = seasons.map((season) => playerSeasonStats(league, playerId, season, playoffs)!)
  const career = sumLines(rows)
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>{playoffs ? 'No playoff games yet.' : 'No games played yet.'}</p>
  const line = (label: React.ReactNode, s: StatLine, key: string, teamCell: React.ReactNode) => {
    const pg = perGame(s)
    return (
      <tr key={key}>
        <td className="m-main"><span className="m-show muted" style={{ fontSize: '0.78rem', marginRight: '0.3rem' }}>{typeof label === 'number' ? 'Season' : ''}</span><strong>{label}</strong></td>
        <td className="left m-act">{teamCell}</td>
        <td data-label="GP">{s.gp}</td>
        <td data-label="GS">{s.gs}</td>
        <td data-label="MIN">{one(pg.min)}</td>
        <td className="m-key" data-label="PTS">{one(pg.pts)}</td>
        <td className="m-key" data-label="REB">{one(pg.reb)}</td>
        <td className="m-key" data-label="AST">{one(pg.ast)}</td>
        <td data-label="STL">{one(pg.stl)}</td>
        <td data-label="BLK">{one(pg.blk)}</td>
        <td data-label="TO">{one(pg.tov)}</td>
        <td data-label="FG%">{(pg.fgPct * 100).toFixed(1)}</td>
        <td data-label="3P%">{(pg.tpPct * 100).toFixed(1)}</td>
        <td data-label="FT%">{(pg.ftPct * 100).toFixed(1)}</td>
      </tr>
    )
  }
  return (
    <div className="table-wrap">
      <table className="stats m-cards">
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
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const act = useStore((s) => s.act)
  const p = id && Object.hasOwn(league.players, id) ? league.players[id] : undefined
  if (!p) return <Navigate to="/" replace />
  const fav = league.favoritePlayerIds.includes(p.id)
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
  const fanWhy = p.retired ? [] : fanBreakdown(league, p)
  const arch = generatePlayerArchetype(p)
  const chartPoints = [...p.ratingHistory.map((h) => ({ label: `S${h.season}`, ovr: h.ovr })), ...(delta !== 0 ? [{ label: 'Now', ovr }] : [])]
  return (
    <div className="stack">
      <div className="page-head" style={{ background: `linear-gradient(110deg, ${colors.primary} 55%, ${colors.secondary})` }}>
        <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: '0.4rem 0.6rem 0' }}>
          <Face seed={p.faceSeed} age={p.age} colors={colors} size={110} jersey={p.jersey} title={fullName(p)} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="title">{fullName(p)}</h1>
          <div className="sub">#{p.jersey} · {p.pos} · {team ? teamFull(team) : p.retired ? 'Retired' : league.draftRights[p.id] ? `Draft rights: ${league.teams[league.draftRights[p.id]].name}` : 'Free agent'}</div>
          <span className="archetype-chip">{arch.title}</span>
          {hof && <span className="archetype-chip hof-chip">🎖️ Hall of Fame · S{hof.season}</span>}
          {retiredByLines(league, p.id).map((t) => <span key={t} className="archetype-chip hof-chip">👕 {t}</span>)}
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn" onClick={() => toggleFavorite(p.id)} aria-pressed={fav} style={fav ? { borderColor: 'var(--gold)' } : undefined}>{fav ? '⭐ Your guy' : '☆ Favorite'}</button>
            {p.teamId === league.userTeamId && !p.retired && (isTraining(league, p.id)
              ? <button className="btn" style={{ marginLeft: '0.4rem', borderColor: 'var(--win)' }} onClick={() => act((l) => stopTraining(l, p.id))}>🌱 In development · stop</button>
              : <button className="btn" style={{ marginLeft: '0.4rem' }} onClick={() => act((l) => startTraining(l, p.id))} title={`${TRAINING_SLOTS} slots`}>🌱 Invest in development</button>)}
          </div>
          {p.injury && <div style={{ marginTop: '0.4rem', fontWeight: 700 }}>🤕 {p.injury.type} — {p.injury.gamesRemaining >= 999 ? 'out for the season' : `out ${p.injury.gamesRemaining} more game${p.injury.gamesRemaining === 1 ? '' : 's'}`}</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="big-num" style={{ color: ratingColor(ovr), textShadow: '0 1px 0 rgba(0,0,0,0.35)', background: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: '0.2rem 0.6rem' }}>{ovr}</div>
          <div className="sub">Overall {ovr} · potential {p.pot}</div>
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
          <div><dt>Team</dt><dd>{team ? <Link className="link" to={`/team/${team.id}`}>{teamFull(team)}</Link> : p.retired ? 'Retired' : 'Free agent'}</dd></div>
          <div><dt>Contract</dt><dd>{p.contract ? `${money(p.contract.salary)} through season ${p.contract.expires}` : 'None'}</dd></div>
          {!p.retired && <div><dt>Morale</dt><dd>{moodOf(p.morale).emoji} {p.morale}</dd></div>}
          {!p.retired && <div><dt>Fans</dt><dd>{fanLabel(fans).emoji} {fanLabel(fans).text} ({fans > 0 ? '+' : ''}{fans}){fanWhy.length > 0 && <div className="muted" style={{ fontSize: '0.8rem' }}>{fanWhy.slice(0, 4).map((f) => `${f.label} ${f.value > 0 ? '+' : ''}${f.value}`).join(' · ')}</div>}</dd></div>}
          {highs && <div><dt>Career highs</dt><dd>{highs.pts} pts · {highs.reb} reb · {highs.ast} ast</dd></div>}
          <div><dt>Draft</dt><dd>{p.draft ? `Season ${p.draft.season}, round ${p.draft.round}, pick ${p.draft.pick}` : p.ratingHistory[0].season > 1 ? 'Undrafted' : 'Original roster'}</dd></div>
        </dl>
      </section>

      {awards.length > 0 && (
        <section className="panel stack">
          <h2>🏅 Awards</h2>
          <AwardChips awards={awards} />
        </section>
      )}

      <section className="panel stack">
        <h2>Ratings</h2>
        <div className="stack" style={{ gap: '0.35rem' }}>
          <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>2K Archetype Pillars · {arch.title}</span>
          <div className="cat-pills">
            {PILLAR_KEYS.map((k) => {
              const v = arch.pillars[k]
              return (
                <span key={k} className={`cat-pill${arch.topPillar === k ? ' pillar-top' : ''}`}>
                  <span className="muted">{PILLAR_LABELS[k]}</span>
                  <strong style={{ color: ratingColor(v) }}>{gradeFor(v)} · {v}</strong>
                </span>
              )
            })}
          </div>
        </div>
        <div className="cat-pills">
          {GROUPS.map(([g]) => {
            const avg = groupAverage(p.ratings, g)
            return (
              <span key={g} className="cat-pill">
                <span className="muted">{g}</span>
                <strong style={{ color: ratingColor(avg) }}>{avg}</strong>
              </span>
            )
          })}
        </div>
        <div className="ratings">
          {GROUPS.map(([g, keys]) => {
            const avg = groupAverage(p.ratings, g)
            return (
              <div key={g} className="stack" style={{ gap: '0.55rem' }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3>{g}</h3>
                  <span className="grade" style={{ color: ratingColor(avg) }}>{gradeFor(avg)} · {avg}</span>
                </div>
                {keys.map(([k, label]) => (
                  <div key={k} className="rating-row">
                    <span>{label}</span>
                    <span className="grade">{gradeFor(p.ratings[k])}</span>
                    <strong style={{ textAlign: 'right' }}>{p.ratings[k]}</strong>
                    <div className="rating-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(0, ((p.ratings[k] - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100)}%`, background: ratingColor(p.ratings[k]) }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
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
