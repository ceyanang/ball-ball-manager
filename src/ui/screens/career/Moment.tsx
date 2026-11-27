import type { Look, MomentAnswer, MomentPrompt } from '../../../engine/sim/moments'
import { useStore } from '../../store'

/** Colour descriptors only — never numbers. */
const LOOK: Record<Look, { text: string; color: string }> = {
  green: { text: 'Wide open', color: 'var(--win)' },
  yellow: { text: 'Decent look', color: '#e6b800' },
  red: { text: 'Contested', color: 'var(--loss)' },
}
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** The paused-game card: the ball is yours, pick what to do. Shown over any page while a moment is waiting. */
export function Moment() {
  const moment = useStore((s) => s.moment)
  const busy = useStore((s) => s.busy)
  const answer = useStore((s) => s.careerAnswer)
  const league = useStore((s) => s.league)
  const watching = useStore((s) => !!s.watch)
  if (!moment || !league?.career || watching) return null
  return <MomentCard moment={moment} busy={busy} onAnswer={(a) => void answer(a)} />
}

/** The "ball finds you" card itself; the live broadcast shows it when the replay reaches his moment. */
export function MomentCard({ moment, busy, onAnswer }: { moment: MomentPrompt; busy: boolean; onAnswer: (a: MomentAnswer, label: string) => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="You're open" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 50, padding: '1rem' }}>
      <div className="panel stack" style={{ maxWidth: '30rem', width: '100%' }}>
        <div className="muted">
          {moment.period > 4 ? `OT${moment.period - 4}` : `Q${moment.period}`} · {clock(moment.clock)} · {moment.score.home}–{moment.score.away}
          {moment.clutch && ' · 🔥 clutch time'}{moment.rival && ' · 😤 rivalry'}
        </div>
        <h2 style={{ margin: 0 }}>The ball finds you.</h2>
        <div className="stack">
          {moment.options.map((o, i) => (
            <button key={i} className="btn" disabled={busy} onClick={() => onAnswer(o.answer, o.label)} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <b>{o.label}</b>
              <span style={{ color: LOOK[o.look].color, fontWeight: 700 }}>● {LOOK[o.look].text}</span>
            </button>
          ))}
        </div>
        {busy && <div className="muted" role="status">…</div>}
      </div>
    </div>
  )
}
