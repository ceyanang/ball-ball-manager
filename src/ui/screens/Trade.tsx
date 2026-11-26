import { needThresholds, teamNeeds } from '../../engine/gm/needs'
import { NeedDot, NeedsStrip } from '../components/NeedDot'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { capSeason, committed, payroll, tradesOpen } from '../../engine/gm/cap'
import { rosterSynergy } from '../../engine/gm/synergy'
import { proposeTrade, suggestPackage, tradeableAssets, tradeProblem, type Asset, type Trade as TradeT } from '../../engine/gm/trade'
import { projectedSlot, standingsOf, teamMode } from '../../engine/gm/value'
import { archetypeFor } from '../../engine/player/archetype'
import type { League } from '../../engine/types'
import { CapBar } from '../components/CapBar'
import { OvrPill } from '../components/OvrPill'
import { TeamBadge } from '../components/TeamBadge'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { POSITIONS, filterPlayers, type PosFilter } from '../playerFilter'
import { fullName, money, ovrOf, teamFull } from '../util'
import { ratingColor } from '../ratingColor'
import { rejectionText, tradeLabel } from '../tradeText'
import { Help } from '../components/Help'
import { RosterPeek } from '../components/RosterPeek'

const key = (a: Asset) => `${a.kind}:${a.id}`

