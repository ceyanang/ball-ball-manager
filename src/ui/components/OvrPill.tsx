import { gradeFor } from '../../engine/player/grades'
import { ratingPillBg, ratingTextColor } from '../ratingColor'

/** OVR number on its rating colour, with the letter grade beside it (visible on phones too). Pass `pot` to show potential too. */
export function OvrPill({ value, pot }: { value: number; pot?: number }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }} aria-label={`Overall ${value}, grade ${gradeFor(value)}${pot === undefined ? '' : `, potential ${gradeFor(pot)}`}`}>
      <span className="ovr-pill" style={{ background: ratingPillBg(value), color: ratingTextColor(value) }}>{value}</span>
      <span className="grade">{gradeFor(value)}</span>
      {pot !== undefined && <span className={`pot-chip${pot > value + 2 ? ' up' : ''}`} title={`Potential ${gradeFor(pot)}`}>POT {gradeFor(pot)}</span>}
    </span>
  )
}
