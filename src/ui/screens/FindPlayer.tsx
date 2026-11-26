import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { neediestPosition } from '../../engine/gm/needs'
import { findTargets, proposeTrade, tradeableAssets, type Asset, type TargetDeal } from '../../engine/gm/trade'
import { teamMode } from '../../engine/gm/value'
import type { Position } from '../../engine/types'
import { OfferAssets } from '../components/OfferAssets'
import { TeamBadge } from '../components/TeamBadge'
import { POSITIONS } from '../playerFilter'
import { useStore } from '../store'
import { rejectionText, tradeLabel } from '../tradeText'
import { money, teamFull } from '../util'
import { AssetList } from './Trade'

const key = (a: Asset) => `${a.kind}:${a.id}`
const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s))

export function FindPlayer() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const me = league.userTeamId
  const [pos, setPos] = useState<Position>(() => neediestPosition(league, me))
  const [minOvr, setMinOvr] = useState('60')
  const [maxAge, setMaxAge] = useState('')
  const [maxSalary, setMaxSalary] = useState('') // in $M
  const [avail, setAvail] = useState<Set<string>>(new Set())
  const [deals, setDeals] = useState<TargetDeal[] | null>(null)
  const [searching, setSearching] = useState(false)

  const myAssets = useMemo(() => tradeableAssets(league, me), [league, me])
  const available = myAssets.filter((a) => avail.has(key(a)))
  // A finished trade (or a sim) changes the league, so old results go stale.
  useEffect(() => setDeals(null), [league])

  const toggle = (a: Asset) => {
    const n = new Set(avail)
    if (n.has(key(a))) n.delete(key(a)); else n.add(key(a))
    setAvail(n)
    setDeals(null)
  }
  const search = () => {
    setSearching(true)
    // Let the button paint its busy state before the (synchronous) league-wide search.
    setTimeout(() => {
      const sal = num(maxSalary)
      setDeals(findTargets(league, me, { pos, minOvr: num(minOvr) ?? 0, maxAge: num(maxAge), maxSalary: sal === undefined ? undefined : sal * 1000 }, available))
      setSearching(false)
    }, 20)
  }
  const accept = (d: TargetDeal) => {
    act((l) => {
      const v = proposeTrade(l, { a: me, b: d.teamId, aGives: d.gives, bGives: [d.target] })
      return v.ok ? `✅ Trade done! ${tradeLabel(league, d.target)} is yours.` : rejectionText(league.teams[d.teamId].name, v)
    })
    setAvail(new Set())
  }
  const salary = (as: Asset[]) => as.reduce((t, a) => t + (a.kind === 'player' ? league.players[a.id].contract?.salary ?? 0 : 0), 0)
  const filters = () => setDeals(null)

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0, maxWidth: '72ch' }}>
        Describe the player you need and tick what you're willing to trade. You'll get a ready-to-accept deal for each match, paid for only with what you ticked.
      </p>
      <div className="trade-grid">
        <section className="panel stack">
          <div className="row"><TeamBadge team={league.teams[me]} size={32} /><h2>Available to trade</h2></div>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Only these will be offered.</p>
          <AssetList league={league} teamId={me} assets={myAssets} picked={avail} toggle={toggle} pos="All" q="" />
        </section>

        <section className="panel stack">
          <h2>I need…</h2>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <label className="stack" style={{ gap: 2 }}>Position
              <select value={pos} onChange={(e) => { setPos(e.target.value as Position); filters() }}>
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="stack" style={{ gap: 2 }}>Min OVR
              <input type="number" inputMode="numeric" min={0} max={99} value={minOvr} style={{ width: '5rem' }} onChange={(e) => { setMinOvr(e.target.value); filters() }} />
            </label>
            <label className="stack" style={{ gap: 2 }}>Max age
              <input type="number" inputMode="numeric" min={18} max={45} placeholder="any" value={maxAge} style={{ width: '5rem' }} onChange={(e) => { setMaxAge(e.target.value); filters() }} />
            </label>
            <label className="stack" style={{ gap: 2 }}>Max salary ($M)
              <input type="number" inputMode="decimal" min={0} placeholder="any" value={maxSalary} style={{ width: '6rem' }} onChange={(e) => { setMaxSalary(e.target.value); filters() }} />
            </label>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="muted">{available.length ? `${available.length} piece${available.length > 1 ? 's' : ''} available · ${money(salary(available))}` : "Tick what you're willing to trade."}</span>
            <button className="btn btn-primary" disabled={!available.length || searching} onClick={search}>{searching ? 'Searching the league…' : 'Find players'}</button>
          </div>

          {deals && !deals.length && <p className="notice">No one matching that would take what you ticked. Loosen the filters or tick more.</p>}
          {deals && deals.length > 0 && (
            <div className="offer-list">
              {deals.map((d) => {
                const t = league.teams[d.teamId]
                return (
                  <div key={key(d.target)} className="offer">
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <Link className="row link" to={`/team/${t.id}`} style={{ gap: '0.5rem', minWidth: 0 }}>
                        <TeamBadge team={t} size={28} />
                        <span style={{ fontWeight: 700 }}>{teamFull(t)}</span>
                      </Link>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>{teamMode(league, t.id) === 'contend' ? 'contending' : 'rebuilding'}</span>
                    </div>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>You get</span>
                    <OfferAssets league={league} assets={[d.target]} colors={t.colors} />
                    <span className="muted" style={{ fontSize: '0.8rem' }}>You send</span>
                    <OfferAssets league={league} assets={d.gives} colors={league.teams[me].colors} />
                    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>Salary in {money(salary([d.target]))} · out {money(salary(d.gives))}</span>
                      <div className="row">
                        <Link className="btn" to={`/trade?team=${t.id}&gives=${d.gives.map(key).join(',')}&gets=${key(d.target)}`}>Tweak</Link>
                        <button className="btn btn-primary" onClick={() => accept(d)}>Accept</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
