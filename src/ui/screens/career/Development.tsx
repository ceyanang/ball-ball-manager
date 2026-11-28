import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ovrOf } from '../../../engine/career/careerOvr'
import {
  MOMENTS_PER_SP, PERF_STEP, TRAINING_GROUPS, TRAINING_TIERS, buyTraining, canTrain, describeGrowth, groupRoom, spOf,
  type TrainingGroup, type TrainingTier,
} from '../../../engine/career/training'
import { RATING_LABELS } from '../../../engine/player/ratings'
import type { GrowthEntry } from '../../../engine/career/types'
import { useStore } from '../../store'
import { ratingColor } from '../../ratingColor'

/** MyCareer: spend skill points on trainings. Each training adds random points to skills in its group that still have room. */
export function Development() {
  const league = useStore((s) => s.league)!
  const busy = useStore((s) => s.busy)
  const act = useStore((s) => s.act)
  const [last, setLast] = useState<{ group: string; out: GrowthEntry[]; ovr: [number, number] } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const c = league.career
  if (!c) return <Navigate to="/" replace />
  const p = league.players[c.playerId]
  const sp = spOf(c)
  const recent = [...(c.spLog ?? [])].reverse().slice(0, 8)

  const buy = (g: TrainingGroup, tier: TrainingTier) => {
    let out: GrowthEntry[] = []
    const before = ovrOf(p)
    let after = before
    const ok = act((l) => {
      out = buyTraining(l, g.id, tier)
      after = ovrOf(l.players[l.career!.playerId])
    }, { career: true })
    if (ok) setLast({ group: g.label, out, ovr: [before, after] })
  }

  return (
    <div className="stack dev">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0 }}>Player Development</h1>
          <div className="muted">{p.firstName} {p.lastName} · Career OVR <b className="num">{ovrOf(p)}</b></div>
        </div>
        <div className="dev-bank" aria-label={`${sp} skill points`}>
          <span className="dev-bank-num num">{sp}</span>
          <span className="dev-bank-label">SP</span>
        </div>
      </div>

      {last && (
        <div className="panel dev-result" role="status">
          <b>{last.group} training</b>
          <span>{describeGrowth(last.out)}</span>
          {last.ovr[1] !== last.ovr[0] && <span className="dev-ovr-up">OVR {last.ovr[0]} → {last.ovr[1]}</span>}
        </div>
      )}

      <div className="dev-groups">
        {TRAINING_GROUPS.map((g) => {
          const room = groupRoom(p, g)
          const max = p.careerBuild?.max
          const expanded = open === g.id
          return (
            <div key={g.id} className={`panel dev-group${room === 0 ? ' dev-maxed' : ''}`}>
              <div className="row" style={{ justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <div className="dev-title"><span aria-hidden>{g.emoji}</span> {g.label}</div>
                  <div className="muted dev-blurb">{g.blurb}</div>
                </div>
                <button className="link dev-room" onClick={() => setOpen(expanded ? null : g.id)} aria-expanded={expanded}>
                  {room === 0 ? 'Maxed' : `${room} pts left`} {expanded ? '▴' : '▾'}
                </button>
              </div>
              {expanded && max && (
                <ul className="dev-skills">
                  {g.keys.map((k) => (
                    <li key={k}>
                      <span>{RATING_LABELS[k]}</span>
                      <span className="dev-bar" aria-hidden>
                        <span style={{ width: `${(max[k] ? p.ratings[k] / max[k] : 1) * 100}%`, background: ratingColor(p.ratings[k]) }} />
                      </span>
                      <span className="num">{p.ratings[k]}<span className="muted">/{max[k]}</span></span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="dev-tiers">
                {TRAINING_TIERS.map((tier) => {
                  const check = canTrain(league, g.id, tier)
                  return (
                    <button key={tier.cost} className={`btn dev-tier${tier.cost === 12 ? ' btn-primary' : ''}`} disabled={busy || !check.ok}
                      title={check.ok ? `${tier.points} random point${tier.points === 1 ? '' : 's'} in ${g.label.toLowerCase()}` : check.reason}
                      onClick={() => buy(g, tier)}>
                      <b>+{tier.points}</b> <span className="dev-cost">{tier.cost} SP</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="panel stack" style={{ gap: '0.4rem' }}>
        <b>How you earn SP</b>
        <ul className="muted dev-how">
          <li>Every game you play: <b>1 SP</b>, guaranteed.</li>
          <li>Beat your own average game score: <b>+1 SP</b> for every {PERF_STEP} points above it (up to +4).</li>
          <li>Play by hand: <b>+1 SP</b> for every {MOMENTS_PER_SP} moments that go your way.</li>
          <li>Event cards that go your way pay SP.</li>
        </ul>
        <div className="muted">Trainings: 3 SP = 1 random point · 7 SP = 3 points · 12 SP = 6 points — only into skills you still have room for.</div>
        {recent.length > 0 && (
          <>
            <b style={{ marginTop: '0.4rem' }}>Recent</b>
            <ul className="dev-log">
              {recent.map((e, i) => (
                <li key={i}><span className="num dev-plus">+{e.amount}</span> <span>{e.source}</span> <span className="muted">· day {e.day}</span></li>
              ))}
            </ul>
          </>
        )}
        <div className="muted">Lifetime: {c.spEarned ?? 0} SP earned · {c.trainings ?? 0} training{c.trainings === 1 ? '' : 's'}</div>
      </div>
    </div>
  )
}
