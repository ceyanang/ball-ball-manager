import { Link } from 'react-router-dom'
import { SIDE_SIZE, squadOf, userSideIndex } from '../../engine/allstar/allstar'
import type { AllStarEvent, League, Team } from '../../engine/types'
import { PlayerCell } from '../components/PlayerCell'
import { OvrPill } from '../components/OvrPill'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { fullName, ovrOf } from '../util'

const TITLE = { allstar: '🌟 All-Star Game', rising: '✨ Rising Stars' } as const
const SUB = { allstar: 'East vs West · fan vote + coaches, 12 a side', rising: 'Rookies vs Sophomores' } as const

function Squad({ league, ev, team, you }: { league: League; ev: AllStarEvent; team: Team; you: boolean }) {
  const players = squadOf(league, team)
  const starters = new Set(team.rotation.starters)
  const coach = league.coaches[team.coachId]
  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row"><TeamBadge team={team} /><h2 style={{ margin: 0 }}>{team.city} {team.name}</h2></div>
        {you && <span className="pot-chip up">YOUR SIDE</span>}
      </div>
      {coach && <p className="muted" style={{ margin: 0 }}>Coach: {fullName(coach)} ({league.teams[coach.teamId ?? '']?.name ?? '—'})</p>}
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Player</th><th>Pos</th><th>OVR</th><th>Votes</th></tr></thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.id} className={i === team.rotation.starters.length - 1 ? 'last-starter' : ''}>
                <td><PlayerCell league={league} p={p} size={28} showInjury={false} subtitle={`${starters.has(p.id) ? 'Starter · ' : ''}${p.teamId ? league.teams[p.teamId].abbrev : ''}${p.teamId === league.userTeamId ? ' ⭐ yours' : ''}`} /></td>
                <td>{p.pos}</td><td><OvrPill value={ovrOf(p)} /></td>
                <td>{ev.votes[p.id] ? `${Math.round(ev.votes[p.id] / 1000)}K` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Result({ league, ev }: { league: League; ev: AllStarEvent }) {
  const r = ev.result!
  const [a, b] = ev.teams
  const mvp = ev.mvp ? league.players[ev.mvp] : null
  const line = r.box.find((x) => x.playerId === ev.mvp)
  const top = [...r.box].filter((x) => x.min > 0).sort((x, y) => y.pts - x.pts).slice(0, 5)
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-around', flexWrap: 'wrap', fontSize: '1.4rem', fontWeight: 800 }}>
        <span>{a.city}: {r.homeScore}</span><span className="muted">—</span><span>{b.city}: {r.awayScore}</span>
      </div>
      {mvp && line && (
        <p style={{ margin: 0 }}>🏅 MVP: <Link className="link" to={`/player/${mvp.id}`}>{fullName(mvp)}</Link> — {line.pts} pts, {line.oreb + line.dreb} reb, {line.ast} ast</p>
      )}
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Top scorers</th><th>Side</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th></tr></thead>
          <tbody>
            {top.map((x) => (
              <tr key={x.playerId}>
                <td><PlayerCell league={league} p={league.players[x.playerId]} size={28} showInjury={false} subtitle={league.players[x.playerId].pos} /></td>
                <td>{x.teamId === a.id ? a.abbrev : b.abbrev}</td><td>{x.min}</td><td><strong>{x.pts}</strong></td><td>{x.oreb + x.dreb}</td><td>{x.ast}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EventPanel({ league, ev }: { league: League; ev: AllStarEvent }) {
  const busy = useStore((s) => s.busy)
  const playAllStar = useStore((s) => s.playAllStar)
  const me = userSideIndex(league, ev)
  const pending = !ev.result && ev.season === league.season
  return (
    <div className="stack">
      <section className="panel stack">
        <h2>{TITLE[ev.kind]} <span className="muted" style={{ fontWeight: 400, fontSize: '0.9rem' }}>· Season {ev.season}</span></h2>
        <p className="muted" style={{ margin: 0 }}>{SUB[ev.kind]}. It doesn’t count toward anyone’s stats, records or standings — just bragging rights, morale and fan love.</p>
        {pending && (
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <button className="btn btn-primary" disabled={busy} onClick={() => playAllStar(ev.kind, true)}>Watch live</button>
            <button className="btn" disabled={busy} onClick={() => playAllStar(ev.kind, false)}>Sim it</button>
            <span className="muted">You’re {ev.teams[me].city}. If you just keep simming, it plays itself.</span>
          </div>
        )}
        {ev.result && <Result league={league} ev={ev} />}
      </section>
      <div className="grid-2">
        <Squad league={league} ev={ev} team={ev.teams[0]} you={me === 0} />
        <Squad league={league} ev={ev} team={ev.teams[1]} you={me === 1} />
      </div>
    </div>
  )
}

export function AllStar() {
  const league = useStore((s) => s.league)!
  const events = [...league.allStars].sort((a, b) => b.season - a.season || (a.kind === 'allstar' ? -1 : 1))
  const current = events.filter((e) => e.season === league.season)
  const past = events.filter((e) => e.season !== league.season && e.result)
  if (!league.allStars.length)
    return (
      <div className="stack">
        <h1>All-Star Weekend</h1>
        <section className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {league.allStarDay && league.phase === 'regular'
              ? `All-Star Weekend happens at the midpoint of the season (day ${league.allStarDay}). Fans and coaches pick 12 a side — East vs West — plus a Rookies vs Sophomores Rising Stars game.`
              : 'Come back next season: All-Star Weekend happens at the midpoint of the schedule.'}
          </p>
        </section>
      </div>
    )
  return (
    <div className="stack">
      <h1>All-Star Weekend</h1>
      {current.map((ev) => <EventPanel key={ev.kind} league={league} ev={ev} />)}
      {past.length > 0 && (
        <section className="panel stack">
          <h2>Past games</h2>
          <ul className="tx-list">
            {past.map((ev) => {
              const r = ev.result!
              const winner = r.homeScore >= r.awayScore ? ev.teams[0] : ev.teams[1]
              const mvp = ev.mvp ? league.players[ev.mvp] : null
              return (
                <li key={`${ev.season}-${ev.kind}`}>
                  <span>{ev.season} · {ev.kind === 'allstar' ? 'All-Star' : 'Rising Stars'}: {winner.city} {Math.max(r.homeScore, r.awayScore)}–{Math.min(r.homeScore, r.awayScore)}</span>
                  {mvp && <Link className="link" to={`/player/${mvp.id}`}>MVP {fullName(mvp)}</Link>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <p className="muted" style={{ margin: 0 }}>{SIDE_SIZE} players per side.</p>
    </div>
  )
}
