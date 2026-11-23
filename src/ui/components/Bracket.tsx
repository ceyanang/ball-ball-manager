import type { League, PlayoffBracket, Series } from '../../engine/types'
import { TeamBadge } from './TeamBadge'

function SeriesBox({ league, s, champ, mine }: { league: League; s: Series | undefined; champ?: boolean; mine?: boolean }) {
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
    <div className={`series ${champ ? 'champ' : ''} ${mine ? 'mine' : ''}`}>
      {row(s.highSeedId, s.highSeed, s.highWins)}
      {row(s.lowSeedId, s.lowSeed, s.lowWins)}
    </div>
  )
}

/** The playoff tree. With `conf` it shows that conference's three rounds plus the Finals; without, both sides around the Finals. */
export function Bracket({ league, bracket, conf, highlightTeamId }: { league: League; bracket: PlayoffBracket; conf?: 'East' | 'West'; highlightTeamId?: string }) {
  const find = (c: 'East' | 'West' | null, round: number, k: number) => bracket.series.find((s) => s.conf === c && s.round === round && s.id.endsWith(`_r${round}_${k}`))
  const mine = (s: Series | undefined) => !!s && !!highlightTeamId && (s.highSeedId === highlightTeamId || s.lowSeedId === highlightTeamId)
  const champ = !!bracket.championId
  const col = (c: 'East' | 'West', round: number, n: number) => (
    <div className="bracket-col">{Array.from({ length: n }, (_, k) => { const s = find(c, round, k); return <SeriesBox key={k} league={league} s={s} mine={mine(s)} /> })}</div>
  )
  const finals = find(null, 4, 0)
  const finalsCol = <div className="bracket-col"><div className="muted" style={{ textAlign: 'center', fontWeight: 600 }}>Finals</div><SeriesBox league={league} s={finals} champ={champ} mine={mine(finals)} /></div>
  if (conf) {
    return (
      <div className="bracket bracket-conf">
        {col(conf, 1, 4)}
        {col(conf, 2, 2)}
        {col(conf, 3, 1)}
        {finalsCol}
      </div>
    )
  }
  return (
    <div className="bracket">
      {col('West', 1, 4)}
      {col('West', 2, 2)}
      {col('West', 3, 1)}
      {finalsCol}
      {col('East', 3, 1)}
      {col('East', 2, 2)}
      {col('East', 1, 4)}
    </div>
  )
}
