import { Link } from 'react-router-dom'
import type { League } from '../../engine/types'
import { Face } from '../face/Face'
import { fullName, teamFull } from '../util'

/** One team's retired numbers as banners, newest honor first. */
export function JerseyRafters({ league, teamId }: { league: League; teamId: string }) {
  const team = league.teams[teamId]
  const honors = league.retiredJerseys.filter((j) => j.teamId === teamId && league.players[j.playerId])
    .sort((a, b) => b.season - a.season || b.score - a.score)
  if (!honors.length)
    return <section className="panel"><p className="muted" style={{ margin: 0 }}>The {team.name} haven't retired a number yet. It takes a franchise star, or a long stay and a title.</p></section>
  return (
    <div className="jersey-grid">
      {honors.map((j) => {
        const p = league.players[j.playerId]
        return (
          <Link key={j.playerId} to={`/player/${p.id}`} className="jersey-card" style={{ background: `linear-gradient(180deg, ${team.colors.primary}, color-mix(in srgb, ${team.colors.primary} 70%, #000))`, color: team.colors.secondary }}>
            <div className="jersey-num">{j.number}</div>
            <Face seed={p.faceSeed} age={p.age} colors={team.colors} size={64} title={fullName(p)} />
            <div className="jersey-name">{fullName(p)}</div>
            <div className="jersey-sub">{j.seasons} season{j.seasons === 1 ? '' : 's'}{j.titles ? ` · ${j.titles} title${j.titles > 1 ? 's' : ''}` : ''}</div>
            <div className="jersey-sub">{j.door === 'star' ? '⭐ Franchise star' : '🤝 Loyal servant'} · retired S{j.season}</div>
          </Link>
        )
      })}
    </div>
  )
}

/** "#23 retired by the Wolves" lines for a player's page. */
export function retiredByLines(league: League, playerId: string): string[] {
  return league.retiredJerseys.filter((j) => j.playerId === playerId).map((j) => `#${j.number} retired by ${teamFull(league.teams[j.teamId])}`)
}
