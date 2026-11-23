import type { Player } from '../types'
import { OFF_POS_PENALTY, SLOT_IDX, SLOTS, slotFit } from './rotation'

export interface SubInput {
  period: number
  minuteInPeriod: number
  periodMinutes: number
  elapsed: number
  gameMinutes: number
  margin: number
  onCourt: string[]
  sitting: string[]
  stint: Record<string, number>
  played: Record<string, number>
  target: Record<string, number>
  starters: string[]
  players: Record<string, Player>
}
export interface Swap { slot: number; out: string; in: string }

/** Tunables (the realism tests calibrate these). */
export const SUB = {
  /** A swap happens when its combined score clears this. */
  threshold: 2,
  /** Minutes of stint a player can take: base + stamina·scale. */
  allowBase: 7,
  allowStam: 6,
  /** Blowout: |margin| to start resting starters in Q3 / Q4+, and the margin under which they return. */
  blowoutQ3: 25,
  blowoutQ4: 20,
  blowoutReturn: 12,
  blowoutShove: 6,
  /** Clutch: last minutes of Q4/OT within this margin → no resting swaps. */
  clutchMinutes: 4,
  clutchMargin: 8,
  /** A swap's score cost is the out-of-position penalty divided by this. */
  posCost: 4,
}

/**
 * The coach's substitutions for the minute about to be played: 0–2 swaps, each replacing one on-court player with
 * a sitter, preferring the same or an adjacent position. Pure and RNG-free; ties go to earlier array order.
 */
export function chooseSubs(i: SubInput): Swap[] {
  if (!i.sitting.length) return []
  const remaining = i.periodMinutes - i.minuteInPeriod
  const lead = Math.abs(i.margin)
  if (i.period >= 4 && remaining <= SUB.clutchMinutes && lead <= SUB.clutchMargin) return []

  const share = i.gameMinutes > 0 ? i.elapsed / i.gameMinutes : 0
  const ahead = (id: string) => (i.played[id] ?? 0) - (i.target[id] ?? 0) * share
  const isStarter = (id: string) => i.starters.includes(id)
  const rest = i.period === 3 ? lead >= SUB.blowoutQ3 : i.period >= 4 && lead >= SUB.blowoutQ4
  const comeback = i.period >= 3 && lead < SUB.blowoutReturn

  const outScore = (id: string) => {
    const stam = i.players[id]?.ratings.stam ?? 50
    const allow = SUB.allowBase + SUB.allowStam * (stam / 99)
    let s = Math.max(0, (i.stint[id] ?? 0) - allow) + ahead(id)
    if (rest && isStarter(id)) s += SUB.blowoutShove
    if (comeback && !isStarter(id)) s += SUB.blowoutShove / 2
    return s
  }
  const inScore = (id: string) => {
    let s = -ahead(id)
    if (rest && !isStarter(id)) s += SUB.blowoutShove / 2
    if (comeback && isStarter(id)) s += SUB.blowoutShove
    return s
  }

  const court = [...i.onCourt]
  const sit = [...i.sitting]
  const swaps: Swap[] = []
  const used = new Set<string>()
  for (let round = 0; round < 2; round++) {
    let best: { slot: number; k: number; v: number } | null = null
    for (let slot = 0; slot < court.length; slot++) {
      const out = court[slot]
      if (used.has(out)) continue
      const o = outScore(out)
      for (let k = 0; k < sit.length; k++) {
        if (used.has(sit[k])) continue
        const p = i.players[sit[k]]
        if (!p) continue
        const pen = OFF_POS_PENALTY[Math.abs(SLOT_IDX[p.pos] - SLOT_IDX[SLOTS[Math.min(slot, 4)]])]
        const v = o + inScore(sit[k]) - pen / SUB.posCost + slotFit(p, SLOTS[Math.min(slot, 4)]) / 100
        if (!best || v > best.v) best = { slot, k, v }
      }
    }
    if (!best || best.v < SUB.threshold) break
    const out = court[best.slot], inn = sit[best.k]
    swaps.push({ slot: best.slot, out, in: inn })
    used.add(out)
    used.add(inn)
    court[best.slot] = inn
    sit.splice(best.k, 1)
  }
  return swaps
}
