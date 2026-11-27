import { Face } from '../../face/Face'
import { TeamBadge } from '../../components/TeamBadge'
import { useStore } from '../../store'

/** The loud pop-up for a trade or a cut: shown over every page (but never over a game being watched) until dismissed. */
export function CareerAlert() {
  const league = useStore((s) => s.league)
  const watching = useStore((s) => !!s.watch)
  const act = useStore((s) => s.act)
  const alert = league?.career?.alert
  if (!league?.career || !alert || watching) return null
  const p = league.players[league.career.playerId]
  const from = league.teams[alert.fromTeamId]
  const to = alert.toTeamId ? league.teams[alert.toTeamId] : null
  const colors = (to ?? from).colors
  return (
    <div role="dialog" aria-modal="true" aria-label={alert.title} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'grid', placeItems: 'center', zIndex: 60, padding: '1rem' }}>
      <div className="panel stack" style={{ maxWidth: '30rem', width: '100%', textAlign: 'center', alignItems: 'center' }}>
        <div className="muted" style={{ letterSpacing: '0.1em', fontWeight: 700 }}>{alert.kind === 'trade' ? '🔔 BREAKING · TRADE' : '🔔 BREAKING · CUT'}</div>
        <Face seed={p.faceSeed} age={p.age} colors={colors} size={96} jersey={p.jersey} title={`${p.firstName} ${p.lastName}`} />
        <h2 style={{ margin: 0 }}>{alert.title}</h2>
        {to && (
          <div className="row" style={{ justifyContent: 'center', gap: '1rem' }}>
            <TeamBadge team={from} /> <span aria-hidden="true">➜</span> <TeamBadge team={to} />
          </div>
        )}
        {alert.lines.map((t, i) => <div key={i}>{t}</div>)}
        <button className="btn btn-primary" onClick={() => act((l) => { if (l.career) l.career.alert = null }, { career: true })}>Got it</button>
      </div>
    </div>
  )
}
