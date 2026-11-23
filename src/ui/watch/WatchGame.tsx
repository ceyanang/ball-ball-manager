import type { CSSProperties } from 'react'
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setIntensity } from '../../audio/engine'
import { sfx } from '../../audio/sfx'
import { setSettings, useAudioSettings } from '../../audio/settings'
import { sfxFor } from '../../audio/watchSfx'
import { computeStandings } from '../../engine/standings'
import { perGame, playerSeasonStats } from '../../engine/stats/stats'
import type { PlayEvent, Side } from '../../engine/sim/playlog'
import type { Game, League, Player, Team } from '../../engine/types'
import { useStore, type WatchSession } from '../store'
import { fullName, seasonLine, teamFull } from '../util'
import { QuarterBreak, type RecapRow } from './QuarterBreak'
import {
  advanceTo, beatsAverage, benchLine, clockText, elapsedFraction, eventCards, feedItems, finalState, initState, isHot,
  periodCount, periodLabel, periodMs, pushFeed, shotDelays, shotMs, sittingIds, standout, type FeedItem, type ReplayState,
} from './replay'
import { courtTheme, distinctColor } from '../color'
import { Sheet } from '../components/Sheet'
import { recapRows } from './recap'
import { WatchCard } from './WatchCard'
import { WatchPlayerSheet } from './WatchPlayerSheet'
import './watch.css'
import { Help } from '../components/Help'

type Phase = 'play' | 'break' | 'final'
type ShotKind = 'made' | 'miss' | 'blocked'

const SPEEDS = [1, 2, 4] as const
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Full-screen replay of the user's game. Shell renders only this while a watch session is open (no spoilers). */
export function WatchGame() {
  const watch = useStore((s) => s.watch)
  const league = useStore((s) => s.league)
  const endWatch = useStore((s) => s.endWatch)
  const navigate = useNavigate()
  const game = watch && league ? (watch.game ?? league.games.find((g) => g.id === watch.gameId)) : undefined
  if (!watch || !league || !game?.result) {
    return (
      <div className="w-screen">
        <div className="w-wrap">
          <p className="muted">This game can’t be replayed.</p>
          <button className="btn btn-primary" onClick={() => { endWatch(); navigate(watch?.doneTo ?? '/'); window.scrollTo(0, 0) }}>Done</button>
        </div>
      </div>
    )
  }
  return <WatchView key={watch.gameId} watch={watch} league={league} game={game} />
}

/** Everything about the matchup that doesn't change while watching; records and averages come from before the game. */
function useMatchup(watch: WatchSession, game: Game) {
  return useMemo(() => {
    const { before } = watch
    const box = game.result!.box
    const userHome = game.homeId === before.userTeamId
    const sideOf = (teamId: string): Side => (teamId === game.homeId ? 'home' : 'away')
    const userSide: Side = userHome ? 'home' : 'away'
    const oppSide: Side = userHome ? 'away' : 'home'
    const teamOf: Record<Side, Team> = { home: before.teams[game.homeId], away: before.teams[game.awayId] }
    const starters: Record<Side, string[]> = { home: [], away: [] }
    const bench: Record<Side, string[]> = { home: [], away: [] }
    const all: Record<Side, string[]> = { home: [], away: [] }
    const sideOfPlayer: Record<string, Side> = {}
    const cardOf: Record<string, string> = {}
    const players: Record<string, Player> = {}
    const ppg: Record<string, number | null> = {}
    for (const b of box) {
      const side = sideOf(b.teamId)
      ;(b.gs ? starters : bench)[side].push(b.playerId)
      all[side].push(b.playerId)
      sideOfPlayer[b.playerId] = side
      cardOf[b.playerId] = b.gs ? b.playerId : `bench-${side}`
      const p = before.players[b.playerId]
      if (!p) continue
      players[p.id] = p
      ppg[p.id] = seasonPpg(before, p)
    }
    const rows = Object.values(computeStandings(before, before.season)).flat()
    const record = (t: Team) => {
      const r = rows.find((x) => x.teamId === t.id)
      return r ? `${r.w}–${r.l}` : ''
    }
    let meta = watch.meta ?? `Day ${game.day} · ${userHome ? 'Home' : 'Road'}`
    const series = game.playoff && before.playoffs?.series.find((s) => s.id === game.playoff!.seriesId)
    if (game.playoff && series) {
      const hi = Math.max(series.highWins, series.lowWins), lo = Math.min(series.highWins, series.lowWins)
      const leader = before.teams[series.highWins > series.lowWins ? series.highSeedId : series.lowSeedId]
      meta = `Playoffs · Game ${game.playoff.gameNum} · ${hi === lo ? `Series tied ${hi}–${lo}` : `${leader.abbrev} leads ${hi}–${lo}`}`
    }
    return { userSide, oppSide, teamOf, starters, bench, all, sideOfPlayer, cardOf, players, ppg, record, meta }
  }, [watch, game])
}

