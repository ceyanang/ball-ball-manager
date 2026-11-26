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
  const k = r * 0.24
  return `M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`
}

const is90Plus = (t: OvrTier | null): t is 'red' | 'prismatic' | 'blacksilver' | 'blackrainbow' =>
  t === 'red' || t === 'prismatic' || t === 'blacksilver' || t === 'blackrainbow'

/** Special animated border effects around the portrait for 90+ OVR tiers. */
function PortraitFx({ tier }: { tier: OvrTier }) {
  if (tier === 'red') {
    return (
      <svg className="w-aura aura-red" viewBox="-8 -10 62 66" aria-hidden="true">
        {/* Flickering flame tongues hugging top & sides */}
        <g className="w-flame-1">
          <path d="M22 1 C20 -6, 25 -9, 27 -2 C29 -8, 33 -6, 32 1 Z" fill="#ff3b1f" />
          <path d="M24 1 C24 -4, 27 -5, 28 0 Z" fill="#ffd166" />
          <path d="M45 16 C51 13, 53 19, 47 22 C52 23, 51 28, 45 27 Z" fill="#ff4d24" />
          <path d="M45 19 C48 18, 49 21, 46 23 Z" fill="#ffb703" />
          <path d="M1 26 C-5 24, -5 30, 0 32 C-4 34, -2 39, 1 36 Z" fill="#ff3b1f" />
        </g>
        <g className="w-flame-2">
          <path d="M33 1 C34 -7, 39 -8, 38 -1 C42 -5, 46 -1, 43 4 Z" fill="#ff6a1a" />
          <path d="M36 1 C37 -4, 40 -4, 40 1 Z" fill="#ffe082" />
          <path d="M1 38 C-4 37, -4 43, 1 44 Z" fill="#ff6a1a" />
          <path d="M45 33 C50 32, 51 38, 45 39 Z" fill="#ff4526" />
        </g>
        {/* Rising glowing embers */}
        <circle className="w-ember e1" cx="29" cy="0" r="1.4" fill="#ffd166" />
        <circle className="w-ember e2" cx="42" cy="4" r="1.2" fill="#ff9f1a" />
        <circle className="w-ember e3" cx="-1" cy="24" r="1.3" fill="#ff6a1a" />
        <circle className="w-ember e4" cx="47" cy="29" r="1.2" fill="#ffd166" />
        <circle className="w-ember e5" cx="19" cy="-1" r="1.0" fill="#ff5252" />
      </svg>
    )
  }
  if (tier === 'prismatic') {
    return (
      <svg className="w-aura aura-prism" viewBox="-8 -10 62 66" aria-hidden="true">
        <g className="w-prism-spark s1" style={{ transformOrigin: '45px 2px' }}>
          <path d={STAR4(45, 2, 5.4)} fill="#2bb8ff" />
          <path d={STAR4(45, 2, 2.4)} fill="#ffffff" />
        </g>
        <g className="w-prism-spark s2" style={{ transformOrigin: '0px 36px' }}>
          <path d={STAR4(0, 36, 4.6)} fill="#e04bff" />
          <path d={STAR4(0, 36, 2.0)} fill="#ffffff" />
        </g>
        <g className="w-prism-spark s3" style={{ transformOrigin: '27px -1px' }}>
          <path d={STAR4(27, -1, 4.4)} fill="#ffe14d" />
          <path d={STAR4(27, -1, 1.9)} fill="#ffffff" />
        </g>
        <g className="w-prism-spark s4" style={{ transformOrigin: '46px 44px' }}>
          <path d={STAR4(46, 44, 4.8)} fill="#3ddc84" />
          <path d={STAR4(46, 44, 2.1)} fill="#ffffff" />
        </g>
        <circle className="w-ember e1" cx="15" cy="51" r="1.4" fill="#ff5c8a" />
        <circle className="w-ember e2" cx="48" cy="22" r="1.3" fill="#2bb8ff" />
        <circle className="w-ember e3" cx="-2" cy="18" r="1.2" fill="#ffe14d" />
      </svg>
    )
  }
  if (tier === 'blacksilver') {
    return (
      <svg className="w-aura aura-silver" viewBox="-8 -10 62 66" aria-hidden="true">
        {/* Arc 1: top-right corner snap + fork */}
        <g className="w-bolt b1" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 0 L28 -3 L31 1 L39 -4 L43 1 L47 0 L46 9 L49 14" stroke="#66b3ff" strokeWidth="3.2" opacity="0.55" />
          <path d="M21 0 L28 -3 L31 1 L39 -4 L43 1 L47 0 L46 9 L49 14" stroke="#ffffff" strokeWidth="1.25" />
          <path d="M39 -4 L42 -8" stroke="#cfe6ff" strokeWidth="1.0" />
          <circle cx="49" cy="14" r="1.4" fill="#ffffff" stroke="none" />
        </g>
        {/* Arc 2: left edge discharge + lower corner */}
        <g className="w-bolt b2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 19 L-4 24 L1 29 L-3 36 L1 42 L0 48 L8 50" stroke="#66b3ff" strokeWidth="3.2" opacity="0.55" />
          <path d="M1 19 L-4 24 L1 29 L-3 36 L1 42 L0 48 L8 50" stroke="#ffffff" strokeWidth="1.25" />
          <path d="M-3 36 L-7 39" stroke="#cfe6ff" strokeWidth="1.0" />
          <circle cx="0" cy="48" r="1.3" fill="#e8f4ff" stroke="none" />
        </g>
        {/* Arc 3: right-bottom surge */}
        <g className="w-bolt b3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M46 25 L50 31 L45 36 L49 44 L44 50 L33 51 L27 54" stroke="#7cc2ff" strokeWidth="3.0" opacity="0.5" />
          <path d="M46 25 L50 31 L45 36 L49 44 L44 50 L33 51 L27 54" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M49 44 L52 47" stroke="#cfe6ff" strokeWidth="0.95" />
          <circle cx="27" cy="54" r="1.2" fill="#ffffff" stroke="none" />
        </g>
      </svg>
    )
  }
  if (tier === 'blackrainbow') {
    return (
      <svg className="w-aura aura-blackrainbow" viewBox="-8 -10 62 66" aria-hidden="true">
        {/* Forked chromatic lightning arcs snapping around the void-black frame */}
        <g className="w-bolt b1" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 0 L26 -4 L30 1 L38 -5 L43 1 L47 0 L46 9 L50 15" stroke="#2bb8ff" strokeWidth="3.4" opacity="0.7" />
          <path d="M19 0 L26 -4 L30 1 L38 -5 L43 1 L47 0 L46 9 L50 15" stroke="#ffffff" strokeWidth="1.3" />
          <path d="M38 -5 L42 -9" stroke="#7fe7ff" strokeWidth="1.05" />
          <circle cx="50" cy="15" r="1.4" fill="#ffffff" stroke="none" />
        </g>
        <g className="w-bolt b2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 18 L-5 24 L1 29 L-4 36 L1 42 L0 49 L9 51" stroke="#e04bff" strokeWidth="3.4" opacity="0.7" />
          <path d="M1 18 L-5 24 L1 29 L-4 36 L1 42 L0 49 L9 51" stroke="#ffffff" strokeWidth="1.3" />
          <path d="M-4 36 L-8 39" stroke="#ff9cf5" strokeWidth="1.05" />
          <circle cx="0" cy="49" r="1.3" fill="#ffffff" stroke="none" />
        </g>
        <g className="w-bolt b3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M46 25 L51 31 L45 36 L50 44 L44 50 L33 51 L26 55" stroke="#3ddc84" strokeWidth="3.2" opacity="0.65" />
          <path d="M46 25 L51 31 L45 36 L50 44 L44 50 L33 51 L26 55" stroke="#ffffff" strokeWidth="1.25" />
          <path d="M50 44 L53 47" stroke="#ffe14d" strokeWidth="1.0" />
          <circle cx="26" cy="55" r="1.3" fill="#ffe14d" stroke="none" />
        </g>
        {/* Prismatic 4-point stars & rising stardust */}
        <g className="w-gold-star gs1" style={{ transformOrigin: '45px 2px' }}>
          <path d={STAR4(45, 2, 6.2)} fill="#ffe14d" />
          <path d={STAR4(45, 2, 2.7)} fill="#ffffff" />
        </g>
        <g className="w-gold-star gs2" style={{ transformOrigin: '0px 33px' }}>
          <path d={STAR4(0, 33, 5.2)} fill="#2bb8ff" />
          <path d={STAR4(0, 33, 2.3)} fill="#ffffff" />
        </g>
        <g className="w-gold-star gs3" style={{ transformOrigin: '27px -2px' }}>
          <path d={STAR4(27, -2, 5.0)} fill="#ff4d6d" />
          <path d={STAR4(27, -2, 2.2)} fill="#ffffff" />
        </g>
        <g className="w-gold-star gs4" style={{ transformOrigin: '45px 45px' }}>
          <path d={STAR4(45, 45, 5.6)} fill="#e04bff" />
          <path d={STAR4(45, 45, 2.5)} fill="#ffffff" />
        </g>
        <g className="w-gold-star gs5" style={{ transformOrigin: '16px 50px' }}>
          <path d={STAR4(16, 50, 4.4)} fill="#3ddc84" />
          <path d={STAR4(16, 50, 1.9)} fill="#ffffff" />
        </g>
        <circle className="w-ember e1" cx="34" cy="-1" r="1.4" fill="#ffe14d" />
        <circle className="w-ember e2" cx="48" cy="21" r="1.3" fill="#e04bff" />
        <circle className="w-ember e3" cx="-2" cy="17" r="1.3" fill="#2bb8ff" />
        <circle className="w-ember e4" cx="36" cy="52" r="1.2" fill="#3ddc84" />
      </svg>
    )
  }
  return null
}

