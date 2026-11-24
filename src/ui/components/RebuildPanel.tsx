import { useState } from 'react'
import { Link } from 'react-router-dom'
import { emergencyRebuild, REBUILD_SELL_AGE, REBUILD_YOUTH_AGE, rebuildCandidates, rebuildProblem, type RebuildDeal } from '../../engine/gm/rebuild'
import { assetLabel } from '../../engine/gm/trade'
import type { League } from '../../engine/types'
import { useStore } from '../store'
import { fullName, ovrOf } from '../util'

/** Offseason "blow it up" button: the AI sells your vets for youngsters and picks in one go. */
export function RebuildPanel({ league }: { league: League }) {
  const act = useStore((s) => s.act)
  const busy = useStore((s) => s.busy)
  const [deals, setDeals] = useState<RebuildDeal[] | null>(null)
  const [snap, setSnap] = useState<League | null>(null)

  if (deals && snap) {
    const label = (a: RebuildDeal['got'][number]) => {
      if (a.kind === 'pick') return `🎟️ ${assetLabel(snap, a)}`
      const p = snap.players[a.id]
      return `${fullName(p)} (${p.age}, ${ovrOf(p)}/${p.pot})`
    }
    return (
      <section className="panel stack">
        <h2>💥 Rebuild done</h2>
        {deals.length ? (
          <ul className="progress-list">
            {deals.map((d) => (
              <li key={d.gave[0].id}>
                <span><Link className="link" to={`/player/${d.gave[0].id}`}>{d.gave.map(label).join(', ')}</Link> <span className="muted">→ {snap.teams[d.teamId].abbrev}</span></span>
                <span>{d.got.map(label).join(' + ')}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Nobody would give fair value for your vets. Nothing was moved.</p>}
        {deals.length > 0 && <p className="muted" style={{ margin: 0 }}>Fill out the roster in free agency. Tank season starts now. 📉</p>}
      </section>
    )
  }

  if (rebuildProblem(league)) return null
  const sellable = rebuildCandidates(league)
  if (!sellable.length) return null

  const go = () => {
    const names = sellable.slice(0, 4).map((p) => `${fullName(p)} (${ovrOf(p)})`).join(', ')
    if (!confirm(`Blow it up? Your front office will try to trade every player ${REBUILD_SELL_AGE}+ (${names}${sellable.length > 4 ? '…' : ''}) for youngsters and draft picks. You can only do this once per offseason and it can't be undone.`)) return
    let res: RebuildDeal[] = []
    let after: League | null = null
    const ok = act((l) => {
      res = emergencyRebuild(l)
      after = structuredClone(l)
      return res.length ? `💥 Blew it up: ${res.length} trade${res.length > 1 ? 's' : ''} for youth and picks.` : 'Nobody bit. Nothing was moved.'
    })
    if (ok) { setDeals(res); setSnap(after) }
  }

  return (
    <section className="panel stack">
      <h2>🧨 Emergency rebuild</h2>
      <p style={{ margin: 0 }}>
        Stuck with aging vets? Let your front office sell everyone {REBUILD_SELL_AGE} and older, stars included, for players {REBUILD_YOUTH_AGE} and under and draft picks.
        Players {REBUILD_SELL_AGE - 1} and under stay. Once per offseason, and best done before the draft so new picks are used this year.
      </p>
      <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={go}>Blow it up ({sellable.length} up for sale)</button>
    </section>
  )
}
