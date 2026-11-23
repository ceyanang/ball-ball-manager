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
  return (
    <div className="w-break" role="dialog" aria-label={title}>
      <h3>{title}</h3>
      <div className="w-break-score">{scoreText}</div>
      <div className="muted">{leader}</div>
      {standout && <div className="w-hl">{standout}</div>}
      <div className="w-lines" role="table" aria-label="Box score so far">
        <div role="row" className="w-lines-head">
          <span role="columnheader" />
          {['PTS', 'REB', 'AST', 'FG', '3P'].map((h) => <span key={h} role="columnheader">{h}</span>)}
        </div>
        {rows.map((r) => (
          <div role="row" key={r.key}>
            <span role="cell" className="w-lines-name">
              <i className="w-dot" style={{ background: r.team.colors.primary }} aria-hidden="true" />
              {r.playerId
                ? <button className="w-pl" onClick={() => onPick(r.playerId!)}>{r.name}{r.fav ? ' ⭐' : ''}</button>
                : <span className="muted">{r.name}</span>}
            </span>
            <span role="cell">{r.line.pts}</span>
            <span role="cell">{r.line.reb}</span>
            <span role="cell">{r.line.ast}</span>
            <span role="cell">{r.line.fgm}/{r.line.fga}</span>
            <span role="cell">{r.line.tpm}/{r.line.tpa}</span>
          </div>
        ))}
      </div>
      <div className="w-hint">Tap a name for his full line</div>
      <button className="btn btn-primary w-next" onClick={onButton}>{button}</button>
    </div>
  )
}