/** One of the six cards in a row: a starter (portrait) or the bench (player = null). */
export const WatchCard = memo(function WatchCard({ cardId, player, team, benchCount, pts, reb, ast, hot, fav, register, onSelect }: {
  cardId: string
  player: Player | null
  team: Team
  benchCount: number
  pts: number; reb: number; ast: number
  hot: boolean; fav: boolean
  register: (cardId: string, el: HTMLElement | null) => void
  onSelect?: () => void
}) {
  const ref = useCallback((el: HTMLDivElement | null) => register(cardId, el), [register, cardId])
  const ovr = player ? ovrOf(player) : 0
  const tier = player ? ovrTier(ovr) : null
  const cls = `w-card${player ? '' : ' bench'}${hot ? ' hot' : ''}${fav ? ' fav' : ''}`
  const interactive = !!player && !!onSelect
  return (
    <div
      className={cls}
      ref={ref}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onSelect : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } } : undefined}
      aria-label={player ? `${fullName(player)}: ${pts} points, ${reb} rebounds, ${ast} assists` : `${team.name} bench: ${pts} points`}
    >
      {fav && <span className="w-mark star" aria-hidden="true">⭐</span>}
      {hot && <span className="w-mark fire" aria-hidden="true">🔥</span>}
      <div className="w-face-box">
        {is90Plus(tier) && <div className={`w-ring tier-${tier}`} aria-hidden="true" />}
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
