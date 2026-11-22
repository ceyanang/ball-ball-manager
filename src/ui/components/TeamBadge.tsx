import type { Team } from '../../engine/types'

export function TeamBadge({ team, size = 36 }: { team: Team; size?: number }) {
  return (
    <span
      className="badge"
      aria-hidden="true"
      style={{ width: size, height: size, background: team.colors.primary, color: team.colors.secondary, fontSize: size * 0.38 }}
    >
      {team.abbrev}
    </span>
  )
}
