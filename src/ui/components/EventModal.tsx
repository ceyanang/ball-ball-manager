import { useEffect, useRef, useState } from 'react'
import { describePending } from '../../engine/events/engine'
import type { EventLogEntry } from '../../engine/events/state'
import type { League } from '../../engine/types'
import { Face } from '../face/Face'
import { useStore } from '../store'
import { fullName, moodOf, ovrOf } from '../util'
import { OvrPill } from './OvrPill'

const TONE = { good: { icon: '🎯', label: 'Nailed it!' }, bad: { icon: '💥', label: 'Backfired!' }, neutral: { icon: '😐', label: 'Meh.' } } as const

/** Who the event is about: face, name, OVR and current mood (live, so the result card shows the new morale). */
export function EventPlayer({ league, playerId }: { league: League; playerId: string | undefined }) {
  const p = playerId ? league.players[playerId] : undefined
  if (!p) return null
  const team = p.teamId ? league.teams[p.teamId] : undefined
  const mood = moodOf(p.morale)
  return (
    <div className="event-player">
      <Face seed={p.faceSeed} age={p.age} colors={team?.colors ?? { primary: '#5b6378', secondary: '#ffffff' }} size={56} jersey={p.jersey} title={fullName(p)} />
      <div className="event-player-info">
        <div className="event-player-name">{fullName(p)}</div>
        <div className="event-player-sub">#{p.jersey} · {p.pos} · {p.age} yrs</div>
        <div className="event-player-stats">
          <OvrPill value={ovrOf(p)} />
          <span className="event-player-mood" title={`Morale ${p.morale}`}>
            <span aria-hidden="true">{mood.emoji}</span>
            <span>{mood.label} · {p.morale}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** The random pop-up: a prompt with 2–3 answers, then a result card. Game-day events can't be dismissed without answering. */
export function EventModal() {
  const league = useStore((s) => s.league)
  const busy = useStore((s) => s.busy)
  // Never over a game being watched: a post-game pop-up would spoil the result. It shows once the broadcast ends.
  const watching = useStore((s) => !!s.watch)
  const answer = useStore((s) => s.answerEvent)
  const skip = useStore((s) => s.skipEvent)
  const [result, setResult] = useState<(EventLogEntry & { playerId?: string }) | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  const pending = league && !busy && !watching ? describePending(league) : null
  const stale = !!league?.events.pending && !busy && !watching && !pending
  const open = !!pending || !!result

  // A pending event whose player has left (or that no longer exists) is dropped quietly.
  useEffect(() => { if (stale) answer(0) }, [stale, answer])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  if (!open) return <dialog ref={ref} className="sheet" aria-hidden="true" />
  const canSkip = pending?.def.when === 'day'
  return (
    <dialog ref={ref} className="sheet event-sheet" aria-label="Random event" onCancel={(e) => e.preventDefault()}>
      <div className="sheet-body">
        {result ? (
          <div className="event-card" data-tone={result.tone}>
            <div className="event-emoji" aria-hidden="true">{TONE[result.tone].icon}</div>
            <h2>{TONE[result.tone].label}</h2>
            {league && <EventPlayer league={league} playerId={result.playerId} />}
            <p className="event-text">{result.outcomeText}</p>
            {result.changes.length > 0 && <ul className="event-changes">{result.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
            <button className="btn btn-primary big" onClick={() => setResult(null)}>Continue</button>
          </div>
        ) : pending && (
          <div className="event-card">
            <div className="event-emoji" aria-hidden="true">{pending.def.emoji}</div>
            <h2>{pending.title}</h2>
            {league && <EventPlayer league={league} playerId={league.events.pending?.subjects.playerIds[0]} />}
            <p className="event-text">{pending.text}</p>
            <div className="event-choices">
              {pending.def.choices.map((c, i) => (
                <button key={c.label} className="btn event-choice" onClick={() => { const playerId = league?.events.pending?.subjects.playerIds[0]; const r = answer(i); if (r) setResult({ ...r, playerId }) }}>
                  {c.emoji && <span aria-hidden="true">{c.emoji} </span>}{c.label}
                </button>
              ))}
              {canSkip && <button className="btn event-skip" onClick={() => skip()}>Skip</button>}
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
