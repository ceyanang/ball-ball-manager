import { ovrOf } from '../career/careerOvr'
import type { Rng } from '../rng'
import type { League, Player } from '../types'
import { GmError, pname } from './cap'

/** How many players the GM can invest in at once. */
export const TRAINING_SLOTS = 3

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const isTraining = (l: League, playerId: string): boolean => l.training.some((t) => t.playerId === playerId)

/** CPU teams quietly focus development on their top young prospects too, keeping league parity. */
export function aiDevIds(l: League): Set<string> {
  const byTeam: Record<string, Player[]> = {}
  for (const p of Object.values(l.players)) {
    if (!p.teamId || p.retired || p.teamId === l.userTeamId || p.age > 24) continue
    ;(byTeam[p.teamId] ??= []).push(p)
  }
  const out = new Set<string>()
  const score = (p: Player) => (p.pot - ovrOf(p)) * 1.5 + p.pot - p.age
  for (const roster of Object.values(byTeam)) {
    roster.sort((a, b) => score(b) - score(a))
    for (const p of roster.slice(0, 2)) out.add(p.id)
  }
  return out
}

/** A better developer on the bench makes every slot count for more: 0.67× at dev 30, 1× at 60, 1.4× at 95. */
export function coachFactor(l: League, teamId: string): number {
  const dev = l.coaches[l.teams[teamId]?.coachId]?.dev ?? 60
  return clamp(1 + (dev - 60) / 90, 0.65, 1.4)
}

/** Late first-rounders, second-rounders and undrafted players are the likeliest to bloom (lottery picks are already near their ceiling). */
export function lateBloomFactor(p: Player): number {
  // Original-roster players (there was no draft yet) are neutral; players who entered later undrafted are long shots who can bloom.
  if (!p.draft) return p.ratingHistory[0]?.season > 1 ? 2 : 1
  if (p.draft.round === 2) return 2
  if (p.draft.pick >= 20) return 1.5
  if (p.draft.pick <= 8) return 0.6
  return 1
}

const youthFactor = (age: number) => (age <= 22 ? 1.3 : age <= 25 ? 1 : age <= 28 ? 0.5 : 0.15)

/** Ceiling jump on a breakout: bigger for raw/mid-tier prospects than guys already near 90+. */
export function breakoutBump(p: Player, rng: Rng): number {
  if (p.pot >= 90) return rng.int(1, 3)
  if (p.pot >= 85) return rng.int(2, 4)
  return rng.int(3, 6)
}

/**
 * Chance that an invested player breaks out (his ceiling jumps and he gains a couple of points) over one development
 * check; `scale` is 1 for each in-season tick and larger for the summer. Roughly a one-in-five season for the
 * ideal late bloomer with a good coach, and rare for everyone else.
 */
export function breakoutChance(p: Player, coachF: number, scale = 1): number {
  return clamp(0.007 * lateBloomFactor(p) * youthFactor(p.age) * coachF * scale, 0, 0.22)
}

/** Drops slots whose player has left the user's team (traded, released, retired). */
export function pruneTraining(l: League): void {
  l.training = l.training.filter((t) => {
    const p = l.players[t.playerId]
    return !!p && !p.retired && p.teamId === l.userTeamId
  })
}

export function startTraining(l: League, playerId: string): string {
  pruneTraining(l)
  const p = l.players[playerId]
  if (!p || p.teamId !== l.userTeamId) throw new GmError('You can only invest in players on your own roster.')
  if (isTraining(l, playerId)) throw new GmError(`${pname(p)} is already in a development slot.`)
  if (l.training.length >= TRAINING_SLOTS)
    throw new GmError(`All ${TRAINING_SLOTS} development slots are full. Free one up first.`)
  l.training.push({ playerId, season: l.season, day: l.day })
  return `🌱 You’re investing in ${pname(p)}.`
}

export function stopTraining(l: League, playerId: string): string {
  const p = l.players[playerId]
  l.training = l.training.filter((t) => t.playerId !== playerId)
  return p ? `${pname(p)} is out of the development program.` : 'Slot cleared.'
}
