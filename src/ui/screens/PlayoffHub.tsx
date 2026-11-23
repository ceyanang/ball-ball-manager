import { useState } from 'react'
import { Bracket } from '../components/Bracket'
import { useSim } from '../components/SimControls'
import { STAKE_LABEL, seriesStake } from '../playoffs/stakes'
import { useStore } from '../store'
import type { Game, League, Series } from '../../engine/types'

function seriesText(league: League, s: Series): string {
  const hi = league.teams[s.highSeedId].abbrev
  const lo = league.teams[s.lowSeedId].abbrev
  if (s.highWins === s.lowWins) return `Series tied ${s.highWins}–${s.lowWins}`
  return s.highWins > s.lowWins ? `${hi} leads ${s.highWins}–${s.lowWins}` : `${lo} leads ${s.lowWins}–${s.highWins}`
}

function TodayRow({ league, g, series, watch }: { league: League; g: Game; series: Series | undefined; watch: { run: () => void; disabled: boolean } | null }) {
  const away = league.teams[g.awayId]
  const home = league.teams[g.homeId]
  const stake = series && !series.winnerId ? seriesStake(series) : null
  return (
    <div className={`tg${watch ? ' mine' : ''}`}>
      <div>
        <div className="m">{watch && '🏀 '}{away.abbrev} @ {home.abbrev} · Game {g.playoff!.gameNum}</div>
        {series && <div className="s">{seriesText(league, series)}{stake && <> · <span className="stake">{STAKE_LABEL[stake]}</span></>}</div>}
      </div>
      {watch && <button className="btn btn-primary" disabled={watch.disabled} onClick={watch.run}>Watch</button>}
    </div>
  )
}

/** Home during the playoffs: the bracket, today's games and the sim buttons in one place. */
export function PlayoffHub() {
  const league = useStore((s) => s.league)!
  const sim = useSim()
  const bracket = league.playoffs
  const userConf = league.teams[league.userTeamId].conf
  const [conf, setConf] = useState<'East' | 'West'>(userConf)
  if (!bracket) return null
  const open = bracket.series.filter((s) => !s.winnerId)
  const round = open.length ? Math.min(...open.map((s) => s.round)) : Math.max(...bracket.series.map((s) => s.round))
  const today = league.games.filter((g) => g.day === league.day && g.playoff && !g.result)
  const seriesOf = (g: Game) => bracket.series.find((s) => s.id === g.playoff!.seriesId)
  const mine = (g: Game) => g.homeId === league.userTeamId || g.awayId === league.userTeamId
  const watchAction = sim?.actions.find((a) => a.key === 'watch')
  const buttons = sim?.actions.filter((a) => a.key !== 'watch') ?? []
  const lastBtn = buttons.length > 1 && buttons[buttons.length - 1].key === 'end' ? buttons[buttons.length - 1] : null
  const lead = lastBtn ? buttons.slice(0, -1) : buttons
  return (
    <section className="stack" style={{ gap: '0.75rem' }} aria-label="Playoffs">
      <div className="hub-head">
        <h1>Playoffs</h1>
        <span className="hub-pill">Round {round} · Day {league.day}</span>
      </div>
      <div className="panel stack" style={{ gap: '0.5rem' }}>
        <div className="hub-bracket-narrow stack" style={{ gap: '0.5rem' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Bracket</h3>
            <div className="seg">
              {(['West', 'East'] as const).map((c) => <button key={c} className="btn" aria-pressed={conf === c} onClick={() => setConf(c)}>{c}</button>)}
            </div>
          </div>
          <Bracket league={league} bracket={bracket} conf={conf} highlightTeamId={league.userTeamId} />
        </div>
        <div className="hub-bracket-wide">
          <Bracket league={league} bracket={bracket} highlightTeamId={league.userTeamId} />
          <div className="row muted" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}><span>West</span><span>East</span></div>
        </div>
      </div>
      <div className="panel stack" style={{ gap: '0.5rem' }}>
        <h3>Today · {today.length} {today.length === 1 ? 'game' : 'games'}</h3>
        {today.length > 0 ? (
          <div className="today-list">
            {[...today].sort((a, b) => Number(mine(b)) - Number(mine(a))).map((g) => (
              <TodayRow key={g.id} league={league} g={g} series={seriesOf(g)} watch={mine(g) && watchAction && sim ? { run: watchAction.run, disabled: sim.disabled } : null} />
            ))}
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>No games today.</p>}
        {sim && (
          <>
            {sim.problem && <p className="loss" style={{ margin: 0, fontWeight: 600 }}>⚠️ {sim.problem}</p>}
            <div className="hub-controls" aria-busy={sim.busy}>
              {lead.map((a) => <button key={a.key} className={a.primary ? 'btn btn-primary' : 'btn'} disabled={sim.disabled} onClick={a.run}>{a.label}</button>)}
              <span className="spacer" />
              {lastBtn && <button className={lastBtn.primary ? 'btn btn-primary' : 'btn'} disabled={sim.disabled} onClick={lastBtn.run}>{lastBtn.label}</button>}
              {sim.busy && <span className="spinner" role="status" aria-label="Simulating" />}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
