import { useStore } from '../store'

export function SimControls() {
  const league = useStore((s) => s.league)
  const busy = useStore((s) => s.busy)
  const sim = useStore((s) => s.sim)
  if (!league) return null
  if (league.phase === 'offseason')
    return <p className="muted" style={{ margin: 0 }}>Season complete — offseason arrives in the next update.</p>
  return (
    <div className="sim-controls" aria-busy={busy}>
      {league.phase === 'regular' && (
        <>
          <button className="btn" disabled={busy} onClick={() => sim({ type: 'simDays', days: 1 })}>Sim day</button>
          <button className="btn" disabled={busy} onClick={() => sim({ type: 'simDays', days: 7 })}>Sim week</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => sim({ type: 'simUntil', target: 'regularEnd' })}>Sim to end of season</button>
        </>
      )}
      {league.phase === 'playoffs' && (
        <>
          <button className="btn" disabled={busy} onClick={() => sim({ type: 'simDays', days: 1 })}>Sim day</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => sim({ type: 'simUntil', target: 'playoffsEnd' })}>Sim playoffs</button>
        </>
      )}
      {busy && <span className="spinner" role="status" aria-label="Simulating" />}
    </div>
  )
}
