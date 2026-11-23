import { Link } from 'react-router-dom'
import { computeStandings } from '../../engine/standings'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { rowPct } from '../util'

export function Standings() {
  const league = useStore((s) => s.league)!
  const st = computeStandings(league, league.season)
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Standings</h1>
        <Link to="/playoffs" className="btn">Playoff picture</Link>
      </div>
      {(['East', 'West'] as const).map((conf) => (
        <section key={conf} className="panel stack">
          <h2>{conf}</h2>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>#</th><th className="left">Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>CONF</th><th>HOME</th><th>AWAY</th><th>PF/G</th><th>PA/G</th><th>DIFF</th><th>STRK</th><th>L10</th></tr></thead>
              <tbody>
                {st[conf].map((r, i) => {
                  const t = league.teams[r.teamId]
                  const played = r.w + r.l > 0
                  const gp = r.w + r.l || 1
                  const diff = (r.pf - r.pa) / gp
                  return (
                    <tr key={r.teamId} className={[r.teamId === league.userTeamId ? 'me' : '', i === 7 ? 'cut' : ''].join(' ')}>
                      <td>{played ? i + 1 : '—'}</td>
                      <td className="left"><span className="row" style={{ gap: '0.5rem' }}><TeamBadge team={t} size={26} /><Link className="link" to={`/team/${t.id}`}>{t.city} {t.name}</Link></span></td>
                      <td>{r.w}</td><td>{r.l}</td><td>{rowPct(r)}</td><td>{r.gb === 0 ? '—' : r.gb.toFixed(1)}</td>
                      <td>{r.confW}-{r.confL}</td><td>{r.home[0]}-{r.home[1]}</td><td>{r.away[0]}-{r.away[1]}</td>
                      <td>{played ? (r.pf / gp).toFixed(1) : '—'}</td><td>{played ? (r.pa / gp).toFixed(1) : '—'}</td>
                      <td className={diff > 0 ? 'win' : diff < 0 ? 'loss' : ''}>{played ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}` : '—'}</td>
                      <td>{r.streak || '—'}</td><td>{r.last10}</td>
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
