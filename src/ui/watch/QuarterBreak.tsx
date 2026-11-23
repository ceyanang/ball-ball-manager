import { useEffect, useRef, useState } from 'react'
import type { Team } from '../../engine/types'
import type { LiveLine } from './replay'

export interface RecapRow {
  key: string
  name: string
  /** Set for starters: tapping the name opens the player sheet. */
  playerId: string | null
  team: Team
  fav: boolean
  line: LiveLine
  /** A bench row expands (on tap) to one row per non-starter. */
  children?: RecapRow[]
}

/** Recap over the blurred court: after each period, and the final. */
export function QuarterBreak({ title, scoreText, leader, standout, rows, button, onButton, onPick }: {
  title: string
  scoreText: string
  leader: string
  standout: string | null
  rows: RecapRow[]
  button: string
  onButton: () => void
  onPick: (playerId: string) => void
}) {
  const next = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setOpen((o) => { const n = new Set(o); if (!n.delete(key)) n.add(key); return n })
  // Focus the next action when the break opens (not on every re-render, e.g. after a favorite toggle).
  useEffect(() => { next.current?.focus({ preventScroll: true }) }, [button])
  return (
    <div className="w-break" role="dialog" aria-label={title}>
      <h3>{title}</h3>
      <div className="w-break-score">{scoreText}</div>
      <div className="muted">{leader}</div>
      {standout && <div className="w-hl">{standout}</div>}
      <div className="w-lines" role="table" aria-label="Box score so far">
        <div role="row" className="w-lines-head">
          <span role="columnheader" />
          {['PTS', 'REB', 'AST', 'FG', '3P', 'FT'].map((h) => <span key={h} role="columnheader">{h}</span>)}
        </div>
        {rows.flatMap((r) => [{ r, sub: false }, ...(r.children && open.has(r.key) ? r.children.map((c) => ({ r: c, sub: true })) : [])]).map(({ r, sub }, i) => {
          return (
            <div role="row" key={`${r.key}-${i}`} className={sub ? 'w-sub' : undefined}>
              <span role="cell" className="w-lines-name">
                <i className="w-dot" style={{ background: r.team.colors.primary }} aria-hidden="true" />
                {r.children
                  ? <button className="w-pl w-bench-toggle" aria-expanded={open.has(r.key)} onClick={() => toggle(r.key)}>{r.name} {open.has(r.key) ? '▾' : '▸'}</button>
                  : r.playerId
                    ? <button className="w-pl" onClick={() => onPick(r.playerId!)}>{r.name}{r.fav ? ' ⭐' : ''}</button>
                    : <span className="muted">{r.name}</span>}
              </span>
              <span role="cell">{r.line.pts}</span>
              <span role="cell">{r.line.reb}</span>
              <span role="cell">{r.line.ast}</span>
              <span role="cell">{r.line.fgm}/{r.line.fga}</span>
              <span role="cell">{r.line.tpm}/{r.line.tpa}</span>
              <span role="cell">{r.line.ftm}/{r.line.fta}</span>
            </div>
          )
        })}
      </div>
      <div className="w-hint">Tap a name for his full line · tap a bench row for everyone who didn’t start</div>
      <button ref={next} className="btn btn-primary w-next" onClick={onButton}>{button}</button>
    </div>
  )
}
