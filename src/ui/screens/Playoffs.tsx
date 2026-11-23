import { seedPlayoffs } from '../../engine/season/playoffs'
import { Bracket } from '../components/Bracket'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { teamFull } from '../util'

export function Playoffs() {
  const league = useStore((s) => s.league)!
  const projected = league.playoffs === null
  const bracket = league.playoffs ?? seedPlayoffs(league)
  const champ = bracket.championId ? league.teams[bracket.championId] : null
  return (
    <div className="stack">
      <h1>Playoffs</h1>
      {projected && <div className="notice">If the season ended today. Seeds update as games are played.</div>}
      {champ && (
        <div className="scoreboard" style={{ background: `linear-gradient(120deg, ${champ.colors.primary}, ${champ.colors.secondary})` }}>
          <TeamBadge team={champ} size={60} />
          <div><div className="team-line">{teamFull(champ)}</div><div className="sub">Season {bracket.season} champions</div></div>
        </div>
      )}
      <div className="panel">
        <Bracket league={league} bracket={bracket} />
        <div className="row muted" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}><span>West</span><span>East</span></div>
      </div>
    </div>
  )
}
