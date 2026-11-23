import { TEAM_MINUTES } from '../../engine/constants'
import { MAX_PLAN_MIN, SLOTS, comfortMinutes, suggestedMinutes } from '../../engine/sim/rotation'
import type { Player, Position, Rotation } from '../../engine/types'
import { fullName, ovrOf } from '../util'
import { Help } from './Help'

/** The plan as shown: the saved minutes (missing active players at 0), or the coach's suggestions when there is none. */
export function shownMinutes(rot: Rotation, players: Record<string, Player>): Record<string, number> {
  const active = [...rot.starters, ...rot.bench]
  const sug = suggestedMinutes(rot, players)
  return Object.fromEntries(active.map((id) => [id, rot.minutes ? rot.minutes[id] ?? 0 : sug[id] ?? 0]))
}

/** Only active players, whole minutes; drops anyone now inactive. */
export function cleanMinutes(rot: Rotation): Rotation {
  if (!rot.minutes) return rot
  const active = [...rot.starters, ...rot.bench]
  return { ...rot, minutes: Object.fromEntries(active.map((id) => [id, Math.round(rot.minutes![id] ?? 0)])) }
}

/** 2K-style minutes editor: a slider per active player, remaining minutes, minutes by position and fatigue hints. */
export function MinutesPanel({ rot, players, disabled, onChange }: {
  rot: Rotation
  players: Record<string, Player>
  disabled: boolean
  onChange: (minutes: Record<string, number> | undefined) => void
}) {
  const active = [...rot.starters, ...rot.bench].filter((id) => players[id])
  const sug = suggestedMinutes(rot, players)
  const mins = shownMinutes(rot, players)
  const remaining = TEAM_MINUTES - active.reduce((s, id) => s + (mins[id] ?? 0), 0)
  const set = (id: string, v: number) => onChange({ ...mins, [id]: Math.max(0, Math.min(MAX_PLAN_MIN, Math.round(v))) })
  const byPos: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }
  for (const id of active) byPos[players[id].pos] += mins[id] ?? 0

  return (
    <section className="panel stack mins-panel">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h3>Minutes <Help topics={['sta']} /></h3>
        <div className="row">
          <span className={`mins-left${remaining !== 0 ? ' off' : ''}`} role="status">
            Remaining minutes: <b>{remaining}</b>
          </span>
          <button className="btn" disabled={disabled || !rot.minutes} onClick={() => onChange(undefined)}>Use suggested</button>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '70ch' }}>
        {rot.minutes ? 'Your minutes plan.' : 'Showing the coach’s suggested minutes — move a slider to make your own plan.'}{' '}
        Players burn energy on the floor and get it back on the bench; once they’re gassed they shoot, handle and defend worse.
        High-stamina guys (and anyone on a heater 🔥) can carry big minutes — past their 🔋 comfort zone, they’ll fade late.
      </p>

      <div className="mins-pos" aria-label="Minutes by natural position">
        {SLOTS.map((pos) => (
          <div key={pos} className="mins-pos-row">
            <span>{pos}</span>
            <span className="mins-bar" title="The line marks one full game (48 min)">
              <i style={{ width: `${Math.min(100, (byPos[pos] / 96) * 100)}%` }} className={byPos[pos] > 72 ? 'hi' : byPos[pos] < 36 ? 'lo' : undefined} />
            </span>
            <span className="num">{byPos[pos]}</span>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table className="stats mins-table">
          <thead><tr><th>Player</th><th className="mins-wide">Pos</th><th className="mins-wide">OVR</th><th className="mins-wide" title="Stamina rating">STA</th><th>Minutes</th><th title="Coach's suggestion">Sugg.</th></tr></thead>
          <tbody>
            {active.map((id, i) => {
              const p = players[id]
              const m = mins[id] ?? 0
              const comfort = comfortMinutes(p)
              const gassed = m > comfort
              const diff = m - (sug[id] ?? 0)
              return (
                <tr key={id} className={i === rot.starters.length ? 'mins-split' : undefined}>
                  <td className="mins-name">
                    {fullName(p)}{p.injury ? ' 🤕' : ''}
                    <span className="muted mins-role">
                      {i < rot.starters.length ? 'starter' : 'bench'}
                      <span className="mins-narrow"> · {p.pos} · {ovrOf(p)} · STA {p.ratings.stam}</span>
                    </span>
                  </td>
                  <td className="mins-wide">{p.pos}</td>
                  <td className="mins-wide">{ovrOf(p)}</td>
                  <td className="mins-wide" title={`Comfortable up to ~${comfort} min`}>{p.ratings.stam}</td>
                  <td>
                    <span className="mins-edit">
                      <button className="btn mins-step" disabled={disabled || m <= 0} aria-label={`Fewer minutes for ${fullName(p)}`} onClick={() => set(id, m - 1)}>−</button>
                      <input
                        type="range" min={0} max={MAX_PLAN_MIN} step={1} value={m} disabled={disabled}
                        aria-label={`Minutes for ${fullName(p)}`}
                        onChange={(e) => set(id, Number(e.target.value))}
                      />
                      <button className="btn mins-step" disabled={disabled || m >= MAX_PLAN_MIN} aria-label={`More minutes for ${fullName(p)}`} onClick={() => set(id, m + 1)}>+</button>
                      <b className="num mins-val">{m}</b>
                      <span className={`mins-tag${gassed ? ' gassed' : ''}`} title={gassed ? `Past his ~${comfort}-minute comfort zone: he'll tire late` : `Fresh up to ~${comfort} min`}>
                        {gassed ? '🥵' : '🔋'}
                      </span>
                    </span>
                  </td>
                  <td className="num mins-sug">
                    <span className="mins-narrow muted">Sugg. </span>{sug[id] ?? 0}
                    {diff !== 0 && <span className={diff > 0 ? 'mins-up' : 'mins-down'}> {diff > 0 ? '▲' : '▼'}{Math.abs(diff)}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
