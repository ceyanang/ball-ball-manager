import { gradeFor } from '../../engine/player/grades'
import { ratingPillBg, ratingTextColor } from '../ratingColor'

/** OVR number on its rating colour, with the letter grade beside it (visible on phones too). */
export function OvrPill({ value }: { value: number }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }} aria-label={`Overall ${value}, grade ${gradeFor(value)}`}>
      <span className="ovr-pill" style={{ background: ratingPillBg(value), color: ratingTextColor(value) }}>{value}</span>
      <span className="grade">{gradeFor(value)}</span>
    </span>
  )
}
