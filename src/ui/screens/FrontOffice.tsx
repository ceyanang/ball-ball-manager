import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tradesOpen } from '../../engine/gm/cap'
import { hireCoach } from '../../engine/gm/offseason'
import { TRAINING_SLOTS, breakoutChance, coachFactor, isTraining, startTraining, stopTraining } from '../../engine/gm/training'
import { Face } from '../face/Face'
import { CapBar } from '../components/CapBar'
import { DataTable, type Column } from '../components/DataTable'
import type { Coach, Player } from '../../engine/types'
import { OvrPill } from '../components/OvrPill'
import { useStore } from '../store'
import { fullName, ovrOf, rosterOf } from '../util'

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
    ['/trade-finder', '🔎 Trade finder', open ? 'Shop your players and see what teams offer.' : deadlineNote, open],
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

      <DevProgram />

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
            <DataTable<Coach>
              ariaLabel="Available coaches"
              rows={pool}
              rowKey={(c) => c.id}
              columns={[
                { key: 'coach', label: 'Coach', align: 'left', defaultDir: 'asc', value: (c) => `${c.firstName} ${c.lastName}` },
                { key: 'style', label: 'Style', align: 'left', defaultDir: 'asc', value: (c) => STYLE[c.style] },
                { key: 'dev', label: 'Dev', defaultDir: 'desc', value: (c) => c.dev },
                { key: 'career', label: 'Career', defaultDir: 'desc', value: (c) => c.wins, text: (c) => `${c.wins}–${c.losses}` },
                { key: 'age', label: 'Age', defaultDir: 'asc', value: (c) => c.age },
                { key: 'hire', label: '', defaultDir: 'asc', sortable: false, value: () => null, cell: (c) => <button className="btn" onClick={() => act((l) => { hireCoach(l, c.id); return `${c.firstName} ${c.lastName} is your new coach.` })}>Hire</button> },
              ] satisfies Column<Coach>[]}
            />
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

/** Rough odds label for a breakout over a full season of development. */
function bloomLabel(odds: number): [string, string] {
  return odds >= 0.15 ? ['High', 'var(--win)'] : odds >= 0.07 ? ['Medium', 'var(--gold)'] : ['Low', 'var(--ink-2)']
}

function DevProgram() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const me = league.userTeamId
  const cf = coachFactor(league, me)
  const slots = league.training.filter((t) => league.players[t.playerId]?.teamId === me && !league.players[t.playerId].retired)
  const free = TRAINING_SLOTS - slots.length
  const options = rosterOf(league, me).filter((p) => !isTraining(league, p.id)).sort((a, b) => b.pot - ovrOf(b) - (a.pot - ovrOf(a)) || b.pot - a.pot)
  const odds = (age: number, p: (typeof options)[number]) => Math.min(0.99, 1 - (1 - breakoutChance({ ...p, age }, cf)) ** 8)
  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2>🌱 Development program</h2>
        <span className="muted">{slots.length}/{TRAINING_SLOTS} slots · {cf >= 1 ? `coach boosts it ×${cf.toFixed(2)}` : `coach slows it ×${cf.toFixed(2)}`}</span>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Pick the players you believe in. They grow faster and slide slower, and every so often one breaks out and raises his ceiling.
        Late picks and second-rounders bloom most often. Leave the club, retire, or get cut and the slot frees up.
      </p>
      {slots.length > 0 && (
        <ul className="tx-list">
          {slots.map((t) => {
            const p = league.players[t.playerId]
            const start = p.ratingHistory.find((h) => h.season === t.season)?.ovr ?? ovrOf(p)
            const d = ovrOf(p) - start
            return (
              <li key={p.id}>
                <Link className="link" to={`/player/${p.id}`}>🌱 {fullName(p)} <span className="muted">{p.pos} · {p.age}</span></Link>
                <span><OvrPill value={ovrOf(p)} pot={p.pot} /> <span className="muted">since S{t.season}: {d > 0 ? `+${d}` : d}</span></span>
                <button className="btn" onClick={() => act((l) => stopTraining(l, p.id))}>Remove</button>
              </li>
            )
          })}
        </ul>
      )}
      {free > 0 && options.length > 0 && (
        <DataTable<Player>
          ariaLabel="Players to invest in"
          rows={options.slice(0, 10)}
          rowKey={(p) => p.id}
          cards
          columns={[
            { key: 'player', label: 'Invest in…', align: 'left', defaultDir: 'asc', mobile: 'main', value: (p) => fullName(p), cell: (p) => <><Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link> <span className="muted">{p.pos}</span></> },
            { key: 'age', label: 'Age', defaultDir: 'asc', value: (p) => p.age },
            { key: 'ovr', label: 'OVR', defaultDir: 'desc', mobile: 'key', value: (p) => ovrOf(p), cell: (p) => <OvrPill value={ovrOf(p)} pot={p.pot} /> },
            { key: 'draft', label: 'Draft', align: 'left', defaultDir: 'asc', value: (p) => (p.draft ? p.draft.pick + (p.draft.round - 1) * 100 : null), text: (p) => (p.draft ? `R${p.draft.round} #${p.draft.pick}` : p.ratingHistory[0]?.season > 1 ? 'Undrafted' : 'Original roster') },
            { key: 'bloom', label: 'Bloom odds / season', defaultDir: 'desc', mobile: 'key', value: (p) => odds(p.age, p), cell: (p) => { const [label, color] = bloomLabel(odds(p.age, p)); return <span style={{ color, fontWeight: 700 }}>{label}</span> } },
            { key: 'invest', label: '', defaultDir: 'asc', sortable: false, mobile: 'act', value: () => null, cell: (p) => <button className="btn btn-primary" onClick={() => act((l) => startTraining(l, p.id))}>Invest</button> },
          ] satisfies Column<Player>[]}
        />
      )}
      {free === 0 && <p className="muted" style={{ margin: 0 }}>All slots are full. Remove someone to invest in a new player.</p>}
    </section>
  )
}
