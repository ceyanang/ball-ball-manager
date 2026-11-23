import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { STARTERS, ACTIVE_MAX } from '../../engine/constants'
import { archetypeFor } from '../../engine/player/archetype'
import { computeOvr } from '../../engine/player/ratings'
import { SLOTS, autoRotation, coachRotation, validateRotation } from '../../engine/sim/rotation'
import type { Player, Rotation } from '../../engine/types'
import { Face } from '../face/Face'
import { OvrPill } from '../components/OvrPill'
import { dropInRotation, type DropTarget, type Section } from '../rotationEdit'
import { useStore } from '../store'
import { Link } from 'react-router-dom'
import { CapBar } from '../components/CapBar'
import { MinutesPanel, cleanMinutes } from '../components/MinutesPanel'
import { capSeason } from '../../engine/gm/cap'
import { releasePlayer } from '../../engine/gm/roster'
import { fullName, money, one, ovrOf, rosterOf, seasonLine } from '../util'
import { useUnsavedGuard } from '../useUnsavedGuard'

const LABEL: Record<Section, string> = { starters: 'Starting five', bench: 'Bench', inactive: 'Inactive' }
const BENCH_SLOTS = ACTIVE_MAX - STARTERS
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

const keyOf = (t: DropTarget) => ('append' in t ? `${t.section}:+` : `${t.section}:${t.index}`)
function parseKey(k: string): DropTarget {
  const [section, rest] = k.split(':') as [Section, string]
  return rest === '+' ? { section, append: true } : { section, index: Number(rest) }
}

interface DragState { id: string; x: number; y: number; over: string | null }

