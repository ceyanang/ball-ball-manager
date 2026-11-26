import { useState } from 'react'
import { Link } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { SubNav } from '../components/SubNav'
import { TeamBadge } from '../components/TeamBadge'
import { LEAGUE_SUBNAV } from '../nav'
import { useStore } from '../store'
import { rowPct } from '../util'

export function Standings() {
  const league = useStore((s) => s.league)!
  const [full, setFull] = useState(false)
  const st = computeStandings(league, league.season)
  const hide = full ? undefined : 'm-hide'
  return (
    <div className="stack">
      <SubNav items={LEAGUE_SUBNAV} label="League sections" />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Standings</h1>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="seg m-show" role="group" aria-label="Standings detail">
            <button className="btn" aria-pressed={!full} onClick={() => setFull(false)}>Compact</button>
            <button className="btn" aria-pressed={full} onClick={() => setFull(true)}>Full stats</button>
          </div>
          <Link to="/playoffs" className="btn">Playoff picture</Link>
        </div>
      </div>
      {(['East', 'West'] as const).map((conf) => (
        <section key={conf} className="panel stack">
          <h2>{conf}</h2>
          <div className="table-wrap">
            <table className="stats" style={full ? undefined : { fontSize: 'clamp(0.76rem, 2.2vw, 0.88rem)' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="left">Team</th>
                  <th><span className={hide}>W</span>{!full && <span className="m-show">W-L</span>}</th>
                  <th className={hide}>L</th>
                  <th>PCT</th>
                  <th>GB</th>
                  <th className={hide}>CONF</th>
                  <th className={hide}>HOME</th>
                  <th className={hide}>AWAY</th>
                  <th className={hide}>PF/G</th>
                  <th className={hide}>PA/G</th>
                  <th>DIFF</th>
                  <th>STRK</th>
                  <th className={hide}>L10</th>
                </tr>
              </thead>
              <tbody>
                {st[conf].map((r, i) => {
                  const t = league.teams[r.teamId]
                  const played = r.w + r.l > 0
                  const gp = r.w + r.l || 1
                  const diff = (r.pf - r.pa) / gp
                  return (
                    <tr key={r.teamId} className={[r.teamId === league.userTeamId ? 'me' : '', i === 7 ? 'cut' : ''].join(' ')}>
                      <td>{played ? i + 1 : '—'}</td>
                      <td className="left">
                        <Link className="link row" style={{ gap: '0.4rem' }} to={`/team/${t.id}`}>
                          <TeamBadge team={t} size={22} />
                          <span><span className={full ? undefined : 'm-hide'}>{t.city} </span>{t.name}</span>
                        </Link>
                      </td>
                      <td>
                        <span className={hide}>{r.w}</span>
                        {!full && <span className="m-show">{r.w}-{r.l}</span>}
                      </td>
                      <td className={hide}>{r.l}</td>
                      <td>{rowPct(r)}</td>
                      <td>{r.gb === 0 ? '—' : r.gb.toFixed(1)}</td>
                      <td className={hide}>{r.confW}-{r.confL}</td>
                      <td className={hide}>{r.home[0]}-{r.home[1]}</td>
                      <td className={hide}>{r.away[0]}-{r.away[1]}</td>
                      <td className={hide}>{played ? (r.pf / gp).toFixed(1) : '—'}</td>
                      <td className={hide}>{played ? (r.pa / gp).toFixed(1) : '—'}</td>
                      <td className={diff > 0 ? 'win' : diff < 0 ? 'loss' : ''}>{played ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}` : '—'}</td>
                      <td>{r.streak || '—'}</td>
                      <td className={hide}>{r.last10}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Top 8 make the playoffs (dashed line).</p>
        </section>
      ))}
    </div>
  )
}
