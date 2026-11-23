import { Link } from 'react-router-dom'
import type { EventFrequency } from '../../engine/events/state'
import { useStore } from '../store'

const FREQ: { id: EventFrequency; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: 'No pop-ups.' },
  { id: 'some', label: 'Some', hint: 'About one every few weeks.' },
  { id: 'lots', label: 'Lots', hint: 'Around twenty a season.' },
]
const ICON = { good: '🎯', bad: '💥', neutral: '😐' } as const

export function EventLog() {
  const league = useStore((s) => s.league)!
  const setFreq = useStore((s) => s.setEventFrequency)
  const { frequency, history } = league.events
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>🎲 Random events</h1>
        <Link className="link" to="/inbox">Back to inbox</Link>
      </div>
      <section className="panel stack">
        <div className="muted">How often do pop-ups happen?</div>
        <div className="seg" role="group" aria-label="Event frequency">
          {FREQ.map((f) => <button key={f.id} className="btn" aria-pressed={frequency === f.id} onClick={() => setFreq(f.id)}>{f.label}</button>)}
        </div>
        <div className="muted" style={{ fontSize: '0.85rem' }}>{FREQ.find((f) => f.id === frequency)?.hint} Team chemistry: {league.chemistry[league.userTeamId] ?? 50}/100.</div>
      </section>
      {history.length === 0 && <section className="panel"><p className="muted" style={{ margin: 0 }}>Nothing has happened yet. Keep simming and something will.</p></section>}
      {[...history].reverse().map((h, i) => (
        <article key={`${h.season}-${h.day}-${h.eventId}-${i}`} className="inbox-item">
          <div className="inbox-title">{ICON[h.tone]} {h.title}</div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Season {h.season} · Day {h.day} · you chose “{h.choice}”</div>
          <p style={{ margin: '0.4rem 0' }}>{h.outcomeText}</p>
          {h.changes.length > 0 && <ul className="event-changes">{h.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
        </article>
      ))}
    </div>
  )
}
