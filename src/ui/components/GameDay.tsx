import { Link } from 'react-router-dom'
import { archetypeFor } from '../../engine/player/archetype'
import { SLOTS, gameLineup } from '../../engine/sim/rotation'
import type { Game, League, Player, Team } from '../../engine/types'
import { Face } from '../face/Face'
import { fullName, one, ovrOf, rosterOf, seasonLine, teamFull } from '../util'
import { OvrPill } from './OvrPill'
import { TeamBadge } from './TeamBadge'

/** The lineup a team will actually start today, plus its headliner (best OVR among the five). */
function todaysFive(league: League, team: Team) {
  const five = gameLineup(team, league.players).starters.map((id) => league.players[id])
  const star = five.reduce<Player | null>((best, p) => (!best || ovrOf(p) > ovrOf(best) ? p : best), null)
  const out = rosterOf(league, team.id).filter((p) => p.injury).sort((a, b) => ovrOf(b) - ovrOf(a))
  return { five, star, out }
}

function StarterCard({ league, team, p, slot, crowned }: { league: League; team: Team; p: Player; slot: string; crowned: boolean }) {
  const line = seasonLine(league, p)
  return (
    <Link to={`/player/${p.id}`} className={`gd-starter${crowned ? ' king' : ''}`}>
      <span className="gd-slot">{slot}</span>
      <span className="gd-face">
        {crowned && <span className="gd-crown" role="img" aria-label="Main guy">👑</span>}
        <Face seed={p.faceSeed} age={p.age} colors={team.colors} size={64} jersey={p.jersey} title={fullName(p)} />
      </span>
      <span className="gd-name">{p.firstName[0]}. {p.lastName}</span>
      <span className="gd-arch">{archetypeFor(p)}</span>
      <OvrPill value={ovrOf(p)} />
      <span className="gd-line">{line ? `${one(line.pg.pts)} pts · ${one(line.pg.reb)} reb · ${one(line.pg.ast)} ast` : `${p.pos} · no games yet`}</span>
    </Link>
  )
}

export function GameDayHero({ league, game, team, records }: {
  league: League; game: Game; team: Team; records: Record<string, { w: number; l: number }>
}) {
  const home = game.homeId === team.id
  const opp = league.teams[home ? game.awayId : game.homeId]
  const them = todaysFive(league, opp)
  const us = todaysFive(league, team)
  const rec = (t: Team) => records[t.id] ? `${records[t.id].w}–${records[t.id].l}` : ''
  const series = game.playoff && league.playoffs?.series.find((s) => s.id === game.playoff!.seriesId)
  const seriesText = series
    ? (() => {
        const mine = series.highSeedId === team.id ? series.highWins : series.lowWins
        const theirs = series.highSeedId === team.id ? series.lowWins : series.highWins
        return mine === theirs ? `Series tied ${mine}–${theirs}` : `${mine > theirs ? 'You lead' : 'You trail'} ${Math.max(mine, theirs)}–${Math.min(mine, theirs)}`
      })()
    : null

  return (
    <section
      className="gameday"
      aria-label={`Game day: ${home ? 'vs' : 'at'} ${teamFull(opp)}`}
      style={{ ['--us' as string]: team.colors.primary, ['--them' as string]: opp.colors.primary }}
    >
      <div className="gd-top">
        <span className="gd-chip">🔥 Game day</span>
        <span className="gd-meta">
          Day {game.day} · {home ? 'Home' : 'Road'}{game.playoff ? ` · Playoffs game ${game.playoff.gameNum}` : ''}{seriesText ? ` · ${seriesText}` : ''}
        </span>
      </div>

      <div className="gd-matchup">
        <div className="gd-team">
          <TeamBadge team={team} size={72} />
          <div><div className="gd-abbr">{team.abbrev}</div><div className="gd-rec">{rec(team)}</div></div>
        </div>
        <div className="gd-vs">{home ? 'VS' : '@'}</div>
        <div className="gd-team right">
          <div><div className="gd-abbr">{opp.abbrev}</div><div className="gd-rec">{rec(opp)}</div></div>
          <TeamBadge team={opp} size={72} />
        </div>
      </div>

      <div className="gd-head">
        <h3>{teamFull(opp)} starting five</h3>
        {them.star && <span className="gd-watch">👑 Main guy: <strong>{fullName(them.star)}</strong></span>}
      </div>
      <div className="gd-five">
        {them.five.map((p, i) => <StarterCard key={p.id} league={league} team={opp} p={p} slot={SLOTS[i] ?? '—'} crowned={p.id === them.star?.id} />)}
      </div>
      {them.out.length > 0 && (
        <div className="gd-out">🤕 Out for {opp.abbrev}: {them.out.slice(0, 3).map((p) => `${fullName(p)} (${ovrOf(p)})`).join(', ')}</div>
      )}

      <div className="gd-us">
        <span className="gd-us-label">Your five</span>
        {us.five.map((p, i) => (
          <Link key={p.id} to={`/player/${p.id}`} className="gd-us-p">
            <span className="gd-us-slot">{SLOTS[i]}</span>
            <Face seed={p.faceSeed} age={p.age} colors={team.colors} size={30} title={fullName(p)} />
            <span>{p.lastName}{p.id === us.star?.id ? ' 👑' : ''}</span>
            <span className="muted">{ovrOf(p)}</span>
          </Link>
        ))}
        <Link to="/my-team" className="gd-us-edit">Edit rotation →</Link>
      </div>
    </section>
  )
}
