import { useEffect, useMemo, useState } from 'react'
import { rejectionText, tradeLabel } from '../tradeText'
import { Link } from 'react-router-dom'
import { tradesOpen } from '../../engine/gm/cap'
import { assetsValue, findOffers, proposeTrade, tradeableAssets, type Asset, type Offer } from '../../engine/gm/trade'
import { teamMode } from '../../engine/gm/value'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { money, teamFull } from '../util'
import { OfferAssets } from '../components/OfferAssets'
import { AssetList } from './Trade'
import { FindPlayer } from './FindPlayer'

const key = (a: Asset) => `${a.kind}:${a.id}`

type Want = 'any' | 'players' | 'young' | 'picks'
const WANTS: [Want, string][] = [['any', 'Anything'], ['players', 'Players'], ['young', 'Young (≤25)'], ['picks', 'Picks']]

function ShopMode() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const me = league.userTeamId
  const [give, setGive] = useState<Set<string>>(new Set())
  const [want, setWant] = useState<Want>('any')
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [searching, setSearching] = useState(false)

  const myAssets = useMemo(() => tradeableAssets(league, me), [league, me])
  const offered = myAssets.filter((a) => give.has(key(a)))
  // A finished trade (or a sim) changes the league, so old offers go stale.
  useEffect(() => setOffers(null), [league])

  const toggle = (a: Asset) => {
    const n = new Set(give)
    if (n.has(key(a))) n.delete(key(a)); else n.add(key(a))
    setGive(n)
    setOffers(null)
  }
  const search = () => {
    setSearching(true)
    // Let the button paint its busy state before the (synchronous) league-wide search.
    setTimeout(() => {
      const filter = (a: Asset) =>
        want === 'any' ? true
        : want === 'picks' ? a.kind === 'pick'
        : a.kind === 'player' && (want === 'players' || league.players[a.id].age <= 25)
      setOffers(findOffers(league, me, offered, { want: filter }))
      setSearching(false)
    }, 20)
  }
  const accept = (o: Offer) => {
    act((l) => {
      const v = proposeTrade(l, { a: me, b: o.teamId, aGives: offered, bGives: o.gives })
      return v.ok ? `✅ Trade done! ${o.gives.map((a) => tradeLabel(league, a)).join(', ')} heading your way.` : rejectionText(league.teams[o.teamId].name, v)
    })
    setGive(new Set())
  }

  const salary = (as: Asset[]) => as.reduce((t, a) => t + (a.kind === 'player' ? league.players[a.id].contract?.salary ?? 0 : 0), 0)
  const myValue = offered.length ? assetsValue(league, offered, teamMode(league, me)) : 0
  const grade = (v: number) => (v >= myValue * 1.1 ? ['Win', 'good'] : v >= myValue * 0.85 ? ['Fair', 'fair'] : ['Below value', 'poor'])

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0, maxWidth: '72ch' }}>
        Pick one player or a package to shop around. Every team answers with the best deal they'd actually say yes to, ranked by what it's worth to you.
      </p>

      <div className="trade-grid">
        <section className="panel stack">
          <div className="row"><TeamBadge team={league.teams[me]} size={32} /><h2>You shop</h2></div>
          <AssetList league={league} teamId={me} assets={myAssets} picked={give} toggle={toggle} pos="All" q="" />
        </section>

        <section className="panel stack">
          <h2>Offers</h2>
          <div className="seg" role="group" aria-label="Looking for">
            {WANTS.map(([w, label]) => (
              <button key={w} className="btn" aria-pressed={want === w} onClick={() => { setWant(w); setOffers(null) }}>{label}</button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span className="muted">{offered.length ? `${offered.length} piece${offered.length > 1 ? 's' : ''} · ${money(salary(offered))} out` : 'Pick something to shop.'}</span>
            <button className="btn btn-primary" disabled={!offered.length || searching} onClick={search}>{searching ? 'Calling around…' : 'Find offers'}</button>
          </div>

          {offers && !offers.length && <p className="notice">No team would take that deal for anything{want !== 'any' ? ' of that kind' : ''}. Try adding a sweetener or a different player.</p>}
          {offers && offers.length > 0 && (
            <div className="offer-list">
              {offers.map((o) => {
                const t = league.teams[o.teamId]
                const [label, cls] = grade(o.value)
                const inn = salary(o.gives)
                return (
                  <div key={o.teamId} className="offer">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div className="row" style={{ flexWrap: 'wrap', minWidth: 0 }}>
                        <Link className="row link" to={`/team/${t.id}`} style={{ gap: '0.5rem', minWidth: 0 }}>
                          <TeamBadge team={t} size={28} />
                          <span style={{ fontWeight: 700 }}>{teamFull(t)}</span>
                        </Link>
                        <span className="muted" style={{ fontSize: '0.8rem' }}>{teamMode(league, t.id) === 'contend' ? 'contending' : 'rebuilding'}</span>
                      </div>
                      <span className={`offer-grade ${cls}`}>{label}</span>
                    </div>
                    <OfferAssets league={league} assets={o.gives} colors={t.colors} />
                    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>Salary in {money(inn)} · out {money(salary(offered))}</span>
                      <div className="row">
                        <Link className="btn" to={`/trade?team=${t.id}&gives=${offered.map(key).join(',')}&gets=${o.gives.map(key).join(',')}`}>Tweak</Link>
                        <button className="btn btn-primary" onClick={() => accept(o)}>Accept</button>
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

type Mode = 'shop' | 'find'

export function TradeFinder() {
  const league = useStore((s) => s.league)!
  const [mode, setMode] = useState<Mode>('shop')
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Trade finder</h1>
        <Link to="/trade" className="btn">Trade builder →</Link>
      </div>
      {!tradesOpen(league) ? (
        <p className="notice">{league.phase === 'playoffs' ? 'Trades are closed during the playoffs. They reopen after the Finals.' : 'The trade deadline has passed. Trades reopen after the Finals.'}</p>
      ) : (
        <>
          <div className="seg" role="group" aria-label="Finder mode">
            <button className="btn" aria-pressed={mode === 'shop'} onClick={() => setMode('shop')}>Shop my guys</button>
            <button className="btn" aria-pressed={mode === 'find'} onClick={() => setMode('find')}>Find a player</button>
          </div>
          {mode === 'shop' ? <ShopMode /> : <FindPlayer />}
        </>
      )}
    </div>
  )
}
