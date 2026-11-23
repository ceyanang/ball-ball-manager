import type { Position } from '../../engine/types'
import type { NeedLevel } from '../../engine/gm/needs'
import { POSITIONS } from '../../engine/gm/needs'

const LABEL: Record<NeedLevel, string> = {
  red: 'Urgent need',
  yellow: 'Could use help',
  green: 'Solid: strong starter and backup',
}

export const Dot = ({ level }: { level: NeedLevel }) => (
  <span className={`need-dot need-${level}`} role="img" aria-label={LABEL[level]} title={LABEL[level]} />
)

/** Position-need dot; with `after` it shows what the move would change, e.g. red → yellow. */
export function NeedDot({ level, after }: { level: NeedLevel; after?: NeedLevel }) {
  return (
    <span className="need-chip" title={after && after !== level ? `${LABEL[level]} → ${LABEL[after]}` : LABEL[level]}>
      <Dot level={level} />
      {after && after !== level && <><span className="muted">→</span><Dot level={after} /></>}
    </span>
  )
}

/** Five dots, one per position, for the top of decision screens. */
export function NeedsStrip({ needs }: { needs: Record<Position, NeedLevel> }) {
  return (
    <div className="needs-strip" aria-label="Position needs">
      <span className="muted">Needs</span>
      {POSITIONS.map((p) => <span key={p} className="need-pos"><strong>{p}</strong><Dot level={needs[p]} /></span>)}
    </div>
  )
}
