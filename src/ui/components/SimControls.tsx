import { Link } from 'react-router-dom'
import { committed } from '../../engine/gm/cap'
import { ROSTER_MAX, ROSTER_MIN } from '../../engine/constants'
import type { League } from '../../engine/types'
import { useStore } from '../store'

/** The user can't sim with an illegal roster (spec §10). */
function rosterProblem(l: League): string | null {
  const n = committed(l, l.userTeamId).length
  if (n < ROSTER_MIN) return `You need ${ROSTER_MIN} players to play (you have ${n}).`
  if (n > ROSTER_MAX) return `You have ${n} players; the max is ${ROSTER_MAX}.`
  return null
}

export function SimControls() {
  const league = useStore((s) => s.league)
  const busy = useStore((s) => s.busy)
  const sim = useStore((s) => s.sim)
  if (!league) return null
  if (league.phase === 'offseason') {
    const step = league.offseason?.step
    const label: Record<string, string> = { awards: 'Awards', recap: 'Recap', lottery: 'Lottery', draft: 'Draft', resign: 'Re-signing', freeAgency: `Free agency day ${league.offseason?.faDay}`, ready: 'Ready to start' }
    return (
      <div className="sim-controls">
        <span className="muted">{step ? label[step] : ''}</span>
        <Link className="btn btn-primary" to="/offseason" style={{ textDecoration: 'none' }}>Offseason →</Link>
      </div>
    )
  }
  const userProblem = rosterProblem(league)
  return (
    <div className="sim-controls" aria-busy={busy}>
      {userProblem && <Link to="/free-agents" className="loss" style={{ fontWeight: 600 }}>⚠️ {userProblem}</Link>}
      {league.phase === 'regular' && (
        <>
          <button className="btn" disabled={busy || !!userProblem} onClick={() => sim({ type: 'simDays', days: 1 })}>Sim day</button>
          <button className="btn" disabled={busy || !!userProblem} onClick={() => sim({ type: 'simDays', days: 7 })}>Sim week</button>
          {league.day < league.tradeDeadlineDay && <button className="btn" disabled={busy || !!userProblem} onClick={() => sim({ type: 'simUntil', target: 'deadline' })}>Sim to deadline</button>}
          <button className="btn btn-primary" disabled={busy || !!userProblem} onClick={() => sim({ type: 'simUntil', target: 'regularEnd' })}>Sim to end of season</button>
        </>
      )}
      {league.phase === 'playoffs' && (
        <>
          <button className="btn" disabled={busy || !!userProblem} onClick={() => sim({ type: 'simDays', days: 1 })}>Sim day</button>
          <button className="btn btn-primary" disabled={busy || !!userProblem} onClick={() => sim({ type: 'simUntil', target: 'playoffsEnd' })}>Sim playoffs</button>
        </>
      )}
      {busy && <span className="spinner" role="status" aria-label="Simulating" />}
    </div>
  )
}
