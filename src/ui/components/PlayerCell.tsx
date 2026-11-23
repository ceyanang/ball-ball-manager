import { Link } from 'react-router-dom'
import type { League, Player } from '../../engine/types'
import { Face } from '../face/Face'
import { fullName } from '../util'

export function PlayerCell({ league, p, size = 34, showInjury = true, subtitle, plain }: { league: League; p: Player; size?: number; showInjury?: boolean; subtitle?: string; plain?: boolean }) {
  const team = p.teamId ? league.teams[p.teamId] : null
  const colors = team?.colors ?? { primary: '#8a93a8', secondary: '#ffffff' }
  return (
    <div className="pcell">
      <Face seed={p.faceSeed} age={p.age} colors={colors} size={size} title={fullName(p)} />
      <span>
        {plain ? <span className="pname">{fullName(p)}</span> : <Link className="link pname" to={`/player/${p.id}`}>{fullName(p)}</Link>}
        {league.favoritePlayerIds.includes(p.id) && <span title="Your guy" aria-label="Your guy"> ⭐</span>}
        {subtitle && <span className="sub">{subtitle}</span>}
      </span>
      {showInjury && p.injury && <span className="hurt" title={p.injury.type}>🤕 {p.injury.gamesRemaining >= 999 ? 'out for season' : `${p.injury.gamesRemaining}g`}</span>}
    </div>
  )
}