/** Season ppg for the current part of the season: playoff average once he has playoff games. */
function seasonPpg(before: League, p: Player): number | null {
  if (before.phase === 'playoffs') {
    const s = playerSeasonStats(before, p.id, before.season, true)
    if (s && s.gp > 0) return perGame(s).pts
  }
  return seasonLine(before, p)?.pg.pts ?? null
}

function WatchView({ watch, league, game }: { watch: WatchSession; league: League; game: Game }) {
  const navigate = useNavigate()
  const endWatch = useStore((s) => s.endWatch)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const m = useMatchup(watch, game)
  const { log } = watch
  const nPeriods = Math.max(1, periodCount(log))
  const favs = useMemo(() => new Set(league.favoritePlayerIds), [league.favoritePlayerIds])

  const [rs, setRs] = useState<ReplayState>(initState)
  const [clock, setClock] = useState({ period: 1, t: 0 })
  const [phase, setPhase] = useState<Phase>('play')
  const [speed, setSpeed] = useState<number>(1)
  const [feed, setFeed] = useState<FeedItem[]>(() => pushFeed([], [{ text: `Tip-off in ${m.teamOf.home.city}…`, kind: 'info' }]))
  const [confirmExit, setConfirmExit] = useState(false)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const audio = useAudioSettings()

  const rsRef = useRef(rs)
  const clockRef = useRef(clock)
  const speedRef = useRef(speed)
  const announced = useRef(new Set<string>())
  const timers = useRef(new Set<number>())
  const cards = useRef(new Map<string, HTMLElement>())
  const fxRef = useRef<HTMLDivElement>(null)
  const rimRef = useRef<HTMLDivElement>(null)
  const netRef = useRef<HTMLDivElement>(null)

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cards.current.set(id, el)
    else cards.current.delete(id)
  }, [])
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn() }, ms)
    timers.current.add(id)
  }
  const clearFx = () => {
    for (const id of timers.current) clearTimeout(id)
    timers.current.clear()
    fxRef.current?.replaceChildren()
  }
  useEffect(() => clearFx, [])
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => { setIntensity(0); return () => setIntensity(0) }, [])

  /** Flies a ball from a card to the rim: made = through the net, miss = off the rim, blocked = swatted away. */
  function shoot(cardId: string, side: Side, kind: ShotKind, pts: number, ft: boolean, salt: number) {
    const fx = fxRef.current, card = cards.current.get(cardId), rim = rimRef.current
    if (!fx || !card || !rim) return
    const box = fx.getBoundingClientRect(), c = card.getBoundingClientRect(), r = rim.getBoundingClientRect()
    const cx = r.left - box.left + r.width / 2 - 9, rimY = r.top - box.top + r.height / 2 - 9
    const sx = c.left - box.left + c.width / 2 - 9
    const above = c.top + c.height / 2 < r.top
    const sy = above ? c.bottom - box.top - 24 : c.top - box.top
    const apex = Math.min(sy, rimY) - (ft ? 35 : 70)
    const dur = ft ? 600 / Math.sqrt(speedRef.current) : shotMs(speedRef.current)
    const dir = salt % 2 ? 1 : -1
    const at = (x: number, y: number, deg: number) => `translate(${x}px, ${y}px) rotate(${deg}deg)`
    const frames: Keyframe[] =
      kind === 'made' ? [
        { transform: at(sx, sy, 0), offset: 0 },
        { transform: at((sx + cx) / 2, apex, 200), offset: 0.45 },
        { transform: at(cx, rimY - 14, 330), offset: 0.72 },
        { transform: at(cx, rimY + 4, 360), offset: 0.82 },
        { transform: at(cx, rimY + 34, 380), opacity: 1, offset: 0.95 },
        { transform: at(cx, rimY + 40, 390), opacity: 0, offset: 1 },
      ]
      : kind === 'miss' ? [
        { transform: at(sx, sy, 0), offset: 0 },
        { transform: at((sx + cx) / 2, apex, 200), offset: 0.45 },
        { transform: at(cx + dir * 18, rimY - 6, 330), offset: 0.75 },
        { transform: at(cx + dir * 60, rimY - 40, 420), offset: 0.88 },
        { transform: at(cx + dir * 90, rimY + 20, 470), opacity: 0, offset: 1 },
      ]
      : [
        { transform: at(sx, sy, 0), offset: 0 },
        { transform: at(sx + (cx - sx) * 0.4, sy + (apex - sy) * 0.8, 120), offset: 0.4 },
        { transform: at(sx + (cx - sx) * 0.4 + dir * 140, sy + (above ? -30 : 30), 520), opacity: 0, offset: 1 },
      ]
    const ball = document.createElement('div')
    ball.className = 'w-ball'
    fx.appendChild(ball)
    ball.animate(frames, { duration: kind === 'blocked' ? dur * 0.7 : dur, easing: 'linear' }).onfinish = () => ball.remove()
    if (kind !== 'made') return
    later(() => {
      netRef.current?.animate(
        [{ transform: 'translateX(-50%) scaleY(1)' }, { transform: 'translateX(-50%) scaleY(1.35)' }, { transform: 'translateX(-50%) scaleY(1)' }],
        { duration: 400 },
      )
      const pop = document.createElement('div')
      pop.className = 'w-float'
      pop.textContent = `+${pts}`
      pop.style.color = ink[side]
      pop.style.left = `${cx + 30}px`
      pop.style.top = `${rimY - 10}px`
      fx.appendChild(pop)
      pop.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-34px)', opacity: 0 }], { duration: 900, fill: 'forwards' }).onfinish = () => pop.remove()
    }, dur * 0.82)
  }

  /** Balls for every shot in a batch; free throws a beat apart (after the make on an and-one). */
  function animate(fired: PlayEvent[], start: number, court: ReplayState['court']) {
    const delays = shotDelays(fired, speedRef.current)
    const cardIds = eventCards(court, fired, m.sideOfPlayer, m.cardOf)
    fired.forEach((e, i) => {
      const idx = start + i
      if (e.k === 'fg') {
        const kind: ShotKind = e.made ? 'made' : log[idx + 1]?.k === 'blk' ? 'blocked' : 'miss'
        shoot(cardIds[i], e.side, kind, e.three ? 3 : 2, false, idx)
      } else if (e.k === 'ft') {
        later(() => shoot(cardIds[i], e.side, e.made ? 'made' : 'miss', 1, true, idx), delays[i])
      } else if (e.k === 'sub') {
        const el = cards.current.get(`${e.side}-slot-${e.slot}`)
        if (!el) return
        el.classList.remove('swap')
        void el.offsetWidth
        el.classList.add('swap')
        later(() => el.classList.remove('swap'), 800)
      }
    })
  }

  /** Sounds for a batch of plays, timed to when each ball reaches the rim (free throws tick as they launch). */
  function scheduleSfx(fired: PlayEvent[], start: number) {
    const delays = shotDelays(fired, speedRef.current)
    const rate = Math.sqrt(speedRef.current)
    fired.forEach((e, i) => {
      const names = sfxFor(e, log[start + i + 1])
      if (!names.length) return
      if (e.k === 'ft') {
        later(() => sfx.ftTick(), delays[i])
        later(() => names.slice(1).forEach((n) => sfx[n]()), delays[i] + 480 / rate)
      } else later(() => names.forEach((n) => sfx[n]()), shotMs(speedRef.current) * 0.8)
    })
  }

  const onFired = useEffectEvent((next: ReplayState, fired: PlayEvent[], start: number, court: ReplayState['court']) => {
    let hot: string | null = null
    for (const e of fired) {
      if ((e.k !== 'fg' && e.k !== 'ft') || !e.made || announced.current.has(e.player)) continue
      const pts = next.lines[e.player]?.pts ?? 0, avg = m.ppg[e.player] ?? null
      const p = m.players[e.player]
      if (p && avg !== null && beatsAverage(pts, avg)) {
        announced.current.add(e.player)
        hot = `🔥 ${fullName(p)} already has ${pts}. He averages ${avg.toFixed(1)}.`
      }
    }
    const last = (id: string) => m.players[id]?.lastName ?? '?'
    const items = feedItems(fired, last)
    if (hot) {
      sfx.crowd()
      items.push({ text: hot, kind: 'hot' })
    }
    if (items.length) setFeed((f) => pushFeed(f, items))
    scheduleSfx(fired, start)
    if (!reducedMotion()) animate(fired, start, court)
  })

  // The replay clock: advance t by real time × speed, fire the events reached, pause at the end of each period.
  useEffect(() => {
    if (phase !== 'play' || confirmExit) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - last))
      last = now
      const { period } = clockRef.current
      const t = Math.min(1, clockRef.current.t + (dt * speedRef.current) / periodMs(period))
      clockRef.current = { period, t }
      const prev = rsRef.current
      const { state, fired } = advanceTo(log, prev, period, t)
      if (fired.length) {
        rsRef.current = state
        setRs(state)
        onFired(state, fired, prev.cursor, prev.court)
      }
      setClock({ period, t })
      if (t >= 1) {
        clearFx()
        sfx.buzzer()
        setPhase(period >= nPeriods ? 'final' : 'break')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, confirmExit, log, nPeriods])

  const nextPeriod = () => {
    const period = clockRef.current.period + 1
    clockRef.current = { period, t: 0 }
    setIntensity(period >= 4 ? 1 : 0)
    setClock(clockRef.current)
    setFeed((f) => pushFeed(f, [{ text: `${periodLabel(period)} is under way`, kind: 'info' }]))
    setPhase('play')
  }
  const skipToFinal = () => {
    clearFx()
    sfx.buzzer()
    const f = finalState(log)
    rsRef.current = f
    clockRef.current = { period: nPeriods, t: 1 }
    setRs(f)
    setClock(clockRef.current)
    setFeed((f) => pushFeed(f, [{ text: 'Final', kind: 'info' }]))
    setPhase('final')
  }
  const done = () => { endWatch(); navigate(watch.doneTo ?? '/'); window.scrollTo(0, 0) }
  /** Leave mid-game without seeing the result: the game is already played and saved, so it still counts. */
  const leave = () => { clearFx(); endWatch(); navigate('/'); window.scrollTo(0, 0) }
  // All-Star games aren't in league.games, so only league games have a box score page.
  const boxScore = watch.game ? undefined : () => { endWatch(); navigate(`/game/${game.id}`); window.scrollTo(0, 0) }

  const frac = elapsedFraction(clock.period, clock.t)
  const lineOf = (id: string) => rs.lines[id] ?? benchLine(rs, [])
  const us = m.teamOf[m.userSide], them = m.teamOf[m.oppSide]
  const score = (side: Side) => rs[side]
  const theme = courtTheme(m.teamOf.home.colors, m.teamOf.away.colors)
  const ink: Record<Side, string> = { home: theme.homeInk, away: theme.awayInk }
  const screenStyle = {
    '--court': theme.court, '--court-2': theme.court2, '--court-line': theme.line,
    '--them-ink': ink[m.oppSide], '--us-ink': ink[m.userSide],
  } as CSSProperties

  const card = (side: Side, cardId: string, id: string) => {
    const l = lineOf(id)
    return (
      <WatchCard key={cardId} cardId={cardId} player={m.players[id] ?? null} team={m.teamOf[side]} benchCount={0}
        pts={l.pts} reb={l.reb} ast={l.ast} hot={isHot(l.pts, m.ppg[id] ?? null, frac)} fav={favs.has(id)} register={register} />
    )
  }
  const row = (side: Side) => {
    // New logs: five slot cards (a swap changes who stands in a slot) + a bench card of everyone sitting right now.
    // Legacy logs (no lineup events): the starters + one lump of everyone who didn't start.
    const court = rs.court?.[side]
    const sitting = court ? sittingIds(m.all[side], court) : m.bench[side]
    const b = benchLine(rs, sitting)
    return (
      <div className="w-row6">
        {court ? court.map((id, k) => card(side, `${side}-slot-${k}`, id)) : m.starters[side].map((id) => card(side, id, id))}
        <WatchCard cardId={`bench-${side}`} player={null} team={m.teamOf[side]} benchCount={sitting.length}
          pts={b.pts} reb={b.reb} ast={b.ast} hot={false} fav={false} register={register} />
      </div>
    )
  }

  const teamHead = (t: Team) => (
    <div className="w-teamhead"><h2>{teamFull(t)}</h2><span className="w-rec">{m.record(t)}</span></div>
  )

  const breakView = () => {
    const final = phase === 'final'
    const diff = score(m.userSide) - score(m.oppSide)
    const ot = nPeriods > 4 ? `/${periodLabel(nPeriods)}` : ''
    const title = final ? `Final${ot} · ${diff > 0 ? 'You win 🎉' : 'L 😤'}` : `End of ${periodLabel(clock.period)}`
    const leader = diff === 0 ? 'Tied' : `${(diff > 0 ? us : them).name} by ${Math.abs(diff)}`
    const all = [...m.starters.home, ...m.starters.away, ...m.bench.home, ...m.bench.away]
    const sid = standout(rs, m.ppg, frac, all)
    const sp = sid ? m.players[sid] : null
    const avg = sid ? m.ppg[sid] ?? null : null
    const standoutText = sp ? `👀 Standout: ${fullName(sp)}, ${lineOf(sid!).pts} pts${avg !== null ? ` (avg ${avg.toFixed(1)})` : ''}` : null
    const dot: Record<string, string> = { [us.id]: us.colors.primary, [them.id]: distinctColor(them.colors, us.colors.primary) }
    const rows: RecapRow[] = [m.userSide, m.oppSide].flatMap((side) => recapRows(rs, { starters: m.starters[side], bench: m.bench[side] }, m.teamOf[side], m.players, favs))
    return (
      <QuarterBreak
        title={title}
        scoreText={`${us.abbrev} ${score(m.userSide)} – ${score(m.oppSide)} ${them.abbrev}`}
        leader={leader}
        standout={standoutText}
        rows={rows}
        button={final ? 'Done' : `Start ${periodLabel(clock.period + 1)} ▶`}
        onButton={final ? done : nextPeriod}
        onPick={setSheetId}
        dotColors={dot}
        onBoxScore={final ? boxScore : undefined}
      />
    )
  }

  const sheetPlayer = sheetId ? m.players[sheetId] ?? null : null
  const sheetTeam = sheetId ? m.teamOf[m.sideOfPlayer[sheetId] ?? 'away'] : null

  return (
    <div className="w-screen" style={screenStyle}>
      <div className="w-wrap">
        <div className="w-top">
          <span className="w-meta">🏀 {m.meta}</span>
          <span className="row">
            <Help topics={['tiers']} label="What do the card colours mean?" />
            <button className="btn" aria-pressed={audio.muted} aria-label={audio.muted ? 'Unmute sound' : 'Mute sound'} onClick={() => setSettings({ muted: !audio.muted })}>{audio.muted ? '🔇' : '🔊'}</button>
            {phase !== 'final' && <button className="btn" onClick={() => setConfirmExit(true)}>Exit</button>}
          </span>
        </div>

        <div className="w-court">
          <div className="w-play" inert={phase !== 'play'}>
            {teamHead(them)}
            {row(m.oppSide)}
            <div className="w-mid">
              <div className="w-qbox" aria-label={`${periodLabel(clock.period)}, ${clockText(clock.period, clock.t)} left`}>
                <div className="w-q">{periodLabel(clock.period)}</div>
                <div className="w-clock">{clockText(clock.period, clock.t)}</div>
              </div>
              <div className="w-hoop" aria-hidden="true">
                <div className="w-board" />
                <div className="w-rim" ref={rimRef} />
                <div className="w-net" ref={netRef} />
              </div>
              <div className="w-score" aria-label={`${them.name} ${score(m.oppSide)}, ${us.name} ${score(m.userSide)}`}>
                <div className="w-n them"><small>{them.abbrev}</small>{score(m.oppSide)}</div>
                <div className="w-sep" />
                <div className="w-n us"><small>{us.abbrev}</small>{score(m.userSide)}</div>
              </div>
            </div>
            {row(m.userSide)}
            {teamHead(us)}
          </div>
          <div className="w-fx" ref={fxRef} aria-hidden="true" />
          {phase !== 'play' && breakView()}
        </div>

        {/* Play-by-play, newest on top. Swaps are a dimmer line so they never hide a bucket; hot callouts fade in. */}
        <ol className="w-feed" aria-label="Play-by-play" aria-live="off">
          {feed.map((f) => <li key={f.id} className={`w-ev ${f.kind}`}>{f.text}</li>)}
        </ol>

        {phase !== 'final' && (
          <div className="w-controls">
            <div className="w-speed" role="group" aria-label="Speed">
              {SPEEDS.map((s) => (
                <button key={s} aria-pressed={speed === s} onClick={() => { speedRef.current = s; setSpeed(s) }}>{s}×</button>
              ))}
            </div>
            <span className="w-spacer" />
            <button className="btn" onClick={skipToFinal}>Skip to final</button>
          </div>
        )}
      </div>

      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Leave the game?">
        <p style={{ margin: 0 }}>The game still counts — you’ll see the result in the box score.</p>
        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setConfirmExit(false)}>Keep watching</button>
          <button className="btn btn-primary" onClick={leave}>Leave</button>
        </div>
      </Sheet>

      <WatchPlayerSheet
        player={sheetPlayer}
        team={sheetTeam}
        line={sheetId ? lineOf(sheetId) : benchLine(rs, [])}
        ppg={sheetId ? m.ppg[sheetId] ?? null : null}
        frac={frac}
        periods={clock.period}
        final={phase === 'final'}
        fav={!!sheetId && favs.has(sheetId)}
        onToggleFav={() => sheetId && toggleFavorite(sheetId)}
        onClose={() => setSheetId(null)}
        onOpenPage={() => { const id = sheetId; endWatch(); navigate(`/player/${id}`) }}
      />
    </div>
  )
}
