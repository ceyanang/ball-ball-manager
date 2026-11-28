import { Link, Navigate } from 'react-router-dom'
import { buildSummary } from '../../../engine/career/endings'
import { useStore } from '../../store'

/** The epilogue: a templated ending chosen from the career, plus the numbers it was built from. */
export function Ending() {
  const league = useStore((s) => s.league)!
  const c = league.career
  if (!c || c.status !== 'retired' || !c.ending) return <Navigate to="/" replace />
  const s = buildSummary(league)
  return (
    <div className="stack cd-ending" style={{ maxWidth: '40rem' }}>
      <h1>{c.ending.title}</h1>
      <div className="panel stack">
        {c.ending.lines.map((line, i) => <p key={i} style={{ margin: 0 }}>{line}</p>)}
      </div>
      <div className="panel row cd-stats" style={{ flexWrap: 'wrap', gap: '1.5rem' }}>
        <span>Seasons <b className="num">{s.seasons}</b></span>
        <span>Titles <b className="num">{s.titles}</b></span>
        <span>Points <b className="num">{s.points.toLocaleString()}</b></span>
        <span>Peak Career OVR <b className="num">{s.peakOvr}</b></span>
        <span>All-League <b className="num">{s.allLeague}</b></span>
      </div>
      <div className="row cd-actions" style={{ flexWrap: 'wrap' }}>
        <Link className="btn" to={`/player/${c.playerId}`}>His player page</Link>
        <Link className="btn" to="/history">League history</Link>
        <Link className="btn btn-primary" to="/new">Start a new game</Link>
      </div>
    </div>
  )
}
