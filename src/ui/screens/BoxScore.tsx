import { Navigate, useParams } from 'react-router-dom'
import type { BoxLine, League, Team } from '../../engine/types'
import { PlayerCell } from '../components/PlayerCell'
import { TeamBadge } from '../components/TeamBadge'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName, teamFull } from '../util'

const pctStr = (m: number, a: number) => (a ? ((m / a) * 100).toFixed(1) : '—')

function TeamBox({ league, team, lines, rosterIds }: { league: League; team: Team; lines: BoxLine[]; rosterIds: string[] }) {
  const played = lines.filter((b) => b.min > 0).sort((a, b) => Number(b.gs) - Number(a.gs) || b.min - a.min)
  const dnp = rosterIds.filter((id) => !played.some((b) => b.playerId === id))
  const tot = played.reduce((t, b) => {
    for (const k of ['pts', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'min'] as const) t[k] += b[k]
    return t
  }, { pts: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, min: 0 })
  return (
    <section className="panel stack">
      <div className="row"><TeamBadge team={team} /><h2>{teamFull(team)}</h2></div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Starters are listed above the line.</p>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Player</th><th>MIN</th><th>PTS</th><th>REB</th><th>OREB</th><th>DREB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th><th>FG</th><th>3P</th><th>FT</th><th>+/-</th></tr></thead>
          <tbody>
            {played.map((b, i) => (
              <tr key={b.playerId} className={b.gs && !played[i + 1]?.gs ? 'last-starter' : ''}>
                <td><PlayerCell league={league} p={league.players[b.playerId]} size={28} showInjury={false} subtitle={league.players[b.playerId].pos} /></td>
                <td>{b.min}</td><td><strong>{b.pts}</strong></td><td>{b.oreb + b.dreb}</td><td>{b.oreb}</td><td>{b.dreb}</td><td>{b.ast}</td><td>{b.stl}</td><td>{b.blk}</td><td>{b.tov}</td><td>{b.pf}</td>
                <td>{b.fgm}-{b.fga}</td><td>{b.tpm}-{b.tpa}</td><td>{b.ftm}-{b.fta}</td><td>{b.pm > 0 ? `+${b.pm}` : b.pm}</td>
              </tr>
            ))}
            {dnp.map((id) => {
              const p = league.players[id]
              if (!p) return null
              const hurt = lines.every((b) => b.playerId !== id) && p.injury
              return <tr key={id} className="dnp"><td><PlayerCell league={league} p={p} size={28} showInjury={false} subtitle={p.pos} /></td><td colSpan={14} className="left">{hurt ? 'DNP – Injured' : 'DNP – Coach’s decision'}</td></tr>
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Team</td><td>{tot.min}</td><td>{tot.pts}</td><td>{tot.oreb + tot.dreb}</td><td>{tot.oreb}</td><td>{tot.dreb}</td><td>{tot.ast}</td><td>{tot.stl}</td><td>{tot.blk}</td><td>{tot.tov}</td><td>{tot.pf}</td>
              <td>{tot.fgm}-{tot.fga}<br /><span className="muted">{pctStr(tot.fgm, tot.fga)}%</span></td>
              <td>{tot.tpm}-{tot.tpa}<br /><span className="muted">{pctStr(tot.tpm, tot.tpa)}%</span></td>
              <td>{tot.ftm}-{tot.fta}<br /><span className="muted">{pctStr(tot.ftm, tot.fta)}%</span></td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

export function BoxScore() {
  const { id } = useParams()
  const league = useStore((s) => s.league)!
  const g = league.games.find((x) => x.id === id)
  if (!g || !g.result) return <Navigate to="/schedule" replace />
  const r = g.result
  const home = league.teams[g.homeId], away = league.teams[g.awayId]
  const potg = league.players[r.potg]
  const potgLine = r.box.find((b) => b.playerId === r.potg)
  const periods = r.quarters.home.map((_, i) => (i < 4 ? `Q${i + 1}` : r.quarters.home.length > 5 ? `OT${i - 3}` : 'OT'))
  const roster = (t: Team) => [...t.rotation.starters, ...t.rotation.bench, ...t.rotation.inactive].filter((pid) => league.players[pid]?.teamId === t.id)
  const homeWon = r.homeScore > r.awayScore
  return (
    <div className="stack">
      <section className="panel stack">
        <div className="muted">Day {g.day} · {g.playoff ? `Playoffs, game ${g.playoff.gameNum}` : 'Regular season'} · Final{r.ot ? ` (${r.ot > 1 ? r.ot : ''}OT)` : ''}</div>
        <div className="final-score">
          <TeamBadge team={away} size={52} /><span className={`pts ${homeWon ? 'loser' : ''}`}>{r.awayScore}</span>
          <span className="muted">at</span>
          <span className={`pts ${homeWon ? '' : 'loser'}`}>{r.homeScore}</span><TeamBadge team={home} size={52} />
        </div>
        <div className="linescore">
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Team</th>{periods.map((p) => <th key={p}>{p}</th>)}<th>T</th></tr></thead>
              <tbody>
                <tr><td>{away.name}</td>{r.quarters.away.map((q, i) => <td key={i}>{q}</td>)}<td><strong>{r.awayScore}</strong></td></tr>
                <tr><td>{home.name}</td>{r.quarters.home.map((q, i) => <td key={i}>{q}</td>)}<td><strong>{r.homeScore}</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        {potg && potgLine && (
          <div className="potg">
            <Face seed={potg.faceSeed} age={potg.age} colors={league.teams[potgLine.teamId].colors} size={56} jersey={potg.jersey} />
            <div>
              <div className="muted">Player of the game</div>
              <div style={{ fontWeight: 700 }}>{fullName(potg)}</div>
              <div>{potgLine.pts} pts · {potgLine.oreb + potgLine.dreb} reb · {potgLine.ast} ast · {potgLine.fgm}-{potgLine.fga} FG</div>
            </div>
          </div>
        )}
      </section>
      {r.box.length ? (
        <>
          <TeamBox league={league} team={away} lines={r.box.filter((b) => b.teamId === away.id)} rosterIds={roster(away)} />
          <TeamBox league={league} team={home} lines={r.box.filter((b) => b.teamId === home.id)} rosterIds={roster(home)} />
        </>
      ) : <p className="muted">Full box scores are kept for this season and last; this one has been archived.</p>}
    </div>
  )
}
