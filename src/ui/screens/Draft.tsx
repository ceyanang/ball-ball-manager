import { useState } from 'react'
import { Link } from 'react-router-dom'
import { autoPick, currentSlot, draftUntilUser, makePick, releaseRights, rookieSalary, rookieYears, scoutProspect, signRights } from '../../engine/gm/draft'
import { gradeFor } from '../../engine/player/grades'
import { ratingColor } from '../ratingColor'
import { needThresholds, teamNeeds, type NeedLevel } from '../../engine/gm/needs'
import { archetypeFor } from '../../engine/player/archetype'
import type { Player } from '../../engine/types'
import { DataTable, type Column } from '../components/DataTable'
import { NeedDot, NeedsStrip } from '../components/NeedDot'
import { NEED_RANK } from '../needRank'
import { TeamBadge } from '../components/TeamBadge'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName, heightStr, money } from '../util'

type Scout = { ovrLo: number; ovrHi: number; pot: number }
interface ProspectRow { p: Player; rank: number; sc: Scout; need: NeedLevel; after: NeedLevel }

export function Draft() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const sim = useStore((s) => s.sim)
  const busy = useStore((s) => s.busy)
  const d = league.draft
  const step = league.offseason?.step
  const [revealed, setRevealed] = useState(step === 'lottery' || step === 'recap' ? 0 : 14)
  const [scoutOpen, setScoutOpen] = useState<string | null>(null)
  if (!d) return <div className="stack"><h1>Draft</h1><p className="notice">The draft lottery happens right after the Finals.</p></div>

  const me = league.userTeamId
  const slot = currentSlot(league)
  const onClock = step === 'draft' && slot?.teamId === me
  const lotteryByPick = [...d.lottery].sort((a, b) => b.pick - a.pick) // reveal 14 → 1
  const shown = new Set(lotteryByPick.slice(0, revealed).map((e) => e.teamId))
  const ranked = d.prospects.map((id) => league.players[id])
    .sort((a, b) => (d.scout[b.id].ovrLo + d.scout[b.id].ovrHi + 2 * d.scout[b.id].pot) - (d.scout[a.id].ovrLo + d.scout[a.id].ovrHi + 2 * d.scout[a.id].pot))
  const th = needThresholds(league)
  const needs = teamNeeds(league, me, {}, th)
  // Big-board rank is fixed by scouting; sorting or filtering the table never renumbers a prospect.
  const board: ProspectRow[] = ranked.map((p, i) => {
    const sc = d.scout[p.id]
    return { p, rank: i + 1, sc, need: needs[p.pos], after: teamNeeds(league, me, { add: [{ pos: p.pos, ovr: Math.round((sc.ovrLo + sc.ovrHi) / 2) }] }, th)[p.pos] }
  })
  const boardColumns: Column<ProspectRow>[] = [
    {
      key: 'prospect', label: 'Prospect', align: 'left', defaultDir: 'asc', value: (r) => fullName(r.p),
      cell: (r) => (
        <div className="pcell">
          <span className="muted" style={{ width: '1.6rem' }}>{r.rank}</span>
          <Face seed={r.p.faceSeed} age={r.p.age} colors={{ primary: '#555b66', secondary: '#ffffff' }} size={34} />
          <span><span className="pname">{fullName(r.p)}</span><span className="sub">{archetypeFor(r.p)}</span></span>
        </div>
      ),
    },
    { key: 'rank', label: '#', title: 'Big-board rank', defaultDir: 'asc', value: (r) => r.rank },
    { key: 'pos', label: 'Pos', align: 'left', defaultDir: 'asc', value: (r) => r.p.pos },
    { key: 'need', label: 'Need', defaultDir: 'desc', value: (r) => NEED_RANK[r.need], cell: (r) => <NeedDot level={r.need} after={r.after} /> },
    { key: 'age', label: 'Age', defaultDir: 'asc', value: (r) => r.p.age },
    { key: 'ht', label: 'Ht', defaultDir: 'desc', value: (r) => r.p.heightIn, text: (r) => heightStr(r.p.heightIn) },
    { key: 'ovr', label: 'OVR est.', defaultDir: 'desc', value: (r) => (r.sc.ovrLo + r.sc.ovrHi) / 2, text: (r) => `${r.sc.ovrLo}–${r.sc.ovrHi}` },
    { key: 'pot', label: 'POT', defaultDir: 'desc', value: (r) => r.sc.pot, cell: (r) => <span className="grade-chip">{r.sc.pot}</span> },
    {
      key: 'scout', label: 'Report', defaultDir: 'asc', sortable: false, value: () => null,
      cell: (r) => (
        <button className="btn" aria-expanded={scoutOpen === r.p.id} onClick={() => setScoutOpen(scoutOpen === r.p.id ? null : r.p.id)}>
          {scoutOpen === r.p.id ? 'Hide' : 'Scout'}
        </button>
      ),
    },
    { key: 'draft', label: '', defaultDir: 'asc', sortable: false, value: () => null, cell: (r) => (onClock ? <button className="btn btn-primary" onClick={() => pick(r.p.id)}>Draft</button> : null) },
  ]
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
          <NeedsStrip needs={needs} />
          <h2>Big board</h2>
          <DataTable<ProspectRow>
            ariaLabel="Draft big board"
            rows={board}
            rowKey={(r) => r.p.id}
            columns={boardColumns}
            filters={{ pos: (r) => r.p.pos, name: (r) => fullName(r.p), range: true }}
            expanded={(r) => {
              if (scoutOpen !== r.p.id) return null
              const rep = scoutProspect(r.p, r.sc)
              return (
                <div className="scout-panel stack" style={{ gap: '0.6rem' }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <strong>{fullName(r.p)} · Scouting profile</strong>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      Top traits: {rep.strengths.map((s) => `${s.label} (~${s.est})`).join(' · ')}
                    </span>
                  </div>
                  <div className="cat-pills">
                    {rep.categories.map((c) => (
                      <span key={c.group} className="cat-pill" title={`Estimated ${c.lo}–${c.hi}`}>
                        <span className="muted">{c.group}</span>
                        <strong style={{ color: ratingColor(c.est) }}>{gradeFor(c.est)} ({c.lo}–{c.hi})</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )
            }}
          />
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
