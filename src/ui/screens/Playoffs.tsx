import { seedPlayoffs } from '../../engine/season/playoffs'
import type { League, Series } from '../../engine/types'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { teamFull } from '../util'

function SeriesBox({ league, s, champ }: { league: League; s: Series | undefined; champ?: boolean }) {
  if (!s) return <div className="series tbd">To be decided</div>
  const row = (id: string, seed: number, wins: number) => {
    const t = league.teams[id]
    const cls = s.winnerId ? (s.winnerId === id ? 'won' : 'out') : ''
    return (
      <div className={`s-row ${cls}`}>
        <span className="row" style={{ gap: '0.4rem', minWidth: 0 }}><span className="muted">{seed}</span><TeamBadge team={t} size={22} /><span className="s-name" title={t.name}>{t.name}</span></span>
        <strong>{wins}</strong>
      </div>
    )
  }
  return (
    <div className={`series ${champ ? 'champ' : ''}`}>
      {row(s.highSeedId, s.highSeed, s.highWins)}
      {row(s.lowSeedId, s.lowSeed, s.lowWins)}
    </div>
  )
}

export function Playoffs() {
  const league = useStore((s) => s.league)!
  const projected = league.playoffs === null
  const bracket = league.playoffs ?? seedPlayoffs(league)
  const find = (conf: 'East' | 'West' | null, round: number, k: number) => bracket.series.find((s) => s.conf === conf && s.round === round && s.id.endsWith(`_r${round}_${k}`))
  const champ = bracket.championId ? league.teams[bracket.championId] : null
  const col = (conf: 'East' | 'West', round: number, n: number) => (
    <div className="bracket-col">{Array.from({ length: n }, (_, k) => <SeriesBox key={k} league={league} s={find(conf, round, k)} />)}</div>
  )
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
        <div className="bracket">
          {col('West', 1, 4)}
          {col('West', 2, 2)}
          {col('West', 3, 1)}
          <div className="bracket-col"><div className="muted" style={{ textAlign: 'center', fontWeight: 600 }}>Finals</div><SeriesBox league={league} s={find(null, 4, 0)} champ={!!champ} /></div>
          {col('East', 3, 1)}
          {col('East', 2, 2)}
          {col('East', 1, 4)}
        </div>
        <div className="row muted" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}><span>West</span><span>East</span></div>
      </div>
    </div>
  )
}
