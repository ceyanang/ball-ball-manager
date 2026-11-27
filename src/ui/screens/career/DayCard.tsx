import { Link } from 'react-router-dom'
import { ovrOf } from '../../../engine/career/careerOvr'
import { useStore } from '../../store'
import { nextGame, teamFull } from '../../util'

/** Home card for MyCareer: today's game with Play (full rewards) and Sim (half), plus a quick way to skip ahead. */
export function DayCard() {
  const league = useStore((s) => s.league)!
  const busy = useStore((s) => s.busy)
  const careerDay = useStore((s) => s.careerDay)
  const sim = useStore((s) => s.sim)
  const careerOffseason = useStore((s) => s.careerOffseason)
  const c = league.career
  if (!c || c.status !== 'active') return null
  const p = league.players[c.playerId]
  const team = p.teamId ? league.teams[p.teamId] : null
  const next = team ? nextGame(league, team.id) : undefined
  const today = next && next.day === league.day ? next : null
  const opp = today && team ? league.teams[today.homeId === team.id ? today.awayId : today.homeId] : null
  const offseason = league.phase === 'offseason'
  const resuming = c.pending !== null
  const injured = !!p.injury

  return (
    <div className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <b>{p.firstName} {p.lastName}</b> <span className="muted">· {p.pos} · {p.age} · Career OVR</span> <b className="num">{ovrOf(p)}</b>
        </div>
        <Link className="link" to={`/player/${p.id}`}>Player page</Link>
      </div>
      {offseason ? (
        <div>The season is over. The draft, free agency and the summer all happen around you.</div>
      ) : today && opp ? (
        <div>Day {league.day}: {today.homeId === team!.id ? 'vs' : '@'} <b>{teamFull(opp)}</b>{injured && ' — you’re hurt, the game sims without you'}</div>
      ) : (
        <div className="muted">{team ? `No game today (day ${league.day}).` : 'You’re a free agent — no games until you sign.'}</div>
      )}
      {offseason ? (
        <div className="row"><button className="btn btn-primary" disabled={busy} onClick={() => void careerOffseason()}>Continue to next season</button></div>
      ) : (
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => void careerDay('play')}>{resuming ? 'Resume game' : today && !injured ? 'Play' : 'Next day'}</button>
        {today && !injured && <button className="btn" disabled={busy} title="Half the growth, none of the pressure" onClick={() => void careerDay('sim')}>Sim</button>}
        <button className="btn" disabled={busy} onClick={() => void sim({ type: 'simDays', days: 7 })}>Sim a week</button>
      </div>
      )}
    </div>
  )
}
