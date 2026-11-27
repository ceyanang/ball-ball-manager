import { storyRng } from '../stories/state'
import type { Game, League, Series } from '../types'
import { STARTING_RIVALS } from './data'

export const RIVAL = {
  heat: { finals: 40, confFinals: 20, series: 6 },
  minHeat: 15, cool: 0.7, coolNoMeet: 0.5,
  /** Fan and morale swing multiplier / flat morale nudge in rival games. */
  fanSwing: 1.5, moraleSwing: 2,
  /** A new player's good rival games needed before the offseason POT roll, and the chance per showing (capped). */
  showingMin: 2, bumpChancePerShowing: 0.08, bumpChanceCap: 0.3,
  maxDynamic: 2,
}

const idOf = (abbrev: string) => 't_' + abbrev.toLowerCase()
const abbrevOf = (teamId: string) => teamId.slice(2).toUpperCase()

export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** The team's two fixed rivals (team ids). */
export function startingRivals(teamId: string): string[] {
  return (STARTING_RIVALS[abbrevOf(teamId)] ?? []).map(idOf)
}

/** Starting plus stored dynamic rivals, unique, only teams that exist. */
export function rivalsOf(l: League, teamId: string): string[] {
  const out = new Set([...startingRivals(teamId), ...(l.rivalry.dynamic[teamId] ?? [])])
  return [...out].filter((id) => id !== teamId && l.teams[id])
}

/** Rivals when either side lists the other. */
export function isRivalGame(l: League, g: Pick<Game, 'homeId' | 'awayId'>): boolean {
  return rivalsOf(l, g.homeId).includes(g.awayId) || rivalsOf(l, g.awayId).includes(g.homeId)
}

/** A decided playoff series heats up the pair; the pair is marked as having met this year. */
export function addSeriesHeat(l: League, s: Series): void {
  if (!s.winnerId) return
  const add = s.round >= 4 ? RIVAL.heat.finals : s.round === 3 ? RIVAL.heat.confFinals : RIVAL.heat.series
  const k = pairKey(s.highSeedId, s.lowSeedId)
  l.rivalry.heat[k] = (l.rivalry.heat[k] ?? 0) + add
  if (!l.rivalry.met.includes(k)) l.rivalry.met.push(k)
}

/** Season rollover: cool every pair, forget the year's meetings, and lock in each team's dynamic rivals. */
export function rolloverRivalry(l: League): void {
  const rv = l.rivalry
  const met = new Set(rv.met)
  for (const k of Object.keys(rv.heat)) {
    const h = rv.heat[k] * (met.has(k) ? RIVAL.cool : RIVAL.coolNoMeet)
    if (h < 1) delete rv.heat[k]; else rv.heat[k] = h
  }
  rv.met = []
  const rng = storyRng(l, 71)
  rv.dynamic = {}
  for (const id of Object.keys(l.teams).sort()) {
    const fixed = new Set(startingRivals(id))
    const cands: { id: string; w: number }[] = []
    for (const [k, h] of Object.entries(rv.heat)) {
      const [a, b] = k.split('|')
      if (a !== id && b !== id) continue
      const other = a === id ? b : a
      if (h < RIVAL.minHeat || !l.teams[other] || fixed.has(other) || startingRivals(other).includes(id)) continue
      cands.push({ id: other, w: h })
    }
    const picked: string[] = []
    while (picked.length < RIVAL.maxDynamic && cands.length) {
      let r = rng.next() * cands.reduce((s, c) => s + c.w, 0)
      let i = 0
      while (i < cands.length - 1 && r >= cands[i].w) r -= cands[i++].w
      picked.push(cands.splice(i, 1)[0].id)
    }
    rv.dynamic[id] = picked
  }
}
