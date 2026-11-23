import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { seasonStartProblem } from '../../engine/gm/offseason'
import { FA_DAYS, offerResign, resignChance } from '../../engine/gm/roster'
import { askSalary, askYears } from '../../engine/gm/value'
import type { OffseasonStep } from '../../engine/types'
import { CapBar } from '../components/CapBar'
import { AwardsCeremony } from '../components/Stories'
import { OfferForm } from '../components/OfferForm'
import { OvrPill } from '../components/OvrPill'
import { PlayerCell } from '../components/PlayerCell'
import { useStore } from '../store'
import { fullName, money, ovrOf } from '../util'

const STEPS: [OffseasonStep, string][] = [
  ['awards', 'Awards'], ['recap', 'Recap'], ['lottery', 'Lottery'], ['draft', 'Draft'], ['resign', 'Re-sign'], ['freeAgency', 'Free agency'], ['ready', 'New season'],
]
const NEXT: Record<OffseasonStep, string> = {
  awards: 'On to the season recap', recap: 'On to the lottery', lottery: 'Start the draft', draft: 'Finish the draft', resign: 'Open free agency',
  freeAgency: 'Sim the rest of free agency', ready: 'Start the new season',
}

export function Offseason() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const sim = useStore((s) => s.sim)
  const busy = useStore((s) => s.busy)
  const [open, setOpen] = useState<string | null>(null)
  const os = league.offseason
  if (league.phase !== 'offseason' || !os) return <Navigate to="/office" replace />
  const me = league.userTeamId
  const idx = STEPS.findIndex(([s]) => s === os.step)
  const r = os.report
  const startProblem = os.step === 'ready' ? seasonStartProblem(league) : null
  const expiring = Object.values(league.players).filter((p) => p.teamId === me && p.contract && p.contract.expires === league.season).sort((a, b) => ovrOf(b) - ovrOf(a))
  const myChanges = r.changes.filter((c) => c.teamId === me).sort((a, b) => b.to - b.from - (a.to - a.from))
  const leagueMovers = r.changes.filter((c) => c.teamId !== me).sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from)).slice(0, 8)
  const notableRetired = r.retired.filter((x) => x.teamId === me || x.ovr >= 74).sort((a, b) => b.ovr - a.ovr).slice(0, 10)
  const myRights = Object.values(league.draftRights).filter((t) => t === me).length

  return (
    <div className="stack">
      <h1>Offseason <span className="muted" style={{ fontSize: '1.2rem' }}>after season {league.season}</span></h1>
      <ol className="stepper">
        {STEPS.map(([s, label], i) => <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{label}</li>)}
      </ol>

      {os.step === 'awards' && (() => {
        const a = league.awards.find((x) => x.season === league.season)
        return a ? (
          <section className="panel stack">
            <h2>🎤 Season {league.season} awards</h2>
            <AwardsCeremony league={league} a={a} />
          </section>
        ) : <p className="muted">No awards this season.</p>
      })()}

      {os.step === 'recap' && (
        <div className="grid-2">
          <section className="panel stack">
            <h2>📈 Your summer development</h2>
            {myChanges.length ? (
              <ul className="progress-list">
                {myChanges.map((c) => (
                  <li key={c.playerId}><Link className="link" to={`/player/${c.playerId}`}>{fullName(league.players[c.playerId])}</Link><span className={c.to > c.from ? 'delta-up' : 'delta-down'}>{c.from} → {c.to}</span></li>
                ))}
              </ul>
            ) : <p className="muted">No changes.</p>}
          </section>
          <section className="panel stack">
            <h2>🌎 Around the league</h2>
            <ul className="progress-list">
              {leagueMovers.map((c) => (
                <li key={c.playerId}><Link className="link" to={`/player/${c.playerId}`}>{fullName(league.players[c.playerId])} <span className="muted">{c.teamId ? league.teams[c.teamId].abbrev : 'FA'}</span></Link><span className={c.to > c.from ? 'delta-up' : 'delta-down'}>{c.from} → {c.to}</span></li>
              ))}
            </ul>
          </section>
          <section className="panel stack">
            <h2>👋 Retirements</h2>
            {notableRetired.length ? (
              <ul className="progress-list">
                {notableRetired.map((x) => (
                  <li key={x.playerId}><Link className="link" to={`/player/${x.playerId}`}>{fullName(league.players[x.playerId])} <span className="muted">{x.teamId ? league.teams[x.teamId].abbrev : 'FA'}</span></Link><span className="muted">age {x.age} · {x.ovr} OVR</span></li>
                ))}
              </ul>
            ) : <p className="muted">No notable retirements.</p>}
            <span className="muted">{r.retired.length} players retired in all.</span>
            {league.hof.some((h) => h.season === league.season) && (
              <p className="notice" style={{ margin: 0 }}>🎖️ Hall of Fame: {league.hof.filter((h) => h.season === league.season).map((h) => fullName(league.players[h.playerId])).join(', ')}</p>
            )}
          </section>
          <section className="panel stack">
            <h2>📋 Coaching changes</h2>
            {r.coaching.length ? (
              <ul className="progress-list">
                {r.coaching.map((c) => {
                  const h = league.coaches[c.hiredId]
                  const f = c.firedId ? league.coaches[c.firedId] : null
                  return <li key={c.teamId}><span>{league.teams[c.teamId].name}</span><span className="muted">{f ? `fired ${f.lastName}, ` : ''}hired {h.firstName} {h.lastName}</span></li>
                })}
              </ul>
            ) : <p className="muted">Every coach kept his job.</p>}
            <Link className="link" to="/office">Change your coach in the front office →</Link>
          </section>
        </div>
      )}

      {os.step === 'lottery' && (
        <section className="panel stack">
          <h2>🎰 The lottery is in</h2>
          <p style={{ margin: 0 }}>Watch the picks get revealed one by one.</p>
          <Link className="btn btn-primary" to="/draft" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>Go to the lottery reveal</Link>
        </section>
      )}

      {os.step === 'draft' && (
        <section className="panel stack">
          <h2>🎓 Draft day</h2>
          <p style={{ margin: 0 }}>Make your picks in the draft room. Finishing the draft auto-picks any picks you have left.</p>
          <Link className="btn btn-primary" to="/draft" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>Go to the draft room</Link>
        </section>
      )}

      {os.step === 'resign' && (
        <section className="panel stack">
          <h2>✍️ Re-sign your players</h2>
          <p className="muted" style={{ margin: 0 }}>
            These deals end now. Make an offer; the better it is versus their ask (and the happier and more winning they are), the likelier they say yes. Three rejections and they walk. Anyone unsigned hits free agency.
          </p>
          {myRights > 0 && <p className="notice">You have {myRights} unsigned draft pick{myRights > 1 ? 's' : ''}. <Link className="link" to="/draft">Sign them in the draft room.</Link></p>}
          <CapBar league={league} teamId={me} />
          {expiring.length ? (
            <div className="table-wrap">
              <table className="stats">
                <thead><tr><th>Player</th><th>Age</th><th>OVR</th><th>Mood</th><th>Asking</th><th>Odds at ask</th><th></th></tr></thead>
                <tbody>
                  {expiring.map((p) => {
                    const ask = askSalary(league, p), yrs = askYears(p)
                    const tries = os.resignTries[p.id] ?? 0
                    const done = tries >= 3 || p.morale < 25
                    return [
                      <tr key={p.id}>
                        <td><PlayerCell league={league} p={p} subtitle={`${p.pos} · was ${money(p.contract!.salary)}`} /></td>
                        <td>{p.age}</td><td><OvrPill value={ovrOf(p)} pot={p.pot} /></td><td>{p.morale}</td>
                        <td>{money(ask)} × {yrs}y</td><td>{Math.round(resignChance(league, p, ask, yrs) * 100)}%</td>
                        <td>{done ? <span className="loss">Won’t talk</span> : <button className="btn" onClick={() => setOpen(open === p.id ? null : p.id)}>Offer{tries ? ` (${3 - tries} left)` : ''}</button>}</td>
                      </tr>,
                      open === p.id && (
                        <tr key={p.id + 'o'} className="offer-row"><td colSpan={7}>
                          <OfferForm ask={ask} years={yrs} onCancel={() => setOpen(null)} onSubmit={(salary, years) => {
                            act((l, rng) => {
                              const res = offerResign(l, rng, p.id, salary, years)
                              return res === 'signed' ? `✅ ${fullName(p)} re-signed: ${years} yrs, ${money(salary)}/yr.`
                                : res === 'walked' ? `👋 ${fullName(p)} is done negotiating and will test free agency.`
                                : `❌ ${fullName(p)} said no. Try a better offer.`
                            })
                            setOpen(null)
                          }} />
                        </td></tr>
                      ),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">No expiring contracts.</p>}
        </section>
      )}

      {os.step === 'freeAgency' && (
        <section className="panel stack">
          <h2>🛒 Free agency · day {os.faDay} of {FA_DAYS}</h2>
          <p style={{ margin: 0 }}>Make offers in the free agent market, then sim days to let players decide.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/free-agents" style={{ textDecoration: 'none' }}>Go to free agents</Link>
            <button className="btn" disabled={busy} onClick={() => sim({ type: 'faDays', days: 1 })}>Next day</button>
          </div>
          <CapBar league={league} teamId={me} />
        </section>
      )}

      {os.step === 'ready' && (
        <section className="panel stack">
          <h2>🏀 Ready for season {league.season + 1}</h2>
          <CapBar league={league} teamId={me} />
          {startProblem ? <p className="notice">{startProblem} <Link className="link" to="/free-agents">Free agents →</Link></p> : <p style={{ margin: 0 }}>Your roster is legal. Unsigned draft picks will be released, and a new schedule drawn up.</p>}
        </section>
      )}

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {busy && <span className="spinner" role="status" aria-label="Working" />}
        <button className="btn btn-primary big" disabled={busy || !!startProblem} onClick={() => sim({ type: 'offseason' })}>{NEXT[os.step]} →</button>
      </div>
    </div>
  )
}
