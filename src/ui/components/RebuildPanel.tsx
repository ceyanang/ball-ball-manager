import { useState } from 'react'
import { Link } from 'react-router-dom'
import { applyAutoMoves, planAuto, type AutoMove } from '../../engine/gm/autosign'
import { emergencyRebuild, REBUILD_SELL_AGE, REBUILD_YOUTH_AGE, rebuildCandidates, rebuildProblem, type RebuildDeal } from '../../engine/gm/rebuild'
import { assetLabel } from '../../engine/gm/trade'
import type { League } from '../../engine/types'
import { useStore } from '../store'
import { fullName, money, ovrOf } from '../util'

/** Offseason "blow it up" button: the AI sells your vets for youngsters and picks in one go. */
export function RebuildPanel({ league }: { league: League }) {
  const act = useStore((s) => s.act)
  const busy = useStore((s) => s.busy)
  const [deals, setDeals] = useState<RebuildDeal[] | null>(null)
  const [snap, setSnap] = useState<League | null>(null)
  const [signed, setSigned] = useState<AutoMove[]>([])

  const fa = league.offseason?.step === 'freeAgency' || league.offseason?.step === 'ready'

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
        {signed.length > 0 && (
          <>
            <h3 style={{ margin: 0 }}>🤖 Auto-signed for the rebuild</h3>
            <ul className="progress-list">
              {signed.map((m) => {
                const p = snap.players[m.playerId]
                return <li key={m.playerId}><span><Link className="link" to={`/player/${m.playerId}`}>{fullName(p)}</Link> <span className="muted">{p.pos} · {p.age}y · {m.reason}</span></span><span>{money(m.salary)} × {m.years}y{m.kind === 'sign' && snap.offseason?.step === 'freeAgency' ? ' (offer out)' : ''}</span></li>
              })}
            </ul>
          </>
        )}
        {deals.length > 0 && <p className="muted" style={{ margin: 0 }}>{fa ? 'Free agent offers get answered as the days go by.' : 'When free agency opens, 🤖 Auto-sign now shops like a rebuilder: your draft picks first, youngsters on long deals, vets on 1-year deals.'} Tank season starts now. 📉</p>}
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
    let auto: AutoMove[] = []
    let after: League | null = null
    const ok = act((l, rng) => {
      res = emergencyRebuild(l)
      // In free agency the front office refills the roster right away, rebuild-style.
      if (fa && res.length) {
        const plan = planAuto(l)
        applyAutoMoves(l, rng, plan)
        const me = l.userTeamId
        auto = plan.filter((m) => l.players[m.playerId].teamId === me || l.faOffers.some((o) => o.playerId === m.playerId && o.teamId === me))
      }
      after = structuredClone(l)
      return res.length ? `💥 Blew it up: ${res.length} trade${res.length > 1 ? 's' : ''} for youth and picks.` : 'Nobody bit. Nothing was moved.'
    })
    if (ok) { setDeals(res); setSigned(auto); setSnap(after) }
  }

  return (
    <section className="panel stack">
      <h2>🧨 Emergency rebuild</h2>
      <p style={{ margin: 0 }}>
        Stuck with aging vets? Let your front office sell everyone {REBUILD_SELL_AGE} and older, stars included, for players {REBUILD_YOUTH_AGE} and under and draft picks.
        Players {REBUILD_SELL_AGE - 1} and under stay. Once per offseason, and best done before the draft so new picks are used this year. Do it during free agency and the front office also auto-signs to refill the roster.
      </p>
      <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={go}>Blow it up ({sellable.length} up for sale)</button>
    </section>
  )
}
