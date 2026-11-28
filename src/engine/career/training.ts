import { storyRng } from '../stories/state'
import { gameScore } from '../stories/sentiment'
import { RATING_LABELS } from '../player/ratings'
import type { BoxLine, League, Player, Ratings } from '../types'
import type { CareerState, GrowthEntry } from './types'

/**
 * Skill points (SP): the followed player's only way to grow. He earns them in games (at least 1 for every game he
 * plays, more for beating his own average and for cashing in his moments) and from event cards that go his way, then
 * spends them on trainings here. A training adds exact points, at random, to skills in its group that still have room
 * under his max build.
 */

export type TrainingGroupId = 'shooting' | 'finishing' | 'playmaking' | 'defense' | 'rebounding' | 'athleticism' | 'mental'
export interface TrainingGroup { id: TrainingGroupId; label: string; emoji: string; blurb: string; keys: (keyof Ratings)[] }

export const TRAINING_GROUPS: TrainingGroup[] = [
  { id: 'shooting', label: 'Shooting', emoji: '🎯', blurb: 'Jumpers, threes and free throws', keys: ['closeShot', 'midRangeShot', 'threePointShot', 'freeThrow', 'shotIQ', 'offensiveConsistency'] },
  { id: 'finishing', label: 'Finishing', emoji: '💥', blurb: 'Layups, dunks and post moves', keys: ['layup', 'standingDunk', 'drivingDunk', 'postHook', 'postFade', 'postControl', 'drawFoul', 'hands'] },
  { id: 'playmaking', label: 'Playmaking', emoji: '🎁', blurb: 'Handles and passing', keys: ['passAccuracy', 'ballHandle', 'speedWithBall', 'passIQ', 'passVision'] },
  { id: 'defense', label: 'Defense', emoji: '🛡️', blurb: 'On-ball, help, steals and blocks', keys: ['interiorDefense', 'perimeterDefense', 'steal', 'block', 'helpDefenseIQ', 'passPerception', 'defensiveConsistency'] },
  { id: 'rebounding', label: 'Rebounding', emoji: '🧲', blurb: 'Crashing both glasses', keys: ['offensiveRebound', 'defensiveRebound'] },
  { id: 'athleticism', label: 'Athleticism', emoji: '💨', blurb: 'Speed, bounce, strength and motor', keys: ['speed', 'agility', 'strength', 'vertical', 'stamina', 'hustle', 'overallDurability'] },
  { id: 'mental', label: 'IQ & Mindset', emoji: '🧠', blurb: 'Reads, consistency and leadership', keys: ['intangibles', 'shotIQ', 'passIQ', 'helpDefenseIQ', 'offensiveConsistency', 'defensiveConsistency'] },
]

export interface TrainingTier { cost: number; points: number }
/** 3 SP: one random point · 7 SP: three · 12 SP: six. */
export const TRAINING_TIERS: TrainingTier[] = [{ cost: 3, points: 1 }, { cost: 7, points: 3 }, { cost: 12, points: 6 }]

export interface SpEntry { season: number; day: number; amount: number; source: string }
/** How many recent SP entries are kept for the Development screen. */
const SP_LOG_MAX = 40

export const spOf = (c: CareerState | null | undefined): number => c?.sp ?? 0

/** Adds SP to the followed player's bank (and the recent log). Returns the amount added. */
export function awardSp(l: League, amount: number, source: string): number {
  const c = l.career
  if (!c || c.status !== 'active' || amount <= 0) return 0
  const n = Math.round(amount)
  c.sp = spOf(c) + n
  c.spEarned = (c.spEarned ?? 0) + n
  c.spLog = [...(c.spLog ?? []), { season: l.season, day: l.day, amount: n, source }].slice(-SP_LOG_MAX)
  return n
}

/** Each this many game-score points above his own average is one bonus SP. */
export const PERF_STEP = 4
export const PERF_CAP = 4
/** Each this many moments that went his way (a make, a dime, points at the line) is one bonus SP. */
export const MOMENTS_PER_SP = 3

/** His average game score so far (this season and last, regular season and playoffs); null before his first game. */
export function averageGameScore(l: League, playerId: string): number | null {
  let gp = 0, gs = 0
  for (const s of Object.values(l.statLines)) {
    if (s.playerId !== playerId || s.season < l.season - 1 || s.gp <= 0) continue
    gp += s.gp
    gs += gameScore(s)
  }
  return gp > 0 ? gs / gp : null
}

