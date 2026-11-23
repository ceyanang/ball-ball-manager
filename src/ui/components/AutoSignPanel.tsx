import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { applyAutoMoves, planAuto } from '../../engine/gm/autosign'
import { useStore } from '../store'
import { fullName, money } from '../util'
import { NeedDot } from './NeedDot'

/** Auto Sign / Re-sign: the game proposes moves (needs, age, form, value, reach 10); you uncheck any and confirm. */
export function AutoSignPanel({ resign }: { resign: boolean }) {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const busy = useStore((s) => s.busy)
  const [open, setOpen] = useState(false)
  const [off, setOff] = useState<Set<string>>(new Set())
  const moves = useMemo(() => (open ? planAuto(league) : []), [open, league])
  const chosen = moves.filter((m) => !off.has(m.playerId))
  const total = chosen.reduce((t, m) => t + m.salary, 0)
  const label = resign ? 'Auto re-sign' : 'Auto-sign'

  if (!open) return <button className="btn btn-primary" disabled={busy} onClick={() => { setOff(new Set()); setOpen(true) }}>🤖 {label}</button>
  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2>🤖 {label} preview</h2>
        <button className="btn" onClick={() => setOpen(false)}>Close</button>
      </div>
      {moves.length ? (
        <>
          <ul className="tx-list">
            {moves.map((m) => {
              const p = league.players[m.playerId]
              return (
                <li key={m.playerId}>
                  <label className="row" style={{ gap: '0.5rem' }}>
                    <input type="checkbox" checked={!off.has(m.playerId)} onChange={() => setOff((s) => { const n = new Set(s); n.has(m.playerId) ? n.delete(m.playerId) : n.add(m.playerId); return n })} />
                    <Link className="link" to={`/player/${m.playerId}`}>{fullName(p)}</Link>
                    <span className="muted">{p.pos} · {p.age}y</span>
                    <NeedDot level={m.before} after={m.after} />
                  </label>
                  <span>{money(m.salary)} × {m.years}y</span>
                  <span className="muted">{m.reason}</span>
                </li>
              )
            })}
          </ul>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted">{chosen.length} moves · {money(total)}/yr</span>
            <button className="btn btn-primary" disabled={busy || !chosen.length} onClick={() => {
              let fails: string[] = []
              const ok = act((l, rng) => {
                fails = applyAutoMoves(l, rng, chosen)
                return `🤖 ${label}: ${chosen.length - fails.length} done${fails.length ? `. ${fails.join(' ')}` : '.'}`
              })
              if (ok) setOpen(false)
            }}>Confirm {chosen.length}</button>
          </div>
        </>
      ) : <p className="muted">Nothing to do right now. Your roster is in good shape (or the cap leaves no room).</p>}
    </section>
  )
}
