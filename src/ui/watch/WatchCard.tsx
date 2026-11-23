import { memo } from 'react'
import type { Player, Team } from '../../engine/types'
import { Face } from '../face/Face'
import { fullName } from '../util'

/** A stat that pops when it changes (the key remounts it, replaying the CSS animation). */
const Stat = ({ v, label }: { v: number; label: string }) => (
  <span><b key={v} className={v ? 'w-pop' : undefined}>{v}</b>{label}</span>
)

/** One of the six cards in a row: a starter (portrait) or the bench (player = null). */
export const WatchCard = memo(function WatchCard({ cardId, player, team, benchCount, pts, reb, ast, hot, fav, register }: {
  cardId: string
  player: Player | null
  team: Team
  benchCount: number
  pts: number; reb: number; ast: number
  hot: boolean; fav: boolean
  register: (cardId: string, el: HTMLElement | null) => void
}) {
  const cls = `w-card${player ? '' : ' bench'}${hot ? ' hot' : ''}${fav ? ' fav' : ''}`
  return (
    <div className={cls} ref={(el) => register(cardId, el)} aria-label={player ? `${fullName(player)}: ${pts} points, ${reb} rebounds, ${ast} assists` : `${team.name} bench: ${pts} points`}>
      {fav && <span className="w-mark star" aria-hidden="true">⭐</span>}
      {hot && <span className="w-mark fire" aria-hidden="true">🔥</span>}
      <div className="w-face">
        {player
          ? <Face seed={player.faceSeed} age={player.age} colors={team.colors} size={42} jersey={player.jersey} title={fullName(player)} />
          : <span className="w-bench-tag">BENCH</span>}
      </div>
      <div className="w-nm">{player ? player.lastName : `${benchCount} guys`}</div>
      <div className="w-st" aria-hidden="true"><Stat v={pts} label="PTS" /><Stat v={reb} label="REB" /><Stat v={ast} label="AST" /></div>
    </div>
  )
})
