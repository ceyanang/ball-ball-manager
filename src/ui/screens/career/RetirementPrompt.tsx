import { useStore } from '../../store'

/** The retirement question: shown over everything while one is waiting. A forced prompt has only one answer. */
export function RetirementPrompt() {
  const league = useStore((s) => s.league)
  const retire = useStore((s) => s.retire)
  const busy = useStore((s) => s.busy)
  const r = league?.career?.retirement
  if (!league || !r) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Retirement" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem' }}>
      <div className="panel stack" style={{ maxWidth: '30rem', width: '100%' }}>
        <h2 style={{ margin: 0 }}>{r.kind === 'forced' ? 'It’s over.' : 'Is it time?'}</h2>
        <p style={{ margin: 0 }}>{r.text}</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => retire('accept')}>Retire</button>
          {r.kind === 'suggest' && <button className="btn" disabled={busy} onClick={() => retire('refuse')}>One more year</button>}
        </div>
      </div>
    </div>
  )
}
