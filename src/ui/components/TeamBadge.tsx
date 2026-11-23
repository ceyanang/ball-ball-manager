import type { Team } from '../../engine/types'
import { badgeInk } from '../color'

export function TeamBadge({ team, size = 36 }: { team: Team; size?: number }) {
  return (
    <span
      className="badge"
      aria-hidden="true"
      style={{ width: size, height: size, background: team.colors.primary, color: badgeInk(team.colors), fontSize: size * 0.38 }}
    >
      {team.abbrev}
    </span>
  )
}
