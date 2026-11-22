import { Link } from 'react-router-dom'
import type { League, Player } from '../../engine/types'
import { Face } from '../face/Face'
import { fullName } from '../util'

export function PlayerCell({ league, p, size = 34 }: { league: League; p: Player; size?: number }) {
  const team = p.teamId ? league.teams[p.teamId] : null
  const colors = team?.colors ?? { primary: '#8a93a8', secondary: '#ffffff' }
  return (
    <div className="pcell">
      <Face seed={p.faceSeed} age={p.age} colors={colors} size={size} title={fullName(p)} />
      <Link className="link pname" to={`/player/${p.id}`}>{fullName(p)}</Link>
      {p.injury && <span className="hurt" title={p.injury.type}>🤕 {p.injury.gamesRemaining >= 999 ? 'out for season' : `${p.injury.gamesRemaining}g`}</span>}
    </div>
  )
}
