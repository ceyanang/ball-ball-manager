import { useState } from 'react'
import { Link } from 'react-router-dom'
import { autoPick, currentSlot, draftUntilUser, makePick, releaseRights, rookieSalary, rookieYears, signRights } from '../../engine/gm/draft'
import { archetypeFor } from '../../engine/player/archetype'
import { TeamBadge } from '../components/TeamBadge'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName, heightStr, money } from '../util'

export function Draft() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const sim = useStore((s) => s.sim)
  const busy = useStore((s) => s.busy)
  const d = league.draft
  const step = league.offseason?.step
  const [revealed, setRevealed] = useState(step === 'lottery' || step === 'recap' ? 0 : 14)
  const [pos, setPos] = useState('All')
  if (!d) return <div className="stack"><h1>Draft</h1><p className="notice">The draft lottery happens right after the Finals.</p></div>

  const me = league.userTeamId
  const slot = currentSlot(league)
  const onClock = step === 'draft' && slot?.teamId === me
  const lotteryByPick = [...d.lottery].sort((a, b) => b.pick - a.pick) // reveal 14 → 1
  const shown = new Set(lotteryByPick.slice(0, revealed).map((e) => e.teamId))
  const board = d.prospects.map((id) => league.players[id]).filter((p) => pos === 'All' || p.pos === pos)
    .sort((a, b) => (d.scout[b.id].ovrLo + d.scout[b.id].ovrHi + 2 * d.scout[b.id].pot) - (d.scout[a.id].ovrLo + d.scout[a.id].ovrHi + 2 * d.scout[a.id].pot))
  const rights = Object.entries(league.draftRights).filter(([, t]) => t === me).map(([id]) => league.players[id])

  const pick = (id: string) => act((l) => {
    makePick(l, id)
    const name = fullName(l.players[id])
    draftUntilUser(l)
    return `🎉 You drafted ${name}!`
  })

  return (
    <div className="stack">
      <h1>Season {d.season} Draft</h1>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2>🎰 Lottery</h2>
          {revealed < 14 && (
            <div className="row">
              <button className="btn" onClick={() => setRevealed(revealed + 1)}>Reveal #{14 - revealed}</button>
              <button className="btn" onClick={() => setRevealed(14)}>Reveal all</button>
            </div>
          )}
        </div>
        <p className="muted" style={{ margin: 0 }}>The 14 teams that missed the playoffs. The top 4 picks are drawn by weighted odds; everyone else follows in record order.</p>
        <ol className="lottery">
          {[...d.lottery].sort((a, b) => a.pick - b.pick).map((e) => {
            const t = league.teams[e.teamId]
            const vis = shown.has(e.teamId)
            const jump = e.preSlot - e.pick
            return (
              <li key={e.teamId} className={`lot${vis ? ' shown' : ''}${e.teamId === me ? ' mine' : ''}${vis && jump > 0 ? ' jumped' : ''}`}>
                <span className="lot-pick">#{e.pick}</span>
                {vis ? (
                  <>
                    <TeamBadge team={t} size={30} />
                    <span className="lot-team">{t.city} {t.name}</span>
                    <span className="muted">{(e.odds / 10).toFixed(1)}% odds · was #{e.preSlot}</span>
                    {jump > 0 && <span className="win">⬆ {jump}</span>}
                    {jump < 0 && <span className="loss">⬇ {-jump}</span>}
                  </>
                ) : <span className="muted lot-hidden">? ? ?</span>}
              </li>
            )
          })}
        </ol>
      </section>

      {step === 'draft' && slot && (
        <section className={`panel stack ${onClock ? 'clock-me' : ''}`}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <h2>{onClock ? '⏰ You’re on the clock!' : `On the clock: ${league.teams[slot.teamId].name}`}</h2>
            <div className="row">
              {onClock && <button className="btn" onClick={() => act((l) => { autoPick(l); const s = l.draft!.order.find((x) => x.pick === slot.pick)!; draftUntilUser(l); return `Auto-picked ${fullName(l.players[s.playerId!])}.` })}>Auto-pick</button>}
              {!onClock && <button className="btn" onClick={() => act((l) => { draftUntilUser(l) })}>Sim to my pick</button>}
              <button className="btn btn-primary" disabled={busy} onClick={() => sim({ type: 'offseason' })}>Finish draft</button>
            </div>
          </div>
          <p className="muted" style={{ margin: 0 }}>Pick #{slot.pick} (round {slot.round}). Ratings are scouting estimates: OVR is a range, POT a fuzzy number. “Finish draft” auto-picks for you.</p>
        </section>
      )}

      {step === 'draft' && !slot && (
        <section className="panel stack clock-me">
          <h2>✅ The draft is complete</h2>
          <div className="row"><button className="btn btn-primary" disabled={busy} onClick={() => sim({ type: 'offseason' })}>Continue to re-signing →</button></div>
        </section>
      )}

      {d.prospects.length > 0 && (
        <section className="panel stack">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <h2>Big board</h2>
            <div className="seg">{['All', 'PG', 'SG', 'SF', 'PF', 'C'].map((x) => <button key={x} className="btn" aria-pressed={pos === x} onClick={() => setPos(x)}>{x}</button>)}</div>
          </div>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Prospect</th><th>Pos</th><th>Age</th><th>Ht</th><th>OVR est.</th><th>POT</th><th></th></tr></thead>
              <tbody>
                {board.map((p, i) => {
                  const sc = d.scout[p.id]
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="pcell">
                          <span className="muted" style={{ width: '1.6rem' }}>{i + 1}</span>
                          <Face seed={p.faceSeed} age={p.age} colors={{ primary: '#555b66', secondary: '#ffffff' }} size={34} />
                          <span><span className="pname">{fullName(p)}</span><span className="sub">{archetypeFor(p)}</span></span>
                        </div>
                      </td>
                      <td>{p.pos}</td><td>{p.age}</td><td>{heightStr(p.heightIn)}</td>
                      <td>{sc.ovrLo}–{sc.ovrHi}</td>
                      <td><span className="grade-chip">{sc.pot}</span></td>
                      <td>{onClock && <button className="btn btn-primary" onClick={() => pick(p.id)}>Draft</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rights.length > 0 && (
        <section className="panel stack">
          <h2>Your draft picks</h2>
          <p className="muted" style={{ margin: 0 }}>Drafted players aren’t signed automatically. Sign them at the rookie scale (if the cap allows) or release their rights. Unsigned picks are let go when the season starts.</p>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Player</th><th>Pick</th><th>Rookie deal</th><th></th></tr></thead>
              <tbody>
                {rights.map((p) => {
                  const s = d.order.find((x) => x.playerId === p.id)!
                  return (
                    <tr key={p.id}>
                      <td><Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link> <span className="muted">{p.pos}</span></td>
                      <td>#{s.pick}</td><td>{money(rookieSalary(s))} × {rookieYears(s)} yrs</td>
                      <td className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={() => act((l) => { signRights(l, p.id); return `✍️ ${fullName(p)} signed his rookie deal.` })}>Sign</button>
                        <button className="btn" onClick={() => { if (confirm(`Release the rights to ${fullName(p)}?`)) act((l) => { releaseRights(l, p.id) }) }}>Release</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel stack">
        <h2>Draft order</h2>
        <div className="order-grid">
          {d.order.map((s) => {
            const t = league.teams[s.teamId]
            const p = s.playerId ? league.players[s.playerId] : null
            const traded = !s.pickId.endsWith(s.teamId)
            return (
              <div key={s.pick} className={`order-slot${s.teamId === me ? ' mine' : ''}${slot?.pick === s.pick ? ' now' : ''}`}>
                <span className="order-n">{s.pick}</span>
                <TeamBadge team={t} size={24} />
                <span className="order-p">{p ? <Link className="link" to={`/player/${p.id}`}>{fullName(p)} <span className="muted">{p.pos}</span></Link> : <span className="muted">{traded ? 'via trade' : '—'}</span>}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
