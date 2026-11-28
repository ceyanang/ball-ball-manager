import { Link, Navigate, useNavigate } from 'react-router-dom'
import { answerDraftPrompt, pickPrompts, resolveCareerDraft } from '../../../engine/career/draftNight'
import { ordinal } from '../../util'
import { useStore } from '../../store'

/** MyCareer step two: three ominous questions, then the draft resolves. No odds anywhere. */
export function DraftNight() {
  const league = useStore((s) => s.league)!
  const act = useStore((s) => s.act)
  const busy = useStore((s) => s.busy)
  const navigate = useNavigate()
  const c = league.career
  if (!c) return <Navigate to="/" replace />
  const p = league.players[c.playerId]

  if (c.status !== 'draftNight') {
    const d = p.draft
    const team = d ? league.teams[d.teamId] : null
    return (
      <div className="stack cb-draft" style={{ maxWidth: '40rem' }}>
        <h1>Draft night</h1>
        <div className="panel stack">
          <p style={{ margin: 0, fontSize: '1.3rem' }}>
            {d && team ? <>With the <b>{ordinal(d.pick)}</b> pick in the {d.round === 1 ? 'first' : 'second'} round, the <b>{team.city} {team.name}</b> select <b>{p.firstName} {p.lastName}</b>.</> : 'The draft is over.'}
          </p>
          <div><button className="btn btn-primary" onClick={() => navigate('/')}>Start your career</button></div>
        </div>
      </div>
    )
  }

  const prompts = pickPrompts(league)
  const step = c.draftAnswers.length
  const prompt = prompts[step]
  return (
    <div className="stack cb-draft" style={{ maxWidth: '40rem' }}>
      <h1>Draft night</h1>
      <div className="row" aria-label={`Question ${Math.min(step + 1, 3)} of 3`} style={{ gap: '0.4rem' }}>
        {prompts.map((_, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: i < step ? 'var(--accent, #e8590c)' : 'var(--line)' }} />)}
      </div>
      {prompt ? (
        <div className="panel stack">
          <p className="muted" style={{ margin: 0, fontStyle: 'italic' }}>{prompt.omen}</p>
          <h2 style={{ margin: 0 }}>{prompt.title}</h2>
          <p style={{ margin: 0 }}>{prompt.text}</p>
          <div className="stack cb-choices">
            {prompt.choices.map((ch, i) => (
              <button key={i} className="btn" disabled={busy} onClick={() => act((l) => { answerDraftPrompt(l, prompt.id, i) }, { career: true })}>
                <b>{ch.label}</b> <span className="muted">— {ch.sub}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel stack">
          <p style={{ margin: 0 }}>That’s everything you can do. The war rooms are deciding.</p>
          <div><button className="btn btn-primary" disabled={busy} onClick={() => act((l, rng) => { resolveCareerDraft(l, rng) }, { career: true })}>Watch the draft</button></div>
        </div>
      )}
      <Link to="/saves" className="muted">Saves</Link>
    </div>
  )
}
