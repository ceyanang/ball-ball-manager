import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tradesOpen } from '../../engine/gm/cap'
import { hireCoach } from '../../engine/gm/offseason'
import { Face } from '../face/Face'
import { CapBar } from '../components/CapBar'
import { useStore } from '../store'

const STYLE: Record<string, string> = { pace: 'Fast pace', three: 'Three-point heavy', defense: 'Defense first', balanced: 'Balanced' }

export function FrontOffice() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const [mine, setMine] = useState(true)
  const team = league.teams[league.userTeamId]
  const coach = league.coaches[team.coachId]
  const open = tradesOpen(league)
  const tx = league.transactions.filter((t) => !mine || t.teamIds.includes(team.id)).slice(-40).reverse()
  const pool = Object.values(league.coaches).filter((c) => !c.teamId && c.age < 70).sort((a, b) => b.dev - a.dev).slice(0, 8)
  const deadlineNote =
    league.phase === 'regular' ? (open ? `Trade deadline: day ${league.tradeDeadlineDay}` : 'The trade deadline has passed.')
    : league.phase === 'playoffs' ? 'Trades reopen after the Finals.' : 'Trades are open all offseason.'

  const cards: [string, string, string, boolean][] = [
    ['/trade', '🔄 Trade', open ? 'Build a deal or ask what it would take.' : deadlineNote, true],
    ['/free-agents', '✍️ Free agents', 'Sign players and claim waivers.', true],
    ['/draft', '🎓 Draft', league.draft ? 'Lottery, big board and draft room.' : 'Opens after the season.', !!league.draft],
    ['/offseason', '🗓️ Offseason', league.phase === 'offseason' ? 'Pick up where you left off.' : 'Starts after the Finals.', league.phase === 'offseason'],
  ]

  return (
    <div className="stack">
      <h1>Front office</h1>
      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2>Cap sheet</h2>
          <span className="muted">{deadlineNote}</span>
        </div>
        <CapBar league={league} teamId={team.id} />
      </section>

      <div className="office-cards">
        {cards.map(([to, title, sub, on]) => (
          <Link key={to} to={to} className={`office-card${on ? '' : ' off'}`}>
            <span className="office-title">{title}</span>
            <span className="muted">{sub}</span>
          </Link>
        ))}
      </div>

      <section className="panel stack">
        <h2>Coach</h2>
        <div className="row">
          <Face seed={coach.faceSeed} age={coach.age} colors={team.colors} size={56} />
          <div>
            <div style={{ fontWeight: 700 }}>{coach.firstName} {coach.lastName}</div>
            <div className="muted">{STYLE[coach.style]} · development {coach.dev} · career {coach.wins}–{coach.losses} · age {coach.age}</div>
          </div>
        </div>
        {league.phase === 'offseason' ? (
          <>
            <h3>Available coaches</h3>
            <div className="table-wrap">
              <table className="stats">
                <thead><tr><th>Coach</th><th>Style</th><th>Dev</th><th>Career</th><th>Age</th><th></th></tr></thead>
                <tbody>
                  {pool.map((c) => (
                    <tr key={c.id}>
                      <td>{c.firstName} {c.lastName}</td><td>{STYLE[c.style]}</td><td>{c.dev}</td><td>{c.wins}–{c.losses}</td><td>{c.age}</td>
                      <td><button className="btn" onClick={() => act((l) => { hireCoach(l, c.id); return `${c.firstName} ${c.lastName} is your new coach.` })}>Hire</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <p className="muted" style={{ margin: 0 }}>Coaching changes can be made in the offseason. Development helps players 25 and under grow.</p>}
      </section>

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Transactions</h2>
          <div className="seg">
            <button className="btn" aria-pressed={mine} onClick={() => setMine(true)}>{team.name}</button>
            <button className="btn" aria-pressed={!mine} onClick={() => setMine(false)}>League</button>
          </div>
        </div>
        {tx.length ? (
          <ul className="tx-list">
            {tx.map((t, i) => (
              <li key={i}><span className={`tx-tag ${t.type}`}>{t.type}</span><span>{t.text}</span><span className="muted">S{t.season}{t.phase === 'offseason' ? ' offseason' : ` · day ${t.day}`}</span></li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>No moves yet.</p>}
      </section>
    </div>
  )
}
