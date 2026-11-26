import { memo, useCallback } from 'react'
import type { Player, Team } from '../../engine/types'
import { Face } from '../face/Face'
import { ovrTier, type OvrTier } from '../ovrTier'
import { fullName, ovrOf } from '../util'

/** A stat that pops when it changes (the key remounts it, replaying the CSS animation). */
const Stat = ({ v, label }: { v: number; label: string }) => (
  <span><b key={v} className={v ? 'w-pop' : undefined}>{v}</b>{label}</span>
)

const STAR4 = (cx: number, cy: number, r: number) => {
  const k = r * 0.3
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`
}

/** Special animated border effects around the portrait for 90+ OVR tiers. */
function PortraitFx({ tier }: { tier: OvrTier }) {
  if (tier === 'red') {
    return (
      <svg className="w-aura aura-red" viewBox="-6 -6 58 62" aria-hidden="true">
        <g className="w-fx-a">
          <path d="M27 1 C26 -4, 30 -5, 31 -1 C33 -4, 36 -2, 34 2 Z" fill="#ff4d2e" />
          <path d="M29 1 C29 -2, 31 -3, 32 0 Z" fill="#ffd166" />
          <path d="M45 20 C50 18, 51 23, 46 25 C50 26, 49 30, 45 29 Z" fill="#ff3b3b" />
          <path d="M1 31 C-4 29, -4 34, 0 35 C-3 37, -1 40, 1 38 Z" fill="#ff5e2b" />
          <circle cx="40" cy="-2" r="1.4" fill="#ff9f1a" />
          <circle cx="-2" cy="22" r="1.2" fill="#ffd166" />
        </g>
        <g className="w-fx-b">
          <path d="M36 1 C37 -4, 41 -4, 40 1 C43 -2, 46 1, 43 4 Z" fill="#ff6a1a" />
          <path d="M38 1 C39 -2, 41 -2, 41 1 Z" fill="#ffe082" />
          <path d="M12 49 C11 53, 15 54, 16 50 C18 53, 21 52, 19 49 Z" fill="#ff3b3b" />
          <path d="M45 36 C49 35, 50 39, 45 41 Z" fill="#ff7a1a" />
          <circle cx="24" cy="-3" r="1.1" fill="#ff5252" />
          <circle cx="48" cy="14" r="1.2" fill="#ffd166" />
        </g>
      </svg>
    )
  }
  if (tier === 'prismatic') {
    return (
      <svg className="w-aura aura-prism" viewBox="-6 -6 58 62" aria-hidden="true">
        <g className="w-fx-a">
          <path d={STAR4(44, 3, 4.2)} fill="#2bb8ff" />
          <path d={STAR4(44, 3, 2)} fill="#fff" />
          <path d={STAR4(1, 38, 3.6)} fill="#e04bff" />
          <path d={STAR4(1, 38, 1.7)} fill="#fff" />
          <circle cx="26" cy="-2" r="1.3" fill="#ffe14d" />
          <circle cx="48" cy="30" r="1.3" fill="#3ddc84" />
        </g>
        <g className="w-fx-b">
          <path d={STAR4(28, 0, 3.6)} fill="#ffe14d" />
          <path d={STAR4(28, 0, 1.6)} fill="#fff" />
          <path d={STAR4(46, 44, 4)} fill="#3ddc84" />
          <path d={STAR4(46, 44, 1.8)} fill="#fff" />
          <path d={STAR4(14, 50, 3.2)} fill="#ff5c8a" />
          <circle cx="-2" cy="22" r="1.3" fill="#2bb8ff" />
        </g>
      </svg>
    )
  }
  if (tier === 'blacksilver') {
    return (
      <svg className="w-aura aura-silver" viewBox="-6 -6 58 62" aria-hidden="true">
        <g className="w-fx-a" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="24,0 29,-4 33,1 39,-3 44,2" stroke="#9cc4ff" strokeWidth="2.4" opacity="0.55" />
          <polyline points="24,0 29,-4 33,1 39,-3 44,2" stroke="#f2f7ff" strokeWidth="1.15" />
          <polyline points="1,24 -4,29 1,34 -3,40 2,46" stroke="#9cc4ff" strokeWidth="2.4" opacity="0.55" />
          <polyline points="1,24 -4,29 1,34 -3,40 2,46" stroke="#ffffff" strokeWidth="1.15" />
          <polyline points="28,50 33,54 37,49 43,53" stroke="#9cc4ff" strokeWidth="2.2" opacity="0.5" />
          <polyline points="28,50 33,54 37,49 43,53" stroke="#e8f1ff" strokeWidth="1.05" />
        </g>
        <g className="w-fx-b" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="46,12 50,17 45,22 50,27 45,33" stroke="#9cc4ff" strokeWidth="2.4" opacity="0.55" />
          <polyline points="46,12 50,17 45,22 50,27 45,33" stroke="#ffffff" strokeWidth="1.15" />
          <polyline points="6,50 11,54 16,49 22,53" stroke="#9cc4ff" strokeWidth="2.2" opacity="0.5" />
          <polyline points="6,50 11,54 16,49 22,53" stroke="#e8f1ff" strokeWidth="1.05" />
          <polyline points="31,-1 36,2 41,-3 46,4" stroke="#ffffff" strokeWidth="1.1" />
        </g>
      </svg>
    )
  }
  if (tier === 'blackgold') {
    return (
      <svg className="w-aura aura-gold" viewBox="-6 -6 58 62" aria-hidden="true">
        <g className="w-fx-a">
          <path d={STAR4(45, 2, 4.8)} fill="#ffc83d" />
          <path d={STAR4(45, 2, 2.2)} fill="#fff8d6" />
          <path d={STAR4(0, 34, 4.2)} fill="#ffd859" />
          <path d={STAR4(0, 34, 1.9)} fill="#fff8d6" />
          <path d={STAR4(24, 50, 3.8)} fill="#ffc83d" />
          <path d={STAR4(24, 50, 1.7)} fill="#fff8d6" />
          <circle cx="31" cy="-2" r="1.3" fill="#ffe88a" />
          <circle cx="48" cy="24" r="1.2" fill="#ffc83d" />
        </g>
        <g className="w-fx-b">
          <path d={STAR4(27, -1, 4.2)} fill="#ffd859" />
          <path d={STAR4(27, -1, 1.8)} fill="#fff8d6" />
          <path d={STAR4(46, 43, 4.5)} fill="#ffc83d" />
          <path d={STAR4(46, 43, 2)} fill="#fff8d6" />
          <path d={STAR4(7, 49, 3.6)} fill="#ffe270" />
          <path d={STAR4(7, 49, 1.6)} fill="#fff8d6" />
          <circle cx="-2" cy="21" r="1.3" fill="#ffe88a" />
          <circle cx="38" cy="52" r="1.1" fill="#ffd859" />
        </g>
      </svg>
    )
  }
  return null
}

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
  const ref = useCallback((el: HTMLDivElement | null) => register(cardId, el), [register, cardId])
  const ovr = player ? ovrOf(player) : 0
  const tier = player ? ovrTier(ovr) : null
  const cls = `w-card${player ? '' : ' bench'}${hot ? ' hot' : ''}${fav ? ' fav' : ''}`
  return (
    <div className={cls} ref={ref} aria-label={player ? `${fullName(player)}: ${pts} points, ${reb} rebounds, ${ast} assists` : `${team.name} bench: ${pts} points`}>
      {fav && <span className="w-mark star" aria-hidden="true">⭐</span>}
      {hot && <span className="w-mark fire" aria-hidden="true">🔥</span>}
      <div className="w-face-box">
        <div className={`w-face${tier ? ` tier-${tier}` : ''}`}>
          {player && <span className={`w-ovr tier-${tier}`} title={`Overall ${ovr}`}>{ovr}</span>}
          {player
            ? <Face seed={player.faceSeed} age={player.age} colors={team.colors} size={42} jersey={player.jersey} title={fullName(player)} />
            : <span className="w-bench-tag">BENCH</span>}
        </div>
        {tier && <PortraitFx tier={tier} />}
      </div>
      <div className="w-nm">{player ? player.lastName : `${benchCount} guys`}</div>
      <div className="w-st" aria-hidden="true"><Stat v={pts} label="PTS" /><Stat v={reb} label="REB" /><Stat v={ast} label="AST" /></div>
    </div>
  )
})
