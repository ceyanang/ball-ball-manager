import { useState } from 'react'
import { MAX_SALARY, MIN_SALARY } from '../../engine/constants'

/** Salary (in $M) + years, prefilled with the player's ask. */
export function OfferForm({ ask, years, label = 'Offer', onSubmit, onCancel }: {
  ask: number; years: number; label?: string; onSubmit: (salary: number, years: number) => void; onCancel: () => void
}) {
  const [m, setM] = useState((ask / 1000).toFixed(1))
  const [y, setY] = useState(years)
  const salary = Math.round(Number(m) * 10) * 100
  const valid = Number.isFinite(salary) && salary >= MIN_SALARY && salary <= MAX_SALARY
  return (
    <form className="offer-form" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(salary, y) }}>
      <label>$<input type="number" inputMode="decimal" step="0.1" min={MIN_SALARY / 1000} max={MAX_SALARY / 1000} value={m} onChange={(e) => setM(e.target.value)} aria-label="Salary in millions per year" />M/yr</label>
      <label><select value={y} onChange={(e) => setY(Number(e.target.value))} aria-label="Years">
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} yr{n > 1 ? 's' : ''}</option>)}
      </select></label>
      <button className="btn btn-primary" disabled={!valid}>{label}</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
    </form>
  )
}
