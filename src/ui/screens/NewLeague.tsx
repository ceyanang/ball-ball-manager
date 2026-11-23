import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createLeague } from '../../engine/league/create'
import { Face } from '../face/Face'
import { TeamBadge } from '../components/TeamBadge'
import { useStore } from '../store'
import { fullName, ovrOf, rosterOf, teamFull, teamOvr } from '../util'

const randomSeed = () => Math.floor(Math.random() * 1_000_000)

export function NewLeague() {
  const [seed, setSeed] = useState(randomSeed)
  const [name, setName] = useState('My League')
  const [pick, setPick] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const newLeague = useStore((s) => s.newLeague)
  const busy = useStore((s) => s.busy)
  const navigate = useNavigate()
  const preview = useMemo(() => createLeague({ seed, userTeamIndex: 0, name: 'preview' }), [seed])
  const teams = Object.values(preview.teams)

  const create = async () => {
    if (pick === null) return
    setCreating(true)
    await newLeague({ seed, userTeamIndex: pick, name: name.trim() || 'My League' })
    navigate('/')
  }

  return (
    <div className="stack">
      <h1>Start a new league</h1>
      <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
        Pick the team you’ll run. Every player, face and coach comes from the league seed, so the same seed always builds the same league.
      </p>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field">League name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <button className="btn" onClick={() => { setSeed(randomSeed()); setPick(null) }}>Shuffle league</button>
      </div>
      <details className="advanced">
        <summary>Advanced</summary>
        <label className="field">Seed<input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} style={{ width: '9rem' }} /></label>
      </details>
      {(['East', 'West'] as const).map((conf) => (
        <section key={conf} className="stack">
          <h2>{conf}</h2>
          <div className="team-pick">
            {teams.map((t, i) => t.conf !== conf ? null : (
              <button key={t.id} className="team-card" aria-pressed={pick === i} onClick={() => setPick(i)}>
                <div className="row">
                  <TeamBadge team={t} />
                  <div style={{ flex: 1 }}><strong>{teamFull(t)}</strong></div>
                  <span className="num" style={{ fontSize: '1.5rem' }} title="Team overall">{teamOvr(preview, t.id)}</span>
                </div>
                <div className="row" style={{ gap: '0.4rem' }}>
                  {rosterOf(preview, t.id).sort((a, b) => ovrOf(b) - ovrOf(a)).slice(0, 3).map((p) => (
                    <div key={p.id} style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                      <Face seed={p.faceSeed} age={p.age} colors={t.colors} size={46} title={fullName(p)} />
                      <div style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.lastName} <strong>{ovrOf(p)}</strong></div>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {/* Always in reach: the start button follows you down the team list. */}
      <div className="start-bar">
        <button className="btn btn-primary" disabled={pick === null || creating || busy} onClick={create}>
          {pick === null ? 'Pick a team to start' : `Start as the ${teams[pick].name}`}
        </button>
      </div>
    </div>
  )
}
