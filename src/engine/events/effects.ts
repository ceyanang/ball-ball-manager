import { awardSp, grantSp } from '../career/training'
import { ovr, pname } from '../gm/cap'
import { RATING_KEYS, RATING_LABELS, RATING_MAX, RATING_MIN } from '../player/ratings'
import { ping } from '../stories/inbox'
import { clamp, nextId } from '../stories/state'
import type { League, Player, Ratings } from '../types'

export type Target = { player: string } | 'team'

export type Effect =
  | { kind: 'morale'; target: Target | 'roster'; delta: number }
  | { kind: 'fans'; target: Target; delta: number }
  | { kind: 'chemistry'; delta: number }
  | { kind: 'buff'; target: Target; stat: 'shooting' | 'defense' | 'energy' | 'all'; amount: number; games: number }
  | { kind: 'rest'; player: string }
  | { kind: 'train'; player: string; skill: keyof Ratings; delta: number }
  | { kind: 'ovrNudge'; player: string; delta: number }
  | { kind: 'inbox'; title: string; body: string }
  /** MyCareer: permanent, logged growth for the followed player (scaled by age, played-vs-simmed and health; capped by his max). */
  | { kind: 'grow'; player: string; grants: { key: keyof Ratings; amount: number }[]; source: string }

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const STAT_LABEL = { shooting: 'shooting', defense: 'defense', energy: 'energy', all: 'everything' } as const
const SKILL_LABEL: Record<keyof Ratings, string> = Object.fromEntries(
  Object.entries(RATING_LABELS).map(([k, v]) => [k, v.toLowerCase()]),
) as Record<keyof Ratings, string>

/** Applies effects to the league (mutating it). Returns one readable line per change for the result card. */
export function applyEffects(l: League, effects: Effect[]): string[] {
  const lines: string[] = []
  const userRoster = () => Object.values(l.players).filter((p) => p.teamId === l.userTeamId && !p.retired)
  const player = (id: string): Player | undefined => l.players[id]
  for (const e of effects) {
    switch (e.kind) {
      case 'morale': {
        const ps = e.target === 'roster' || e.target === 'team' ? userRoster() : [player(e.target.player)].filter((p): p is Player => !!p)
        for (const p of ps) p.morale = Math.round(clamp(p.morale + e.delta, 0, 100))
        if (ps.length === 1) lines.push(`${pname(ps[0])} morale ${sign(e.delta)}`)
        else if (ps.length > 1) lines.push(`Whole roster morale ${sign(e.delta)}`)
        break
      }
      case 'fans': {
        if (e.target === 'team') {
          l.fans.teams[l.userTeamId] = Math.round(clamp((l.fans.teams[l.userTeamId] ?? 0) + e.delta, -100, 100))
          lines.push(`Team fans ${sign(e.delta)}`)
        } else {
          const p = player(e.target.player)
          if (!p) break
          l.fans.players[p.id] = Math.round(clamp((l.fans.players[p.id] ?? 0) + e.delta, -100, 100))
          lines.push(`${pname(p)} fans ${sign(e.delta)}`)
        }
        break
      }
      case 'chemistry':
        l.chemistry[l.userTeamId] = Math.round(clamp((l.chemistry[l.userTeamId] ?? 50) + e.delta, 0, 100))
        lines.push(`Team chemistry ${sign(e.delta)}`)
        break
      case 'buff': {
        const p = e.target === 'team' ? null : player(e.target.player)
        if (e.target !== 'team' && !p) break
        l.events.active.push({ id: nextId(l, 'fx'), kind: e.stat, playerId: p?.id ?? null, amount: e.amount, gamesLeft: e.games })
        lines.push(`${p ? pname(p) : 'Team'} ${STAT_LABEL[e.stat]} ${sign(e.amount)} for ${e.games} game${e.games === 1 ? '' : 's'}`)
        break
      }
      case 'rest': {
        const p = player(e.player)
        if (!p) break
        l.events.active.push({ id: nextId(l, 'fx'), kind: 'all', playerId: p.id, amount: 0, gamesLeft: 1, rest: true })
        lines.push(`${pname(p)} sits out the next game`)
        break
      }
      case 'train': {
        const p = player(e.player)
        if (!p) break
        const before = p.ratings[e.skill]
        p.ratings[e.skill] = clamp(before + e.delta, RATING_MIN, RATING_MAX)
        if (p.ratings[e.skill] !== before) lines.push(`${pname(p)} ${SKILL_LABEL[e.skill]} ${sign(p.ratings[e.skill] - before)}`)
        break
      }
      case 'ovrNudge': {
        const p = player(e.player)
        if (!p) break
        const before = ovr(p)
        const dir = e.delta >= 0 ? 1 : -1
        // The five strongest ratings that still have room to move (a star's 99s can't go up).
        const top = RATING_KEYS.filter((k) => (dir > 0 ? p.ratings[k] < RATING_MAX : p.ratings[k] > RATING_MIN)).sort((a, b) => p.ratings[b] - p.ratings[a]).slice(0, 5)
        for (let i = 0; i < 6 && (ovr(p) - before) * dir < Math.abs(e.delta); i++)
          for (const k of top) p.ratings[k] = clamp(p.ratings[k] + dir, RATING_MIN, RATING_MAX)
        if (ovr(p) !== before) lines.push(`${pname(p)} OVR ${sign(ovr(p) - before)}`)
        break
      }
      case 'grow': {
        const p = player(e.player)
        if (!p) break
        // MyCareer: a card that goes his way pays out skill points to spend in Development.
        if (!l.career || l.career.playerId !== p.id) break
        const n = awardSp(l, grantSp(e.grants), e.source)
        if (n) lines.push(`${pname(p)} +${n} SP (${e.source})`)
        break
      }
      case 'inbox':
        ping(l, 'morale', `evt:${nextId(l, 'ev')}`, e.title, e.body)
        break
    }
  }
  return lines
}
