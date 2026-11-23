import { ovr } from '../gm/cap'
import { clamp, storyRng } from '../stories/state'
import type { Game, League, Player } from '../types'
import { CATALOG } from './catalog'
import { applyEffects } from './effects'
import type { EventCtx, EventDef, EventWhen } from './types'
import type { EventLogEntry, Subjects } from './state'

/** Chance a roll fires an event, by frequency setting and moment. ~20 a season on "lots" (a season is 40 games per team). */
export const EVENT_TUNING = {
  some: { preGame: 0.12, day: 0.05, postGame: 0.04 },
  lots: { preGame: 0.28, day: 0.12, postGame: 0.1 },
} as const

const HISTORY_MAX = 100
const DEFAULT_COOLDOWN = 10

let override: EventDef[] | null = null
/** Tests swap the catalog for a tiny one (pass null to restore). */
export function setCatalogForTests(defs: EventDef[] | null): void { override = defs }
export const catalog = (): EventDef[] => override ?? CATALOG
export const eventDef = (id: string): EventDef | undefined => catalog().find((d) => d.id === id)

/** One increasing clock across seasons, so cooldowns survive the day counter resetting. */
export const eventClock = (l: League) => (l.season - 1) * 1000 + l.day

const SLOT = { preGame: 'pre', postGame: 'post', day: 'day' } as const

function hashId(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function userRoster(l: League): Player[] {
  return Object.values(l.players)
    .filter((p) => p.teamId === l.userTeamId && !p.retired)
    .sort((a, b) => Number(!!a.injury) - Number(!!b.injury) || ovr(b) - ovr(a))
}

function userGameOutcome(l: League, g: Game | null): EventCtx['userGame'] {
  const r = g?.result
  if (!g || !r) return null
  const home = g.homeId === l.userTeamId
  const margin = (home ? 1 : -1) * (r.homeScore - r.awayScore)
  return { won: margin > 0, margin: Math.abs(margin) }
}

/**
 * Maybe fires an event for this moment: sets `l.events.pending` and returns true. Each day/slot is rolled once, so
 * answering an event and re-running the day never re-rolls it.
 */
export function rollEvent(l: League, when: EventWhen, game: Game | null): boolean {
  const ev = l.events
  if (ev.frequency === 'off' || ev.pending) return false
  const slot = SLOT[when]
  const r = ev.rolled
  if (r && r.season === l.season && r.phase === l.phase && r.day === l.day && r.slot === slot) return false
  ev.rolled = { season: l.season, phase: l.phase, day: l.day, slot }
  const rng = storyRng(l, 77 + (slot === 'pre' ? 0 : slot === 'day' ? 1 : 2))
  if (!rng.chance(EVENT_TUNING[ev.frequency][when])) return false
  const ctx: EventCtx = { l, when, game, userGame: userGameOutcome(l, game), roster: userRoster(l) }
  const now = eventClock(l)
  const options: { def: EventDef; subjects: Subjects }[] = []
  for (const def of catalog()) {
    if (def.when !== when || (def.playoffsOnly && l.phase !== 'playoffs') || (ev.cooldowns[def.id] ?? 0) > now) continue
    const subjects = def.pick(ctx)
    if (subjects) options.push({ def, subjects })
  }
  if (!options.length) return false
  const chosen = rng.weighted(options, (o) => o.def.weight)
  ev.pending = { eventId: chosen.def.id, season: l.season, phase: l.phase, day: l.day, subjects: chosen.subjects }
  return true
}

const stillValid = (l: League, s: Subjects) =>
  s.playerIds.every((id) => { const p = l.players[id]; return !!p && !p.retired && p.teamId === l.userTeamId })

/** The prompt to show for the pending event, or null. */
export function describePending(l: League): { def: EventDef; title: string; text: string } | null {
  const pend = l.events.pending
  const def = pend && eventDef(pend.eventId)
  if (!pend || !def || !stillValid(l, pend.subjects)) return null
  return { def, title: def.title(pend.subjects, l), text: def.text(pend.subjects, l) }
}

/**
 * Resolves the pending event with the chosen answer. The outcome is drawn from the league seed + event + choice, so
 * reloading a save and answering again gives the same result. Returns null (and clears the prompt) when there is
 * nothing to answer or a player it was about has left the team.
 */
export function answerEvent(l: League, choiceIndex: number): EventLogEntry | null {
  const ev = l.events
  const pend = ev.pending
  if (!pend) return null
  const def = eventDef(pend.eventId)
  const choice = def?.choices[choiceIndex]
  if (!def || !choice || !stillValid(l, pend.subjects)) {
    ev.pending = null
    return null
  }
  const s = pend.subjects
  const rng = storyRng(l, hashId(def.id) + (choiceIndex + 1) * 7919)
  const out = rng.weighted(choice.outcomes, (o) => o.weight)
  const entry: EventLogEntry = {
    eventId: def.id, season: l.season, day: l.day, title: def.title(s, l), choice: choice.label,
    outcomeText: out.text(s, l), tone: out.tone, changes: applyEffects(l, out.effects(s, l)),
  }
  ev.history.push(entry)
  if (ev.history.length > HISTORY_MAX) ev.history.splice(0, ev.history.length - HISTORY_MAX)
  ev.cooldowns[def.id] = eventClock(l) + clamp(def.cooldownDays ?? DEFAULT_COOLDOWN, 0, 1000)
  ev.pending = null
  return entry
}

/** Skip a between-day event (no effect). Game-day events must be answered. */
export function skipEvent(l: League): boolean {
  const pend = l.events.pending
  const def = pend && eventDef(pend.eventId)
  if (!pend) return false
  if (def && def.when !== 'day') return false
  l.events.pending = null
  return true
}