export function MyTeam() {
  const league = useStore((s) => s.league)!
  const busy = useStore((s) => s.busy)
  const setRotation = useStore((s) => s.setRotation)
  const act = useStore((s) => s.act)
  const team = league.teams[league.userTeamId]
  const roster = rosterOf(league, team.id)
  const [draft, setDraft] = useState<Rotation>(team.rotation)
  const [picked, setPicked] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const pending = useRef<{ id: string; x: number; y: number; started: boolean } | null>(null)
  const justDragged = useRef(false)
  // Sims return a cloned league, so compare by content: only reset the draft when the saved rotation really changed.
  const savedKey = JSON.stringify(team.rotation)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(team.rotation), [savedKey])
  const problems = validateRotation(draft, roster.map((p) => p.id))
  const dirty = JSON.stringify(draft) !== JSON.stringify(team.rotation)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2200)
    return () => clearTimeout(t)
  }, [saved])
  useUnsavedGuard(dirty, 'Leave without saving your rotation changes?')

  const locked = !!draft.auto
  const drop = (id: string, target: DropTarget) => { if (!locked) setDraft((d) => dropInRotation(d, id, target)) }
  const setAuto = (on: boolean) => {
    setPicked(null)
    if (on) setDraft(coachRotation(roster))
    else setDraft((d) => { const { auto: _auto, ...rest } = d; void _auto; return rest })
  }
  const save = () => {
    setRotation(team.id, cleanMinutes(draft))
    // setRotation refuses an invalid rotation (and shows why); only confirm when it went through.
    if (useStore.getState().league?.teams[team.id].rotation === team.rotation) return
    setSaved(true)
  }
  const reset = () => { setPicked(null); setDraft(team.rotation) }

  /** Tap/click: pick a player, then tap where they should go. */
  const tap = (target: DropTarget, id?: string) => {
    if (locked) return
    if (picked) {
      if (picked !== id) drop(picked, target)
      setPicked(null)
    } else if (id) setPicked(id)
  }

  const overAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop]')
    return el?.getAttribute('data-drop') ?? null
  }

  const startPointer = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0 || locked) return
    const onGrip = (e.target as HTMLElement).closest('.grip')
    if (!onGrip && (e.target as HTMLElement).closest('a, button')) return
    // On touch screens only the grip drags, so the page can still scroll.
    if (e.pointerType !== 'mouse' && !onGrip) return
    if (onGrip) e.preventDefault()
    pending.current = { id, x: e.clientX, y: e.clientY, started: false }
    const move = (ev: PointerEvent) => {
      const p = pending.current
      if (!p) return
      if (!p.started && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 6) return
      p.started = true
      ev.preventDefault()
      setPicked(null)
      setDrag({ id: p.id, x: ev.clientX, y: ev.clientY, over: overAt(ev.clientX, ev.clientY) })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const p = pending.current
      pending.current = null
      if (!p?.started) return
      justDragged.current = true
      setTimeout(() => (justDragged.current = false), 0)
      const over = ev.type === 'pointerup' ? overAt(ev.clientX, ev.clientY) : null
      if (over) drop(p.id, parseKey(over))
      setDrag(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const card = (p: Player, target: DropTarget, slotLabel?: string) => {
    const k = keyOf(target)
    const slot = target.section === 'starters' && !('append' in target) ? SLOTS[target.index] : null
    const offPos = slot && slot !== p.pos
    const line = seasonLine(league, p)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(target, p.id) }
      if (e.key === 'Escape') setPicked(null)
    }
    return (
      <div
        key={p.id}
        className={`rcard${picked === p.id ? ' picked' : ''}${drag?.id === p.id ? ' dragging' : ''}${drag && drag.over === k && drag.id !== p.id ? ' over' : ''}${picked && picked !== p.id ? ' target' : ''}`}
        data-drop={k}
        role="button"
        tabIndex={0}
        aria-pressed={picked === p.id}
        aria-label={`${fullName(p)}, ${p.pos}${slotLabel ? `, ${slotLabel}` : ''}. ${picked && picked !== p.id ? 'Press to swap here.' : 'Press to pick up.'}`}
        onPointerDown={(e) => startPointer(e, p.id)}
        onClick={(e) => { if (!justDragged.current && !(e.target as HTMLElement).closest('a')) tap(target, p.id) }}
        onKeyDown={onKey}
      >
        <span className="grip" aria-hidden="true">⠿</span>
        {slotLabel && <span className={`slot-tag${offPos ? ' off' : ''}`}>{slotLabel}</span>}
        <Face seed={p.faceSeed} age={p.age} colors={team.colors} size={40} title={fullName(p)} />
        <span className="rinfo">
          <span className="rname">{fullName(p)}</span>
          <span className="rsub">
            {p.pos} · {archetypeFor(p)} · STA {p.ratings.stam}
            {line ? ` · ${one(line.pg.pts)}/${one(line.pg.reb)}/${one(line.pg.ast)}` : ''}
          </span>
          {offPos && <span className="rwarn">Natural {p.pos} · {computeOvr(p.ratings, slot)} as {slot}</span>}
          {p.injury && <span className="hurt">🤕 {p.injury.gamesRemaining >= 999 ? 'out for season' : `${p.injury.gamesRemaining}g`}</span>}
        </span>
        <OvrPill value={ovrOf(p)} pot={p.pot} />
      </div>
    )
  }

  const openSlot = (section: Section, text: string, key: string) => {
    const target: DropTarget = { section, append: true }
    const k = keyOf(target)
    return (
      <button
        key={key}
        className={`rcard open${drag?.over === k ? ' over' : ''}${picked ? ' target' : ''}`}
        data-drop={k}
        onClick={() => tap(target)}
        disabled={!picked && !drag}
      >
        {text}
      </button>
    )
  }

  const ghost = drag ? league.players[drag.id] : null

  return (
    <div className={`stack${drag ? ' is-dragging' : ''}`}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>{team.name} rotation</h1>
        <div className="row">
          <button className="btn" disabled={locked} title="Best starters and bench, with the coach's suggested minutes" onClick={() => { setPicked(null); setDraft(autoRotation(roster)) }}>Best lineup</button>
          <button className="btn" disabled={!dirty} onClick={reset}>Reset</button>
          <button className="btn btn-primary" disabled={!dirty || problems.length > 0 || busy} onClick={save}>Save rotation</button>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '70ch' }}>
        Drag a player onto a spot to swap them in (on a phone, drag by the ⠿ grip), or tap a player and then tap where they go.
        Starters play the listed position; bench order sets who subs in first. Injured players sit and the best fit off the bench takes their spot.
      </p>
      <label className="panel auto-coach">
        <input type="checkbox" checked={locked} onChange={(e) => setAuto(e.target.checked)} />
        <span>
          <b>🤖 Let the coach run the rotation</b>
          <span className="muted">Before every game he picks the optimal starters, bench and minutes around who’s healthy. Untick to set them yourself.</span>
        </span>
      </label>
      {problems.length > 0 && <div className="notice" role="status">{problems.join(' ')}</div>}

      <section className="panel rot-section">
        <h3>{LABEL.starters}</h3>
        <div className="rot-grid starters">
          {draft.starters.map((id, i) => card(league.players[id], { section: 'starters', index: i }, SLOTS[i] ?? '—'))}
        </div>
      </section>

      <section className="panel rot-section">
        <h3>{LABEL.bench} <span className="count">{draft.bench.length}/{BENCH_SLOTS}</span></h3>
        <div className="rot-grid">
          {draft.bench.map((id, i) => card(league.players[id], { section: 'bench', index: i }, ordinal(i + 6)))}
          {draft.bench.length < BENCH_SLOTS && openSlot('bench', '+ Open bench spot', 'bench-open')}
        </div>
      </section>

      <section className="panel rot-section">
        <h3>{LABEL.inactive} <span className="count">{draft.inactive.length}</span></h3>
        <div className="rot-grid">
          {draft.inactive.map((id, i) => card(league.players[id], { section: 'inactive', index: i }))}
          {openSlot('inactive', '+ Move to inactive', 'inactive-open')}
        </div>
      </section>

      <MinutesPanel rot={draft} players={league.players} disabled={locked} onChange={(minutes) => setDraft((d) => {
        const { minutes: _m, ...rest } = d
        void _m
        return minutes ? { ...rest, minutes } : rest
      })} />

      {dirty && (
        <div className="save-bar" role="region" aria-label="Unsaved rotation changes">
          <span className="save-bar-msg">{problems.length ? '⚠️ Not valid yet' : 'Unsaved changes'}</span>
          <button className="btn" onClick={reset}>Reset</button>
          <button className="btn btn-primary" disabled={problems.length > 0 || busy} onClick={save}>Save rotation</button>
        </div>
      )}
      {saved && <div className="toast" role="status">✓ Rotation saved</div>}

      <section className="panel stack">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h3>Contracts</h3>
          <Link className="link muted" to="/office">Front office →</Link>
        </div>
        <CapBar league={league} teamId={team.id} />
        <div className="table-wrap">
          <table className="stats">
            <thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>Salary</th><th>Through</th><th></th></tr></thead>
            <tbody>
              {[...roster].sort((a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0)).map((p) => {
                const expiring = !p.contract || p.contract.expires < capSeason(league)
                return (
                  <tr key={p.id}>
                    <td><Link className="link" to={`/player/${p.id}`}>{fullName(p)}</Link></td>
                    <td>{p.pos}</td><td>{p.age}</td><td><OvrPill value={ovrOf(p)} pot={p.pot} /></td>
                    <td>{p.contract ? money(p.contract.salary) : '—'}</td>
                    <td>{expiring ? <span className="muted">expiring</span> : `Season ${p.contract!.expires}`}</td>
                    <td><button className="btn btn-danger" disabled={busy} onClick={() => {
                      const msg = expiring ? `Let ${fullName(p)} go?` : `Release ${fullName(p)}? He goes on waivers; if nobody claims him, his ${money(p.contract!.salary)}/yr through season ${p.contract!.expires} stays on your cap as dead money.`
                      if (confirm(msg)) act((l) => { releasePlayer(l, p.id); return `${fullName(p)} was released.` })
                    }}>Release</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {ghost && drag && (
        <div className="drag-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
          <Face seed={ghost.faceSeed} age={ghost.age} colors={team.colors} size={34} />
          <span>{fullName(ghost)}</span>
          <OvrPill value={ovrOf(ghost)} />
        </div>
      )}
    </div>
  )
}
