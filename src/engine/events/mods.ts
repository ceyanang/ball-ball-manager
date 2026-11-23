import { STARTERS } from '../constants'
import { clamp } from '../stories/state'
import type { Game, League } from '../types'

/** Temporary modifiers handed to `simGame` for one game. Never edits ratings. */
export interface GameMods {
  /** Percentage points added to a player's make-probability (e.g. 3 = +3%). */
  shooting: Record<string, number>
  /** Rating points added to a defender's perimeter/interior D. */
  defense: Record<string, number>
  /** Positive: slower energy drain (percent). Negative: starts the game tired (energy points). */
  energy: Record<string, number>
  /** Players who sit this game. */
  sit: string[]
  /** teamId → chemistry 0–100 (50 = neutral). */
  chemistry: Record<string, number>
}

const CAP = { shooting: 6, defense: 10, energy: 50 }
const isUserGame = (l: League, g: Game) => g.homeId === l.userTeamId || g.awayId === l.userTeamId

/** The user's active event effects (and chemistry) as sim modifiers for `g`; undefined when there is nothing to apply. */
export function buildMods(l: League, g: Game): GameMods | undefined {
  if (!isUserGame(l, g)) return undefined
  const me = l.userTeamId
  const roster = Object.values(l.players).filter((p) => p.teamId === me && !p.retired)
  const mods: GameMods = { shooting: {}, defense: {}, energy: {}, sit: [], chemistry: {} }
  const add = (rec: Record<string, number>, id: string, v: number) => { rec[id] = (rec[id] ?? 0) + v }
  const rests: string[] = []
  for (const fx of l.events.active) {
    if (fx.rest && fx.playerId) { rests.push(fx.playerId); continue }
    for (const p of fx.playerId ? roster.filter((q) => q.id === fx.playerId) : roster) {
      if (fx.kind === 'shooting' || fx.kind === 'all') add(mods.shooting, p.id, fx.amount)
      if (fx.kind === 'defense' || fx.kind === 'all') add(mods.defense, p.id, fx.amount)
      if (fx.kind === 'energy' || fx.kind === 'all') add(mods.energy, p.id, fx.amount)
    }
  }
  for (const id of Object.keys(mods.shooting)) mods.shooting[id] = clamp(mods.shooting[id], -CAP.shooting, CAP.shooting)
  for (const id of Object.keys(mods.defense)) mods.defense[id] = clamp(mods.defense[id], -CAP.defense, CAP.defense)
  for (const id of Object.keys(mods.energy)) mods.energy[id] = clamp(mods.energy[id], -CAP.energy, CAP.energy)
  // Resting is a perk, never a forfeit: keep at least a starting five of healthy players on the floor.
  const able = roster.filter((p) => !p.injury)
  const sit = [...new Set(rests)].filter((id) => able.some((p) => p.id === id))
  mods.sit = able.length - sit.length >= STARTERS ? sit : []
  const chem = l.chemistry[me] ?? 50
  if (chem !== 50) mods.chemistry[me] = chem
  const empty = !mods.sit.length && !Object.keys(mods.chemistry).length && !Object.keys(mods.shooting).length && !Object.keys(mods.defense).length && !Object.keys(mods.energy).length
  return empty ? undefined : mods
}

/** After the user's game: every temporary effect has one fewer game to run. */
export function tickEffects(l: League): void {
  for (const fx of l.events.active) fx.gamesLeft--
  l.events.active = l.events.active.filter((fx) => fx.gamesLeft > 0)
}
