import { ACCEPT_FLOOR, ACCEPT_MARGIN, assetLabel, type Asset, type Verdict } from '../engine/gm/trade'
import type { League } from '../engine/types'

/** UI label for a trade asset: players by name, picks as "Season 2 · Round 1 pick (CHA)". */
export function tradeLabel(l: League, a: Asset): string {
  if (a.kind === 'player') return assetLabel(l, a)
  const pk = l.picks.find((p) => p.id === a.id)
  if (!pk) return assetLabel(l, a)
  return `Season ${pk.season} · Round ${pk.round} pick (${l.teams[pk.originalTeamId]?.abbrev ?? '?'})`
}

/** How a rejected offer measures up: the share of the value they need that you're offering (0–1). */
export function offerShare(v: Pick<Verdict, 'got' | 'gave'>): number {
  const need = v.gave * ACCEPT_MARGIN + ACCEPT_FLOOR
  return need <= 0 ? 1 : Math.max(0, Math.min(1, v.got / need))
}

/** The reply to a turned-down trade, saying roughly how far off it is and what might close the gap. */
export function rejectionText(teamName: string, v: Pick<Verdict, 'got' | 'gave'>): string {
  const share = offerShare(v)
  const short = Math.max(1, Math.round((1 - share) * 100))
  if (share >= 0.9) return `❌ ${teamName}: “Close — you’re about ${short}% short.” A second-round pick or a bench piece could get it done.`
  if (share >= 0.65) return `❌ ${teamName}: “Not there yet — about ${short}% short.” Add a rotation player or a first-round pick.`
  return `❌ ${teamName}: “Not even close.” You’re offering about ${Math.round(share * 100)}% of what they’d need back.`
}
