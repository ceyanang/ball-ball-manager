import { ratingPillBg, ratingTextColor } from '../ratingColor'

/** OVR number on its rating colour. Pass `pot` to show potential beside it (letter grades live on attributes only). */
export function OvrPill({ value, pot }: { value: number; pot?: number }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }} aria-label={`Overall ${value}${pot === undefined ? '' : `, potential ${pot}`}`}>
      <span className="ovr-pill" style={{ background: ratingPillBg(value), color: ratingTextColor(value) }}>{value}</span>
      {pot !== undefined && <span className={`pot-chip${pot > value + 2 ? ' up' : ''}`} title={`Potential ${pot}`}>POT {pot}</span>}
    </span>
  )
}
