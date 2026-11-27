import { MAX_SALARY } from '../../../engine/constants'
import { money, teamFull } from '../../util'
import { useStore } from '../../store'

/** The contract decision: shown over everything, and nothing moves until he picks. */
export function ContractChoice() {
  const league = useStore((s) => s.league)
  const choose = useStore((s) => s.chooseOffer)
  const busy = useStore((s) => s.busy)
  const offers = league?.career?.offers
  if (!league || !offers?.length) return null
  const p = league.players[league.career!.playerId]
  return (
    <div role="dialog" aria-modal="true" aria-label="Contract decision" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem', overflowY: 'auto' }}>
      <div className="panel stack" style={{ maxWidth: '34rem', width: '100%' }}>
        <h2 style={{ margin: 0 }}>{p.teamId ? 'Your contract is up' : 'You’re a free agent'}</h2>
        <p className="muted" style={{ margin: 0 }}>Where you play is your call. Every team’s offer is below; the minimum deal is always there if you need a way in.</p>
        <div className="stack">
          {offers.map((o, i) => (
            <button key={i} className="btn" disabled={busy} onClick={() => choose(i)} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', textAlign: 'left' }}>
              <span><b>{teamFull(league.teams[o.teamId])}</b><br /><span className="muted">{o.note}</span></span>
              <span className="num">{money(Math.min(o.salary, MAX_SALARY))}/yr<br /><span className="muted">{o.years} yr{o.years > 1 ? 's' : ''}</span></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
