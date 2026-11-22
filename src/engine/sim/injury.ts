import { INJURY_TYPES } from '../data/names'
import type { Rng } from '../rng'
import type { GameResult, Injury, Player } from '../types'

/** Per-player-game base chance at 36 minutes; tuned so a season sees ~80–200 injuries league-wide. */
const BASE_RATE = 0.016
const SEVERITY: { sev: Injury['severity']; w: number; games: [number, number] }[] = [
  { sev: 'dtd', w: 70, games: [1, 3] },
  { sev: 'short', w: 22, games: [4, 10] },
  { sev: 'long', w: 7, games: [11, 25] },
  { sev: 'season', w: 1, games: [999, 999] },
]

export function rollInjuries(
  result: GameResult,
  players: Record<string, Player>,
  rng: Rng,
): { playerId: string; injury: Injury }[] {
  const out: { playerId: string; injury: Injury }[] = []
  for (const b of result.box) {
    if (b.min <= 0) continue
    const p = players[b.playerId]
    if (!p || p.injury) continue
    const chance = BASE_RATE * (b.min / 36) * (1 + 0.03 * Math.max(0, p.age - 30)) * (1 + (60 - p.ratings.ath) / 100)
    if (!rng.chance(chance)) continue
    const s = rng.weighted(SEVERITY, (x) => x.w)
    const type = rng.pick(INJURY_TYPES.filter((t) => t.severity === s.sev)).type
    out.push({ playerId: p.id, injury: { type, severity: s.sev, gamesRemaining: rng.int(s.games[0], s.games[1]) } })
  }
  return out
}

/** Call once per game a team plays: each injured player on those teams has served one game. */
export function tickInjuries(teamIds: string[], players: Record<string, Player>): void {
  const teams = new Set(teamIds)
  for (const p of Object.values(players)) {
    if (!p.injury || !p.teamId || !teams.has(p.teamId)) continue
    p.injury.gamesRemaining--
    if (p.injury.gamesRemaining <= 0) p.injury = null
  }
}
