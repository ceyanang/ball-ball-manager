import type React from 'react'
import { BOOSTED_KEYS, boostSize, isPlayStyle, STYLE_BOOST, STYLE_EMOJI, STYLE_LABEL, type PlayStyle } from '../../engine/player/playStyle'
import type { Ratings } from '../../engine/types'

/** Tooltip / aria text for a style badge. */
export const badgeLabel = (style: PlayStyle): string => `${STYLE_LABEL[style]} style`

/** Specialty styles mark the stats they lift in games; All-Around lifts everything, so it gets a note instead. */
export const isBoosted = (style: PlayStyle, key: keyof Ratings): boolean => style !== 'allAround' && (BOOSTED_KEYS[style] ?? []).includes(key)

/** One line explaining the style's in-game boost (the stored ratings and OVR never change). */
export function boostNote(style: PlayStyle): string {
  if (style === 'allAround') return `All-Around: +${STYLE_BOOST.allAround} to every stat in games`
  if (style === 'smart') return `Smart boost: plays +${STYLE_BOOST.smartBase} to +${STYLE_BOOST.smartMax} in games (grows with the smartest Smart player in the rotation)`
  return `${STYLE_LABEL[style]} boost: plays +${boostSize(style)} in games`
}

/** The style emoji pinned in a portrait corner (the parent must be `position: relative`). */
export function StyleBadge({ style, corner = 'tr', size }: { style: PlayStyle | undefined; corner?: 'tl' | 'tr' | 'bl' | 'br'; size?: number }) {
  if (!isPlayStyle(style)) return null
  const label = badgeLabel(style)
  return (
    <span className={`style-badge sb-${corner}`} role="img" title={label} aria-label={label} style={size ? { fontSize: `${size}px` } : undefined}>
      {STYLE_EMOJI[style]}
    </span>
  )
}

/** Inline style chip (emoji + name) for headers and lists. */
export function StyleChip({ style }: { style: PlayStyle | undefined }) {
  if (!isPlayStyle(style)) return null
  return (
    <span className="style-chip" title={boostNote(style)}>
      {STYLE_EMOJI[style]} {STYLE_LABEL[style]}
    </span>
  )
}

/** Wraps a portrait so its style badge can sit in a corner (opposite wherever that spot shows the OVR). */
export function WithStyle({ style, corner = 'br', size, children }: { style: PlayStyle | undefined; corner?: 'tl' | 'tr' | 'bl' | 'br'; size?: number; children: React.ReactNode }) {
  return (
    <span className="badged">
      {children}
      <StyleBadge style={style} corner={corner} size={size} />
    </span>
  )
}
