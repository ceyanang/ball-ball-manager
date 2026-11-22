import { ROSTER_MAX, ROSTER_MIN, SALARY_CAP } from '../../engine/constants'
import { capSeason, committed, deadMoneyFor, payroll } from '../../engine/gm/cap'
import type { League } from '../../engine/types'
import { money } from '../util'

/** Payroll against the hard cap, plus roster count — the two numbers every GM move is checked against. */
export function CapBar({ league, teamId }: { league: League; teamId: string }) {
  const pay = payroll(league, teamId)
  const dead = deadMoneyFor(league, teamId)
  const n = committed(league, teamId).length
  const pct = Math.min(100, (pay / SALARY_CAP) * 100)
  const deadPct = Math.min(100, (dead / SALARY_CAP) * 100)
  const room = SALARY_CAP - pay
  return (
    <div className="capbar">
      <div className="capbar-top">
        <span><strong>{money(pay)}</strong> <span className="muted">of {money(SALARY_CAP)} cap · season {capSeason(league)}</span></span>
        <span className={room < 3000 ? 'loss' : 'win'}>{money(room)} room</span>
      </div>
      <div className="capbar-track" role="meter" aria-valuemin={0} aria-valuemax={SALARY_CAP} aria-valuenow={pay} aria-label="Payroll">
        <div className="capbar-fill" style={{ width: `${pct}%` }} />
        {dead > 0 && <div className="capbar-dead" style={{ width: `${deadPct}%` }} title={`Dead money ${money(dead)}`} />}
      </div>
      <div className="capbar-bottom muted">
        <span className={n < ROSTER_MIN || n > ROSTER_MAX ? 'loss' : ''}>{n} players under contract ({ROSTER_MIN}–{ROSTER_MAX})</span>
        {dead > 0 && <span>Dead money {money(dead)}</span>}
      </div>
    </div>
  )
}
