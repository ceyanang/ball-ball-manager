import { useEffect, useState } from 'react'
import { autoRotation, validateRotation } from '../../engine/sim/rotation'
import type { Player, Rotation } from '../../engine/types'
import { PlayerCell } from '../components/PlayerCell'
import { moveInRotation, type Section } from '../rotationEdit'
import { useStore } from '../store'
import { money, one, ovrOf, rosterOf, seasonLine } from '../util'

const LABEL: Record<Section, string> = { starters: 'Starters', bench: 'Bench', inactive: 'Inactive' }

export function MyTeam() {
  const league = useStore((s) => s.league)!
  const busy = useStore((s) => s.busy)
  const setRotation = useStore((s) => s.setRotation)
  const team = league.teams[league.userTeamId]
  const roster = rosterOf(league, team.id)
  const [draft, setDraft] = useState<Rotation>(team.rotation)
  useEffect(() => setDraft(team.rotation), [team.rotation])
  const problems = validateRotation(draft, roster.map((p) => p.id))
  const dirty = JSON.stringify(draft) !== JSON.stringify(team.rotation)

  const move = (id: string, section: Section, index: number) => setDraft((d) => moveInRotation(d, id, { section, index }))
  const moveTo = (id: string, from: Section, to: Section) => {
    if (to === 'starters') return move(id, 'starters', 4)
    if (to === 'bench') return move(id, 'bench', from === 'starters' ? 0 : draft.bench.length)
    return move(id, 'inactive', from === 'starters' ? 0 : draft.inactive.length)
  }

  const row = (p: Player, section: Section, i: number, len: number) => {
    const line = seasonLine(league, p)
    return (
      <tr key={p.id}>
        <td><PlayerCell league={league} p={p} /></td>
        <td>{p.pos}</td><td>{p.age}</td><td><strong>{ovrOf(p)}</strong></td>
        <td>{line ? `${one(line.pg.pts)} / ${one(line.pg.reb)} / ${one(line.pg.ast)}` : '—'}</td>
        <td>{p.contract ? `${money(p.contract.salary)} · ${p.contract.expires - league.season + 1}y` : '—'}</td>
        <td>
          <div className="rot-actions">
            <button className="icon-btn" aria-label={`Move ${p.lastName} up`} disabled={i === 0} onClick={() => move(p.id, section, i - 1)}>↑</button>
            <button className="icon-btn" aria-label={`Move ${p.lastName} down`} disabled={i === len - 1} onClick={() => move(p.id, section, i + 1)}>↓</button>
            <select aria-label={`Move ${p.lastName} to`} value="" onChange={(e) => moveTo(p.id, section, e.target.value as Section)}>
              <option value="" disabled>Move to…</option>
              {(Object.keys(LABEL) as Section[]).filter((s) => s !== section).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
            </select>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h1>{team.name} rotation</h1>
        <div className="row">
          <button className="btn" onClick={() => setDraft(autoRotation(roster))}>Auto</button>
          <button className="btn" disabled={!dirty} onClick={() => setDraft(team.rotation)}>Reset</button>
          <button className="btn btn-primary" disabled={!dirty || problems.length > 0 || busy} onClick={() => setRotation(team.id, draft)}>Save rotation</button>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '70ch' }}>
        Starters play the most minutes, then the bench in order. Inactive players don’t dress. Injured players sit automatically and the next healthy player moves up.
      </p>
      {problems.length > 0 && <div className="notice" role="status">{problems.join(' ')}</div>}
      {(Object.keys(LABEL) as Section[]).map((section) => {
        const ids = draft[section]
        return (
          <section key={section} className="panel rot-section">
            <h3>{LABEL[section]} <span className="muted" style={{ fontFamily: 'var(--body)', fontWeight: 400, fontSize: '0.9rem' }}>{ids.length}</span></h3>
            <div className="table-wrap">
              <table className="stats">
                <thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>PTS / REB / AST</th><th>Contract</th><th></th></tr></thead>
                <tbody>{ids.map((id, i) => row(league.players[id], section, i, ids.length))}</tbody>
              </table>
            </div>
            {!ids.length && <p className="muted">Nobody here.</p>}
          </section>
        )
      })}
    </div>
  )
}
