import { gradeFor } from '../../engine/player/grades'
import { ratingColor } from '../ratingColor'

export function OvrPill({ value }: { value: number }) {
  return <span className="ovr-pill" style={{ background: ratingColor(value) }} title={`Overall ${value} (${gradeFor(value)})`}>{value}</span>
}
