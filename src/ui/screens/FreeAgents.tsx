import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isFreeAgent } from '../../engine/gm/cap'
import { FA_DAYS, claimWaiver, currentAsk, offerFreeAgent } from '../../engine/gm/roster'
import { askYears, formOf } from '../../engine/gm/value'
import { archetypeFor } from '../../engine/player/archetype'
import { CapBar } from '../components/CapBar'
import { OfferForm } from '../components/OfferForm'
import { OvrPill } from '../components/OvrPill'
import { PlayerCell } from '../components/PlayerCell'
import { useStore } from '../store'
import { fullName, money, ovrOf } from '../util'

const POS = ['All', 'PG', 'SG', 'SF', 'PF', 'C']

export function FreeAgents() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const sim = useStore((s) => s.sim)
  const busy = useStore((s) => s.busy)
  const [open, setOpen] = useState<string | null>(null)
  const [pos, setPos] = useState('All')
  const me = league.userTeamId
  const os = league.offseason
  const faOpen = league.phase !== 'offseason' || os?.step === 'freeAgency'
  const perf = useMemo(() => formOf(league), [league])
  const fas = Object.values(league.players)
    .filter((p) => isFreeAgent(league, p) && (pos === 'All' || p.pos === pos))
    .sort((a, b) => ovrOf(b) - ovrOf(a))
    .slice(0, 80)
  const myOffers = league.faOffers.filter((o) => o.teamId === me)

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Free agents</h1>
        {os?.step === 'freeAgency' && (
          <div className="row">
            <span className="muted">Day {os.faDay} of {FA_DAYS}</span>
            <button className="btn" disabled={busy} onClick={() => sim({ type: 'faDays', days: 1 })}>Next day</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => sim({ type: 'faDays', days: FA_DAYS })}>Sim to end</button>
          </div>
        )}
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '72ch' }}>
        {league.phase === 'offseason'
          ? os?.step === 'freeAgency'
            ? 'Offers are decided at the end of each free-agency day. Players pick the best deal (money first, then winning and a real role), and asking prices drop 3% a day.'
            : 'Free agency opens after the draft and re-signing period. You can still claim players off waivers.'
          : 'In season, free agents decide on the spot: anything at 90% of their ask or more gets it done.'}
      </p>
      <CapBar league={league} teamId={me} />

      {league.waivers.length > 0 && (
        <section className="panel stack">
          <h2>On waivers</h2>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Player</th><th>From</th><th>OVR</th><th>Contract</th><th></th></tr></thead>
              <tbody>
                {league.waivers.map((w) => {
                  const p = league.players[w.playerId]
                  return (
                    <tr key={w.playerId}>
                      <td><PlayerCell league={league} p={p} subtitle={archetypeFor(p)} /></td>
                      <td>{league.teams[w.fromTeamId].abbrev}</td><td><OvrPill value={ovrOf(p)} /></td>
                      <td>{money(w.contract.salary)} through {w.contract.expires}</td>
                      <td>{w.fromTeamId !== me && <button className="btn" onClick={() => act((l) => { claimWaiver(l, me, p.id); return `You claimed ${fullName(p)}.` })}>Claim</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {myOffers.length > 0 && (
        <section className="panel stack">
          <h2>Your pending offers</h2>
          <ul className="tx-list">
            {myOffers.map((o) => (
              <li key={o.playerId}><Link className="link" to={`/player/${o.playerId}`}>{fullName(league.players[o.playerId])}</Link><span>{money(o.salary)} × {o.years} yrs</span><span className="muted">ask now {money(currentAsk(league, league.players[o.playerId], perf))}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2>Available</h2>
          <div className="seg">{POS.map((x) => <button key={x} className="btn" aria-pressed={pos === x} onClick={() => setPos(x)}>{x}</button>)}</div>
        </div>
        <div className="table-wrap">
          <table className="stats">
            <thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>Asking</th><th></th></tr></thead>
            <tbody>
              {fas.map((p) => {
                const ask = currentAsk(league, p, perf)
                const yrs = askYears(p)
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td><PlayerCell league={league} p={p} subtitle={archetypeFor(p)} /></td>
                      <td>{p.pos}</td><td>{p.age}</td><td><OvrPill value={ovrOf(p)} /></td>
                      <td>{money(ask)} × {yrs}y</td>
                      <td><button className="btn" disabled={!faOpen} onClick={() => setOpen(open === p.id ? null : p.id)}>Offer</button></td>
                    </tr>
                    {open === p.id && (
                      <tr className="offer-row"><td colSpan={6}>
                        <OfferForm ask={ask} years={yrs} onCancel={() => setOpen(null)} onSubmit={(salary, years) => {
                          let res = ''
                          const ok = act((l) => {
                            res = offerFreeAgent(l, me, p.id, salary, years)
                            return res === 'signed' ? `✅ ${fullName(p)} signed: ${years} yrs, ${money(salary)}/yr.`
                              : res === 'pending' ? `📨 Offer sent to ${fullName(p)}. He'll decide at the end of the day.`
                              : `❌ ${fullName(p)} turned it down. He wants about ${money(ask)}.`
                          })
                          if (ok && res !== 'rejected') setOpen(null)
                        }} />
                      </td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {!fas.length && <p className="muted">Nobody available{pos !== 'All' ? ` at ${pos}` : ''}.</p>}
      </section>
    </div>
  )
}