export function AssetList({ league, teamId, assets, picked, toggle, pos, q }: {
  league: League; teamId: string; assets: Asset[]; picked: Set<string>; toggle: (a: Asset) => void; pos: PosFilter; q: string
}) {
  const team = league.teams[teamId]
  const me = league.userTeamId
  const th = useMemo(() => needThresholds(league), [league])
  const myNeeds = useMemo(() => teamNeeds(league, me, {}, th), [league, me, th])
  const filtering = pos !== 'All' || !!q.trim()
  // Filters hide unpicked players only, so a filter never makes a chosen piece vanish from the deal.
  const shown = new Set(filterPlayers(assets.filter((a) => a.kind === 'player').map((a) => league.players[a.id]), { pos, q }).map((p) => p.id))
  const players = assets.filter((a) => a.kind === 'player' && (shown.has(a.id) || picked.has(key(a)))).map((a) => league.players[a.id]).sort((a, b) => ovrOf(b) - ovrOf(a))
  const picks = assets.filter((a) => a.kind === 'pick' && (!filtering || picked.has(key(a))))
  return (
    <div className="asset-list">
      {players.map((p) => {
        const a: Asset = { kind: 'player', id: p.id }
        const on = picked.has(key(a))
        const yrs = p.contract ? p.contract.expires - capSeason(league) + 1 : 0
        return (
          <div key={p.id} className={`asset${on ? ' on' : ''}`}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <input type="checkbox" checked={on} onChange={() => toggle(a)} />
              <Face seed={p.faceSeed} age={p.age} colors={team.colors} size={30} />
              <span className="asset-main">
                <span className="asset-name">{fullName(p)}{p.injury ? ' 🤕' : ''}</span>
                {/* Salary sits on the second line so the name keeps the row's width on a phone. */}
                <span className="asset-sub">{p.pos} · {p.age}y{p.contract ? ` · ${money(p.contract.salary)} · ${yrs}y` : ''}<span className="m-hide"> · {archetypeFor(p)}</span></span>
              </span>
              <NeedDot level={myNeeds[p.pos]} after={teamNeeds(league, me, teamId === me ? { removeIds: [p.id] } : { add: [{ pos: p.pos, ovr: ovrOf(p) }] }, th)[p.pos]} />
              <OvrPill value={ovrOf(p)} pot={p.pot} />
            </label>
            <Link
              to={`/player/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              className="icon-btn"
              style={{ textDecoration: 'none', flex: 'none' }}
              aria-label={`View ${fullName(p)} profile`}
              title="View profile"
            >↗</Link>
          </div>
        )
      })}
      {picks.map((a) => {
        const pk = league.picks.find((p) => p.id === a.id)!
        const on = picked.has(key(a))
        return (
          <label key={a.id} className={`asset pick${on ? ' on' : ''}`}>
            <input type="checkbox" checked={on} onChange={() => toggle(a)} />
            <span className="pick-chip">R{pk.round}</span>
            <span className="asset-main">
              <span className="asset-name">{tradeLabel(league, a)}</span>
              <span className="asset-sub">Projected #{projectedSlot(league, pk)} in round {pk.round}</span>
            </span>
          </label>
        )
      })}
      {!assets.length ? <p className="muted">Nothing tradeable.</p> : !players.length && !picks.length && <p className="muted">No players match the filter.</p>}
    </div>
  )
}

export function Trade() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const [params] = useSearchParams()
  const me = league.userTeamId
  const others = Object.values(league.teams).filter((t) => t.id !== me).sort((a, b) => a.city.localeCompare(b.city))
  const [partner, setPartner] = useState(params.get('team') && params.get('team') !== me ? params.get('team')! : others[0].id)
  // ?get=<playerId> targets one player; ?gets=/gives= carry full asset keys (kind:id, comma-separated) from the trade finder.
  const keys = (name: string) => (params.get(name) ?? '').split(',').filter(Boolean)
  const [give, setGive] = useState<Set<string>>(() => new Set(keys('gives')))
  const [get, setGet] = useState<Set<string>>(() => new Set([...keys('gets'), ...keys('get').map((id) => `player:${id}`)]))
  const [hint, setHint] = useState<string | null>(null)
  const [findPos, setFindPos] = useState<PosFilter>('All')
  const [findQ, setFindQ] = useState('')
  const [findTeam, setFindTeam] = useState('All')
  const [myPos, setMyPos] = useState<PosFilter>('All')
  const [myQ, setMyQ] = useState('')
  const [theirPos, setTheirPos] = useState<PosFilter>('All')
  const [theirQ, setTheirQ] = useState('')
  /** Whose roster stats sheet is open; it floats over the trade and never touches the offer. */
  const [peek, setPeek] = useState<'me' | 'them' | null>(null)

  const myAssets = useMemo(() => tradeableAssets(league, me), [league, me])
  const theirAssets = useMemo(() => tradeableAssets(league, partner), [league, partner])
  const finds = useMemo(() => {
    const ids = others.filter((t) => findTeam === 'All' || t.id === findTeam)
      .flatMap((t) => tradeableAssets(league, t.id).filter((a) => a.kind === 'player').map((a) => league.players[a.id]))
    return filterPlayers(ids, { pos: findPos, q: findQ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league, findTeam, findPos, findQ])
  const myNeeds = useMemo(() => teamNeeds(league, me, {}, needThresholds(league)), [league, me])
  const parse = (s: Set<string>, pool: Asset[]) => pool.filter((a) => s.has(key(a)))
  const trade: TradeT = { a: me, b: partner, aGives: parse(give, myAssets), bGives: parse(get, theirAssets) }
  const synBefore = useMemo(() => rosterSynergy(committed(league, me)), [league, me])
  const synAfter = useMemo(() => {
    const outIds = new Set(trade.aGives.filter((a) => a.kind === 'player').map((a) => a.id))
    const inPlayers = trade.bGives.filter((a) => a.kind === 'player').map((a) => league.players[a.id])
    return rosterSynergy(committed(league, me).filter((p) => !outIds.has(p.id)).concat(inPlayers))
  }, [league, me, trade.aGives, trade.bGives])
  const problem = trade.aGives.length || trade.bGives.length ? tradeProblem(league, trade) : null
  const salary = (as: Asset[]) => as.reduce((t, a) => t + (a.kind === 'player' ? league.players[a.id].contract?.salary ?? 0 : 0), 0)
  const out = salary(trade.aGives), inn = salary(trade.bGives)
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void) => (a: Asset) => {
    const n = new Set(set)
    if (n.has(key(a))) n.delete(key(a)); else n.add(key(a))
    setter(n)
    setHint(null)
  }

  if (!tradesOpen(league))
    return (
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h1>Trade</h1>
          <Link to="/trade-finder" className="btn">🔎 Trade finder →</Link>
        </div>
        <p className="notice">{league.phase === 'playoffs' ? 'Trades are closed during the playoffs. They reopen after the Finals.' : 'The trade deadline has passed. Trades reopen after the Finals.'}</p>
      </div>
    )

  const partnerTeam = league.teams[partner]
  const partnerRow = standingsOf(league).find((r) => r.teamId === partner)
  const partnerRecord = partnerRow && (partnerRow.w + partnerRow.l > 0) ? `${partnerRow.w}–${partnerRow.l}` : ''
  const partnerHint = teamMode(league, partner) === 'contend' ? 'contending' : 'rebuilding'

  const whatWouldItTake = () => {
    const pkg = suggestPackage(league, me, partner, trade.bGives)
    if (!pkg) return setHint(`Nothing on your roster gets this done with the ${league.teams[partner].name}.`)
    setGive(new Set(pkg.map(key)))
    setHint(`The ${league.teams[partner].name} would take: ${pkg.map((a) => tradeLabel(league, a)).join(', ')}.`)
  }
  const target = (teamId: string, playerId: string) => {
    const k = `player:${playerId}`
    if (teamId !== partner) { setPartner(teamId); setGive(new Set()); setGet(new Set([k])) }
    else setGet(new Set(get).add(k))
    setHint(null)
  }
  const propose = () => {
    let accepted = false
    act((l) => {
      const v = proposeTrade(l, trade)
      accepted = v.ok
      return v.ok ? `✅ Trade accepted! ${trade.bGives.map((a) => tradeLabel(league, a)).join(', ') || 'Nothing'} heading your way.` : rejectionText(league.teams[partner].name, v)
    })
    if (accepted) { setGive(new Set()); setGet(new Set()) }
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Trade</h1>
        <label className="field" style={{ minWidth: 240 }}>Trade partner
          <select value={partner} onChange={(e) => { setPartner(e.target.value); setGet(new Set()); setHint(null) }}>
            {others.map((t) => <option key={t.id} value={t.id}>{teamFull(t)}</option>)}
          </select>
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link to="/trade-finder" className="btn">🔎 Trade finder →</Link>
          <button className="btn" onClick={() => setPeek('me')}>📊 My team</button>
          <button className="btn" onClick={() => setPeek('them')}>📊 Their team</button>
        </div>
      </div>
      <RosterPeek open={peek === 'me'} onClose={() => setPeek(null)} teamId={me} />
      <RosterPeek open={peek === 'them'} onClose={() => setPeek(null)} teamId={partner} />
      <p className="muted" style={{ margin: 0, maxWidth: '72ch' }}>
        Pick what you send and what you want back. CPU teams answer instantly and only take deals that clearly help them. Contenders want talent now; rebuilding teams want youth and picks. Not sure what they want? Pick their player and ask what it would take.
      </p>

      <section className="panel finder">
        <h3>Find players</h3>
        <div className="filters">
          <label className="field">Team
            <select value={findTeam} onChange={(e) => setFindTeam(e.target.value)}>
              <option value="All">All teams</option>
              {others.map((t) => <option key={t.id} value={t.id}>{teamFull(t)}</option>)}
            </select>
          </label>
          <label className="field">Search
            <input type="search" placeholder="Player name" value={findQ} onChange={(e) => setFindQ(e.target.value)} />
          </label>
          <div className="seg" role="group" aria-label="Position">
            {(['All', ...POSITIONS] as PosFilter[]).map((x) => <button key={x} className="btn" aria-pressed={findPos === x} onClick={() => setFindPos(x)}>{x}</button>)}
          </div>
        </div>
        <div className="asset-list" style={{ maxHeight: 300 }}>
          {finds.slice(0, 40).map((p) => {
            const t = league.teams[p.teamId!]
            const on = p.teamId === partner && get.has(`player:${p.id}`)
            return (
              <div key={p.id} className={`asset${on ? ' on' : ''}`}>
                <Face seed={p.faceSeed} age={p.age} colors={t.colors} size={30} />
                <span className="asset-main">
                  <Link className="asset-name link" to={`/player/${p.id}`}>{fullName(p)}{p.injury ? ' 🤕' : ''}</Link>
                  <span className="asset-sub">{p.pos} · {p.age}y · <Link className="link" to={`/team/${t.id}`}>{t.abbrev}</Link>{p.contract ? ` · ${money(p.contract.salary)}` : ''}<span className="m-hide"> · {archetypeFor(p)}</span></span>
                </span>
                <OvrPill value={ovrOf(p)} pot={p.pot} />
                <button className="btn" disabled={on} onClick={() => target(t.id, p.id)}>{on ? 'Added' : 'Target'}</button>
              </div>
            )
          })}
          {!finds.length && <p className="muted">No players match.</p>}
        </div>
      </section>

      <div className="trade-grid">
        <section className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="row link" to={`/team/${me}`} style={{ gap: '0.6rem', minWidth: 0 }}>
              <TeamBadge team={league.teams[me]} size={32} />
              <h2 style={{ margin: 0 }}>You send</h2>
            </Link>
            <Help topics={['pot', 'need']} />
          </div>
          <details className="dt-filter-details">
            <summary>🔍 Filter{myPos !== 'All' || myQ.trim() ? ' · on' : ''}</summary>
            <div className="filters">
              <label className="field">Search<input type="search" placeholder="Name" value={myQ} onChange={(e) => setMyQ(e.target.value)} /></label>
              <div className="seg" role="group" aria-label="My team position">
                {(['All', ...POSITIONS] as PosFilter[]).map((x) => <button key={x} className="btn" aria-pressed={myPos === x} onClick={() => setMyPos(x)}>{x}</button>)}
              </div>
            </div>
          </details>
          <AssetList league={league} teamId={me} assets={myAssets} picked={give} toggle={toggle(give, setGive)} pos={myPos} q={myQ} />
        </section>
        <section className="panel stack">
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.4rem 0.6rem' }}>
            <Link className="row link" to={`/team/${partner}`} style={{ gap: '0.6rem', minWidth: 0 }}>
              <TeamBadge team={partnerTeam} size={32} />
              <h2 style={{ margin: 0 }}>You get · {teamFull(partnerTeam)}</h2>
            </Link>
            <span className="muted" style={{ fontSize: '0.85rem' }}>{partnerRecord ? `${partnerRecord} · ` : ''}{partnerHint}</span>
          </div>
          <details className="dt-filter-details">
            <summary>🔍 Filter{theirPos !== 'All' || theirQ.trim() ? ' · on' : ''}</summary>
            <div className="filters">
              <label className="field">Search<input type="search" placeholder="Name" value={theirQ} onChange={(e) => setTheirQ(e.target.value)} /></label>
              <div className="seg" role="group" aria-label="Partner team position">
                {(['All', ...POSITIONS] as PosFilter[]).map((x) => <button key={x} className="btn" aria-pressed={theirPos === x} onClick={() => setTheirPos(x)}>{x}</button>)}
              </div>
            </div>
          </details>
          <AssetList league={league} teamId={partner} assets={theirAssets} picked={get} toggle={toggle(get, setGet)} pos={theirPos} q={theirQ} />
        </section>
      </div>

      <section className="panel stack trade-summary">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>Salary out <strong>{money(out)}</strong> · in <strong>{money(inn)}</strong> · your payroll after <strong>{money(payroll(league, me) - out + inn)}</strong></span>
          <div className="row">
            <button className="btn" disabled={!trade.bGives.length} onClick={whatWouldItTake}>What would it take?</button>
            <button className="btn btn-primary" disabled={!!problem || !trade.aGives.length || !trade.bGives.length} onClick={propose}>
              {!trade.aGives.length && !trade.bGives.length ? 'Pick both sides' : !trade.aGives.length ? 'Add something to send' : !trade.bGives.length ? 'Pick what you want' : 'Propose trade'}
            </button>
          </div>
        </div>
        {problem && <div className="notice">{problem}</div>}
        {hint && <div className="notice">{hint}</div>}
        <CapBar league={league} teamId={me} />
        <NeedsStrip needs={myNeeds} />
        <div className="cat-pills">
          {synBefore.pillars.map((pil, idx) => {
            const after = synAfter.pillars[idx]
            const d = after.score - pil.score
            return (
              <span key={pil.key} className="cat-pill">
                <span className="muted">{pil.label}</span>
                <strong style={{ color: ratingColor(after.score) }}>
                  {after.score}
                  {d !== 0 && <span className={d > 0 ? 'delta-up' : 'delta-down'}> ({d > 0 ? `+${d}` : d})</span>}
                </strong>
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}
