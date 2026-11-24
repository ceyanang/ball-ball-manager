import { Rng } from '../rng'
import type { League, RecordBook } from '../types'

export const emptyBook = (): RecordBook => ({ game: {}, season: {}, career: {} })

/** The story fields a brand-new (or freshly migrated) league starts with. */
export function emptyStories(): Pick<League, 'news' | 'social' | 'inbox' | 'awards' | 'history' | 'records' | 'hof' | 'fans' | 'careerHighs' | 'storySeq'> {
  return {
    news: [], social: [], inbox: [], awards: [], history: [], records: { league: emptyBook(), teams: {} }, hof: [],
    fans: { players: {}, teams: {}, base: {} }, careerHighs: {}, storySeq: 0,
  }
}

export const nextId = (l: League, prefix: string) => `${prefix}${++l.storySeq}`

/**
 * Flavour randomness (post templates, fan handles, offer timing) comes from its own stream so stories never shift
 * game results. Same league + day + salt always gives the same draws.
 */
export function storyRng(l: League, salt: number): Rng {
  let h = (l.seed ^ 0x9e3779b9) >>> 0
  for (const v of [l.season, l.day, l.phase === 'offseason' ? 1000 + (l.offseason?.faDay ?? 0) : l.phase === 'playoffs' ? 500 : 0, salt]) {
    h = Math.imul(h ^ (v >>> 0), 0x85ebca6b) >>> 0
    h = (h ^ (h >>> 13)) >>> 0
  }
  return Rng.fromSeed(h)
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
