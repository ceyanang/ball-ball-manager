import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tradeLabel } from '../tradeText'
import { respondToOffer } from '../../engine/stories/inbox'
import type { InboxItem, League, TradeAsset } from '../../engine/types'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { money, ovrOf } from '../util'

function AssetList({ league, assets }: { league: League; assets: TradeAsset[] }) {
  return (
    <ul className="offer-assets">
      {assets.map((a) => {
        const p = a.kind === 'player' ? league.players[a.id] : null
        return (
          <li key={a.id}>
            {p ? <Link className="link" to={`/player/${p.id}`}>{tradeLabel(league, a)}</Link> : tradeLabel(league, a)}
            {p && <span className="muted"> · {p.pos} · {ovrOf(p)} OVR · {p.age}y{p.contract ? ` · ${money(p.contract.salary)}` : ''}</span>}
          </li>
        )
      })}
    </ul>
  )
}

const when = (i: InboxItem) => `S${i.season} · ${i.phase === 'offseason' ? `Offseason${i.day ? ` · FA day ${i.day}` : ''}` : `${i.phase === 'playoffs' ? 'Playoffs · ' : ''}Day ${i.day}`}`

export function Inbox() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const [showDismissed, setShowDismissed] = useState(false)
  const items = [...league.inbox].reverse().filter((i) => showDismissed || !i.dismissed)
  const unread = league.inbox.filter((i) => !i.read && !i.dismissed).length
  const mark = (id: string, patch: Partial<InboxItem>) => act((l) => { Object.assign(l.inbox.find((i) => i.id === id)!, patch) })

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>Inbox {unread > 0 && <span className="count-pill">{unread}</span>}</h1>
        <div className="row">
          <Link className="btn" to="/events">🎲 Events</Link>
          {unread > 0 && <button className="btn" onClick={() => act((l) => { for (const i of l.inbox) i.read = true })}>Mark all read</button>}
          <label className="row" style={{ gap: '0.4rem' }}><input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} /> Show dismissed</label>
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>Your assistant GM’s notes. Suggestions only — every call is yours.</p>
      {items.length === 0 && <section className="panel"><p className="muted" style={{ margin: 0 }}>Nothing here yet. Sim some games and your assistant will start flagging things.</p></section>}
      {items.map((i) => {
        const o = i.offer
        const team = o ? league.teams[o.teamId] : null
        return (
          <article key={i.id} className={`inbox-item${i.read ? '' : ' unread'}${i.dismissed ? ' dismissed' : ''}`} onClick={() => !i.read && mark(i.id, { read: true })}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="inbox-title">{i.title}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>{when(i)}</div>
              </div>
              {!i.dismissed && !(o && o.status === 'open') && <button className="btn" onClick={(e) => { e.stopPropagation(); mark(i.id, { dismissed: true, read: true }) }}>Dismiss</button>}
            </div>
            <p style={{ margin: '0.4rem 0' }}>{i.body}</p>
            {o && team && (
              <div className="offer-box">
                <div className="grid-2">
                  <div><div className="row" style={{ gap: '0.5rem' }}><TeamBadge team={team} size={28} /><strong>{team.name} send</strong></div><AssetList league={league} assets={o.theyGive} /></div>
                  <div><strong>You send</strong><AssetList league={league} assets={o.youGive} /></div>
                </div>
                {o.status === 'open' ? (
                  <div className="row">
                    <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); act((l) => respondToOffer(l, i.id, true)) }}>✅ Accept</button>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); act((l) => respondToOffer(l, i.id, false)) }}>Decline</button>
                    <Link className="link muted" to={`/trade?team=${team.id}`} onClick={(e) => e.stopPropagation()}>Counter in the trade builder →</Link>
                  </div>
                ) : <span className={`offer-status ${o.status}`}>{{ accepted: '✅ Accepted', declined: '❌ Declined', expired: '⌛ Expired', open: '' }[o.status]}</span>}
              </div>
            )}
            {i.link && !o && <Link className="link" to={i.link} onClick={(e) => e.stopPropagation()}>Take a look →</Link>}
          </article>
        )
      })}
    </div>
  )
}
