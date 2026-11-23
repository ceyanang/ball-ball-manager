import { useEffect, useRef, useState } from 'react'
import { describePending } from '../../engine/events/engine'
import type { EventLogEntry } from '../../engine/events/state'
import { useStore } from '../store'

const TONE = { good: { icon: '🎯', label: 'Nailed it!' }, bad: { icon: '💥', label: 'Backfired!' }, neutral: { icon: '😐', label: 'Meh.' } } as const

/** The random pop-up: a prompt with 2–3 answers, then a result card. Game-day events can't be dismissed without answering. */
export function EventModal() {
  const league = useStore((s) => s.league)
  const busy = useStore((s) => s.busy)
  // Never over a game being watched: a post-game pop-up would spoil the result. It shows once the broadcast ends.
  const watching = useStore((s) => !!s.watch)
  const answer = useStore((s) => s.answerEvent)
  const skip = useStore((s) => s.skipEvent)
  const [result, setResult] = useState<EventLogEntry | null>(null)
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
            <p className="event-text">{result.outcomeText}</p>
            {result.changes.length > 0 && <ul className="event-changes">{result.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
            <button className="btn btn-primary big" onClick={() => setResult(null)}>Continue</button>
          </div>
        ) : pending && (
          <div className="event-card">
            <div className="event-emoji" aria-hidden="true">{pending.def.emoji}</div>
            <h2>{pending.title}</h2>
            <p className="event-text">{pending.text}</p>
            <div className="event-choices">
              {pending.def.choices.map((c, i) => (
                <button key={c.label} className="btn event-choice" onClick={() => { const r = answer(i); if (r) setResult(r) }}>
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
