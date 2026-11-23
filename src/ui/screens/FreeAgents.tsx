import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isFreeAgent } from '../../engine/gm/cap'
import { FA_DAYS, claimWaiver, currentAsk, offerFreeAgent } from '../../engine/gm/roster'
import { askYears, formOf } from '../../engine/gm/value'
import { needThresholds, teamNeeds, type NeedLevel } from '../../engine/gm/needs'
import { NEED_RANK } from '../needRank'
import type { Player } from '../../engine/types'
import { archetypeFor } from '../../engine/player/archetype'
import { AutoSignPanel } from '../components/AutoSignPanel'
import { CapBar } from '../components/CapBar'
import { DataTable, type Column } from '../components/DataTable'
import { NeedDot, NeedsStrip } from '../components/NeedDot'
import { OfferForm } from '../components/OfferForm'
import { OvrPill } from '../components/OvrPill'
import { PlayerCell } from '../components/PlayerCell'
import { useStore } from '../store'
import { fullName, money, ovrOf } from '../util'
import { Help } from '../components/Help'

interface FaRow { p: Player; ask: number; yrs: number; need: NeedLevel; after: NeedLevel }

export function FreeAgents() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const sim = useStore((s) => s.sim)
  const busy = useStore((s) => s.busy)
  const [open, setOpen] = useState<string | null>(null)
  const me = league.userTeamId
  const os = league.offseason
  const faOpen = league.phase !== 'offseason' || os?.step === 'freeAgency' || os?.step === 'ready'
  const perf = useMemo(() => formOf(league), [league])
  const th = useMemo(() => needThresholds(league), [league])
  const needs = useMemo(() => teamNeeds(league, me, {}, th), [league, me, th])
  // Best 200 by OVR; the table's own position/name/stat filters and sorting work within these.
  const fas = useMemo<FaRow[]>(() => Object.values(league.players)
    .filter((p) => isFreeAgent(league, p))
    .sort((a, b) => ovrOf(b) - ovrOf(a))
    .slice(0, 200)
    .map((p) => ({
      p, ask: currentAsk(league, p, perf), yrs: askYears(p), need: needs[p.pos],
      after: teamNeeds(league, me, { add: [{ pos: p.pos, ovr: ovrOf(p) }] }, th)[p.pos],
    })), [league, perf, needs, me, th])
  const columns: Column<FaRow>[] = [
    { key: 'player', label: 'Player', align: 'left', defaultDir: 'asc', mobile: 'main', value: (r) => fullName(r.p), cell: (r) => <PlayerCell league={league} p={r.p} subtitle={archetypeFor(r.p)} /> },
    { key: 'pos', label: 'Pos', align: 'left', defaultDir: 'asc', value: (r) => r.p.pos },
    { key: 'need', label: 'Need', defaultDir: 'desc', value: (r) => NEED_RANK[r.need], cell: (r) => <NeedDot level={r.need} after={r.after} /> },
    { key: 'age', label: 'Age', defaultDir: 'asc', value: (r) => r.p.age },
    { key: 'ovr', label: 'OVR', defaultDir: 'desc', mobile: 'key', value: (r) => ovrOf(r.p), cell: (r) => <OvrPill value={ovrOf(r.p)} pot={r.p.pot} /> },
    { key: 'ask', label: 'Asks', defaultDir: 'desc', mobile: 'key', value: (r) => r.ask, text: (r) => `${money(r.ask)} × ${r.yrs}y` },
    {
      key: 'offer', label: '', defaultDir: 'asc', sortable: false, mobile: 'act', value: () => null,
      cell: (r) => <button className="btn" disabled={!faOpen} onClick={() => setOpen(open === r.p.id ? null : r.p.id)}>Offer</button>,
    },
  ]
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
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <NeedsStrip needs={needs} />
        {faOpen && <AutoSignPanel resign={false} />}
      </div>

      {league.waivers.length > 0 && (
        <section className="panel stack">
          <h2>On waivers</h2>
          <div className="table-wrap">
            <table className="stats m-cards">
              <thead><tr><th>Player</th><th>From</th><th>OVR</th><th>Contract</th><th></th></tr></thead>
              <tbody>
                {league.waivers.map((w) => {
                  const p = league.players[w.playerId]
                  return (
                    <tr key={w.playerId}>
                      <td className="m-main"><PlayerCell league={league} p={p} subtitle={archetypeFor(p)} /></td>
                      <td data-label="From">{league.teams[w.fromTeamId].abbrev}</td><td className="m-key"><OvrPill value={ovrOf(p)} pot={p.pot} /></td>
                      <td className="m-key">{money(w.contract.salary)} through {w.contract.expires}</td>
                      <td className="m-act">{w.fromTeamId !== me && <button className="btn" onClick={() => act((l) => { claimWaiver(l, me, p.id); return `You claimed ${fullName(p)}.` })}>Claim</button>}</td>
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
        <h2>Available <Help topics={['pot', 'need']} /></h2>
        <DataTable<FaRow>
          ariaLabel="Available free agents"
          rows={fas}
          rowKey={(r) => r.p.id}
          columns={columns}
          cards
          filters={{ pos: (r) => r.p.pos, name: (r) => fullName(r.p), range: true }}
          emptyText="Nobody available."
          expanded={(r) => open === r.p.id && (
            <OfferForm ask={r.ask} years={r.yrs} onCancel={() => setOpen(null)} onSubmit={(salary, years) => {
              const p = r.p
              let res = ''
              const ok = act((l) => {
                res = offerFreeAgent(l, me, p.id, salary, years)
                return res === 'signed' ? `✅ ${fullName(p)} signed: ${years} yrs, ${money(salary)}/yr.`
                  : res === 'pending' ? `📨 Offer sent to ${fullName(p)}. He'll decide at the end of the day.`
                  : `❌ ${fullName(p)} turned it down. He wants about ${money(r.ask)}.`
              })
              if (ok && res !== 'rejected') setOpen(null)
            }} />
          )}
        />
      </section>
    </div>
  )
}
