import { useState } from 'react'
import { Link } from 'react-router-dom'
import { seedPlayoffs } from '../../engine/season/playoffs'
import { Bracket } from '../components/Bracket'
import { SubNav } from '../components/SubNav'
import { TeamBadge } from '../components/TeamBadge'
import { LEAGUE_SUBNAV } from '../nav'
import { useStore } from '../store'
import { teamFull } from '../util'

export function Playoffs() {
  const league = useStore((s) => s.league)!
  const projected = league.playoffs === null
  const bracket = league.playoffs ?? seedPlayoffs(league)
  const champ = bracket.championId ? league.teams[bracket.championId] : null
  const userConf = league.teams[league.userTeamId].conf
  const [conf, setConf] = useState<'East' | 'West'>(userConf)
  return (
    <div className="stack">
      <SubNav items={LEAGUE_SUBNAV} label="League sections" />
      <h1>Playoffs</h1>
      {projected && <div className="notice">If the season ended today. Seeds update as games are played.</div>}
      {champ && (
        <Link to={`/team/${champ.id}`} className="scoreboard link" style={{ background: `linear-gradient(120deg, ${champ.colors.primary}, ${champ.colors.secondary})` }}>
          <TeamBadge team={champ} size={60} />
          <div><div className="team-line">{teamFull(champ)}</div><div className="sub">Season {bracket.season} champions</div></div>
        </Link>
      )}
      <div className="panel stack" style={{ gap: '0.5rem' }}>
        <div className="hub-bracket-narrow stack" style={{ gap: '0.5rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>{conf} bracket</h2>
            <div className="seg" role="group" aria-label="Conference">
              {(['West', 'East'] as const).map((c) => <button key={c} className="btn" aria-pressed={conf === c} onClick={() => setConf(c)}>{c}</button>)}
            </div>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={`${conf} playoff bracket`}>
            <Bracket league={league} bracket={bracket} conf={conf} highlightTeamId={league.userTeamId} />
          </div>
        </div>
        <div className="hub-bracket-wide">
          <Bracket league={league} bracket={bracket} highlightTeamId={league.userTeamId} />
          <div className="row muted" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}><span>West</span><span>East</span></div>
        </div>
      </div>
    </div>
  )
}
