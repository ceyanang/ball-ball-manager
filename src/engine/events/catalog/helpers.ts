import { pname } from '../../gm/cap'
import { storyRng } from '../../stories/state'
import type { League, Player, Ratings } from '../../types'
import type { Effect } from '../effects'
import type { EventCtx, EventDef, EventWhen, OutcomeDef } from '../types'

/** Names handed to event text: the player the event is about, or the head coach for whole-team events. */
export interface Nm { full: string; first: string; last: string }
/** [weight, tone, text, effects(playerId)] */
export type Out = [weight: number, tone: OutcomeDef['tone'], text: (n: Nm) => string, fx: (id: string) => Effect[]]
export interface Choice { label: string; emoji?: string; out: Out[] }
export interface Spec {
  id: string
  when: EventWhen
  weight?: number
  cooldownDays?: number
  request?: boolean
  playoffsOnly?: boolean
  emoji: string
  /** Who it's about. Omit for a whole-team event (then the names are the head coach's). */
  who?: (p: Player, rank: number, ctx: EventCtx) => boolean
  needs?: (ctx: EventCtx) => boolean
  title: (n: Nm) => string
  text: (n: Nm) => string
  choices: Choice[]
}

const nm = (p: { firstName: string; lastName: string }): Nm => ({ full: `${p.firstName} ${p.lastName}`, first: p.firstName, last: p.lastName })
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }

/** Turns a compact spec into an EventDef. */
export function event(spec: Spec): EventDef {
  const names = (s: { playerIds: string[]; coachId?: string }, l: League): Nm => {
    const p = s.playerIds[0] ? l.players[s.playerIds[0]] : null
    return p ? nm(p) : nm(l.coaches[s.coachId ?? l.teams[l.userTeamId].coachId])
  }
  return {
    id: spec.id, when: spec.when, weight: spec.weight ?? 1, cooldownDays: spec.cooldownDays ?? 20, kind: spec.request ? 'request' : undefined,
    playoffsOnly: spec.playoffsOnly, emoji: spec.emoji,
    pick(ctx) {
      if (spec.needs && !spec.needs(ctx)) return null
      const base = { coachId: ctx.l.teams[ctx.l.userTeamId].coachId, teamId: ctx.l.userTeamId }
      if (!spec.who) return { playerIds: [], ...base }
      const pool = ctx.roster.filter((p, i) => spec.who!(p, i, ctx))
      return pool.length ? { playerIds: [storyRng(ctx.l, hash(spec.id)).pick(pool).id], ...base } : null
    },
    title: (s, l) => spec.title(names(s, l)),
    text: (s, l) => spec.text(names(s, l)),
    choices: spec.choices.map((c) => ({
      label: c.label, emoji: c.emoji,
      outcomes: c.out.map(([weight, tone, text, fx]): OutcomeDef => ({ weight, tone, text: (s, l) => text(names(s, l)), effects: (s) => fx(s.playerIds[0] ?? '') })),
    })),
  }
}

// Effect shorthands -----------------------------------------------------------------------------------------------
export const morale = (id: string, delta: number): Effect => ({ kind: 'morale', target: { player: id }, delta })
export const teamMorale = (delta: number): Effect => ({ kind: 'morale', target: 'roster', delta })
export const fans = (id: string, delta: number): Effect => ({ kind: 'fans', target: { player: id }, delta })
export const teamFans = (delta: number): Effect => ({ kind: 'fans', target: 'team', delta })
export const chem = (delta: number): Effect => ({ kind: 'chemistry', delta })
export const buff = (id: string, stat: 'shooting' | 'defense' | 'energy' | 'all', amount: number, games: number): Effect => ({ kind: 'buff', target: { player: id }, stat, amount, games })
export const teamBuff = (stat: 'shooting' | 'defense' | 'energy' | 'all', amount: number, games: number): Effect => ({ kind: 'buff', target: 'team', stat, amount, games })
export const rest = (id: string): Effect => ({ kind: 'rest', player: id })
export const train = (id: string, skill: keyof Ratings, delta: number): Effect => ({ kind: 'train', player: id, skill, delta })
export const nudge = (id: string, delta: number): Effect => ({ kind: 'ovrNudge', player: id, delta })

// Player filters -----------------------------------------------------------------------------------------------------
export const healthy = (p: Player) => !p.injury
export const starter = (p: Player, rank: number) => healthy(p) && rank < 5
export const bench = (p: Player, rank: number) => healthy(p) && rank >= 5
export const young = (p: Player) => healthy(p) && p.age <= 22
export const vet = (p: Player) => healthy(p) && p.age >= 30
export const anyone = (p: Player) => healthy(p)
export { pname }
