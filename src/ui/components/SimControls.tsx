import { useState } from 'react'
import { Link } from 'react-router-dom'
import { committed } from '../../engine/gm/cap'
import { userSeries } from '../../engine/season/advance'
import { ROSTER_MAX, ROSTER_MIN } from '../../engine/constants'
import type { League } from '../../engine/types'
import { useStore } from '../store'
import { nextGame, teamGames, winLoss } from '../util'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

/** The user can't sim with an illegal roster (spec §10). */
export function rosterProblem(l: League): string | null {
  const n = committed(l, l.userTeamId).length
  if (n < ROSTER_MIN) return `You need ${ROSTER_MIN} players to play (you have ${n}).`
  if (n > ROSTER_MAX) return `You have ${n} players; the max is ${ROSTER_MAX}.`
  return null
}

/** Sims seven days, then sums up the user's week ("Week: 2–3") unless something more important is being shown. */
async function simWeek(sim: (cmd: { type: 'simDays'; days: number }) => Promise<void>) {
  const before = useStore.getState().league
  if (!before) return
  const played = (l: League) => new Set(teamGames(l, l.userTeamId).filter((g) => g.result).map((g) => g.id))
  const seen = played(before)
  await sim({ type: 'simDays', days: 7 })
  const s = useStore.getState()
  if (!s.league || s.league === before || s.notice || s.error || s.watch) return
  const week = teamGames(s.league, s.league.userTeamId).filter((g) => g.result && !seen.has(g.id))
  const { w, l } = winLoss(week, s.league.userTeamId)
  useStore.setState({ notice: week.length ? `Week: ${w}–${l}` : 'Week done — no games for you this week.' })
}

type SimAction = { key: string; label: string; short: string; primary?: boolean; run: () => void }

/** Shared by the desktop button row and the mobile header so both offer the same sims. */
export function useSim() {
  const league = useStore((s) => s.league)
  const busy = useStore((s) => s.busy)
  const sim = useStore((s) => s.sim)
  const startWatch = useStore((s) => s.startWatch)
  if (!league || league.phase === 'offseason') return null
  const problem = rosterProblem(league)
  const playsToday = nextGame(league, league.userTeamId)?.day === league.day
  const watch: SimAction[] = playsToday ? [{ key: 'watch', label: 'Watch game', short: 'Play today\'s game live', primary: true, run: () => void startWatch() }] : []
  const series: SimAction[] = league.phase === 'playoffs' && userSeries(league) ? [{ key: 'series', label: 'Sim series', short: 'Until your series is decided', run: () => sim({ type: 'simUntil', target: 'seriesEnd' }) }] : []
  const base: SimAction[] = league.phase === 'regular'
    ? [
        { key: 'day', label: 'Sim day', short: 'Next day', run: () => sim({ type: 'simDays', days: 1 }) },
        { key: 'week', label: 'Sim week', short: 'Next 7 days', run: () => void simWeek(sim) },
        ...(league.day < league.tradeDeadlineDay ? [{ key: 'deadline', label: 'Sim to deadline', short: `Up to the trade deadline (day ${league.tradeDeadlineDay})`, run: () => sim({ type: 'simUntil', target: 'deadline' }) }] : []),
        { key: 'end', label: 'Sim to end of season', short: 'Play out the regular season', primary: true, run: () => sim({ type: 'simUntil', target: 'regularEnd' }) },
      ]
    : [
        { key: 'day', label: 'Sim day', short: 'Next playoff day', run: () => sim({ type: 'simDays', days: 1 }) },
        { key: 'end', label: 'Sim playoffs', short: 'Play out the playoffs', primary: true, run: () => sim({ type: 'simUntil', target: 'playoffsEnd' }) },
      ]
  const actions = [...watch, ...base.slice(0, 1), ...series, ...base.slice(1)].map((a) => (playsToday && a.primary && a.key !== 'watch' ? { ...a, primary: false } : a))
  return { problem, actions, disabled: busy || !!problem, busy }
}

const OFFSEASON_STEP: Record<string, string> = { awards: 'Awards', recap: 'Recap', lottery: 'Lottery', draft: 'Draft', resign: 'Re-signing', freeAgency: 'Free agency', ready: 'Ready to start' }

export function SimControls() {
  const league = useStore((s) => s.league)
  const s = useSim()
  if (!league) return null
  if (!s) {
    const step = league.offseason?.step
    return (
      <div className="sim-controls">
        <span className="muted">{step ? (step === 'freeAgency' ? `Free agency day ${league.offseason?.faDay}` : OFFSEASON_STEP[step]) : ''}</span>
        <Link className="btn btn-primary" to="/offseason">Offseason →</Link>
      </div>
    )
  }
  return (
    <div className="sim-controls" aria-busy={s.busy}>
      {s.problem && <Link to="/free-agents" className="loss" style={{ fontWeight: 600 }}>⚠️ {s.problem}</Link>}
      {s.actions.map((a) => (
        <button key={a.key} className={a.primary ? 'btn btn-primary' : 'btn'} disabled={s.disabled} onClick={a.run}>{a.label}</button>
      ))}
      {s.busy && <span className="spinner" role="status" aria-label="Simulating" />}
    </div>
  )
}

/** Mobile: one big thumb-sized "Sim day" plus a sheet with the longer sims. */
export function MobileSim() {
  const league = useStore((s) => s.league)
  const s = useSim()
  const [open, setOpen] = useState(false)
  if (!league) return null
  if (!s) {
    return <Link className="btn btn-primary msim-go" to="/offseason">Offseason</Link>
  }
  const [first, ...others] = s.actions
  const simDay = first.key === 'watch' ? others.find((a) => a.key === 'day') : undefined
  const rest = simDay ? others.filter((a) => a !== simDay) : others
  return (
    <>
      <div className="msim" aria-busy={s.busy}>
        <button className="btn btn-primary msim-go" disabled={s.disabled} onClick={first.run}>
          {s.busy ? <span className="spinner on-accent" role="status" aria-label="Simulating" /> : <Icon name="play" size={16} />}
          {s.busy ? 'Simming' : first.key === 'watch' ? 'Watch' : first.label}
        </button>
        {simDay && <button className="btn msim-day" disabled={s.disabled} onClick={simDay.run}>Sim day</button>}
        <button className="btn msim-more" disabled={s.disabled} onClick={() => setOpen(true)} aria-label="More sim options" aria-haspopup="dialog">
          <Icon name="more" size={20} />
        </button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Sim ahead">
        <div className="sheet-list">
          {rest.map((a) => (
            <button key={a.key} className={`sheet-row${a.primary ? ' primary' : ''}`} disabled={s.disabled} onClick={() => { setOpen(false); a.run() }}>
              <span className="sheet-row-main">{a.label}</span>
              <span className="sheet-row-sub">{a.short}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

/** Mobile-only banner when the roster blocks simming; the desktop row shows it inline. */
export function MobileRosterWarning() {
  const s = useSim()
  if (!s?.problem) return null
  return <Link to="/free-agents" className="m-warn">⚠️ {s.problem} <span aria-hidden="true">→</span></Link>
}