export interface GameSp { total: number; base: number; perf: number; moments: number; gameScore: number; average: number | null }

/** The SP one game is worth: 1, plus beating his average, plus every few moments that went his way. */
export function gameSp(l: League, line: BoxLine, goodMoments = 0): GameSp {
  const gs = gameScore(line)
  const avg = averageGameScore(l, line.playerId)
  const perf = avg === null ? 0 : Math.max(0, Math.min(PERF_CAP, Math.floor((gs - avg) / PERF_STEP + 1e-9)))
  const moments = Math.floor(goodMoments / MOMENTS_PER_SP)
  return { total: 1 + perf + moments, base: 1, perf, moments, gameScore: gs, average: avg }
}

/** Called once per game he plays in (before the box is added to his stat lines, so the average excludes it). */
export function awardGameSp(l: League, line: BoxLine, goodMoments = 0): GameSp {
  const r = gameSp(l, line, goodMoments)
  const parts = [r.perf && `+${r.perf} beat your average`, r.moments && `+${r.moments} big moments`].filter(Boolean)
  awardSp(l, r.total, parts.length ? `Game (${parts.join(', ')})` : 'Game')
  return r
}

/** Points of room left under his max build in each of the group's skills (deduped). */
export function groupRoom(p: Player, g: TrainingGroup): number {
  if (!p.careerBuild) return 0
  return g.keys.reduce((s, k) => s + Math.max(0, p.careerBuild!.max[k] - p.ratings[k]), 0)
}

export type TrainingCheck = { ok: true } | { ok: false; reason: string }

export function canTrain(l: League, groupId: TrainingGroupId, tier: TrainingTier): TrainingCheck {
  const c = l.career
  const p = c ? l.players[c.playerId] : null
  const g = TRAINING_GROUPS.find((x) => x.id === groupId)
  if (!c || !p || !g || !p.careerBuild) return { ok: false, reason: 'No player to train.' }
  if (c.status !== 'active') return { ok: false, reason: 'Your career is over.' }
  const room = groupRoom(p, g)
  if (room === 0) return { ok: false, reason: `${g.label} is maxed out.` }
  if (room < tier.points) return { ok: false, reason: `Only ${room} point${room === 1 ? '' : 's'} of ${g.label.toLowerCase()} room left.` }
  if (spOf(c) < tier.cost) return { ok: false, reason: `Needs ${tier.cost} SP.` }
  return { ok: true }
}

/**
 * Spends `tier.cost` SP and hands out `tier.points` points, one at a time, to random skills in the group that still
 * have room. Seeded from the league (story stream), so it never shifts game results. Returns the growth made.
 */
export function buyTraining(l: League, groupId: TrainingGroupId, tier: TrainingTier): GrowthEntry[] {
  const check = canTrain(l, groupId, tier)
  if (!check.ok) throw new Error(check.reason)
  const c = l.career!
  const p = l.players[c.playerId]
  const g = TRAINING_GROUPS.find((x) => x.id === groupId)!
  const max = p.careerBuild!.max
  const keys = [...new Set(g.keys)]
  const rng = storyRng(l, 7100 + (c.trainings ?? 0))
  c.trainings = (c.trainings ?? 0) + 1
  c.sp = spOf(c) - tier.cost
  const gained: Partial<Record<keyof Ratings, number>> = {}
  for (let i = 0; i < tier.points; i++) {
    const open = keys.filter((k) => p.ratings[k] < max[k])
    if (!open.length) break
    const k = rng.pick(open)
    p.ratings[k] += 1
    gained[k] = (gained[k] ?? 0) + 1
  }
  const source = `${g.label} training`
  const out: GrowthEntry[] = Object.entries(gained).map(([key, delta]) => ({ season: l.season, day: l.day, key: key as keyof Ratings, delta: delta!, source }))
  c.growth.push(...out)
  return out
}

/** "Three-point +2, Free throw +1" */
export const describeGrowth = (out: GrowthEntry[]): string => out.map((e) => `${RATING_LABELS[e.key]} +${e.delta}`).join(', ')

/** An event card's growth grant, as SP: one SP per point the card would have granted. */
export const grantSp = (grants: { amount: number }[]): number => grants.reduce((s, g) => s + Math.max(0, g.amount), 0)
