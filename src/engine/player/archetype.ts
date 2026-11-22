import type { Player, Ratings } from '../types'
import { RATING_KEYS } from './ratings'

/** Skill groups a title is built from: 7 on offense, 2 on defense. */
type G = 'S3' | 'MID' | 'INS' | 'PASS' | 'HDL' | 'ATH' | 'REB' | 'PD' | 'ID'

const GROUPS: Record<G, (keyof Ratings)[]> = {
  S3: ['three'], MID: ['mid'], INS: ['ins'], PASS: ['pass', 'iq'], HDL: ['handle'], ATH: ['ath'],
  REB: ['oreb', 'dreb'], PD: ['perD', 'stl'], ID: ['intD', 'blk'],
}
const ALL = Object.keys(GROUPS) as G[]
const OFF: G[] = ['S3', 'MID', 'INS', 'PASS', 'HDL', 'ATH', 'REB']
const DEF: G[] = ['PD', 'ID']

/**
 * League-wide mean and spread of (group − player's average rating). Ranking groups by this z-score finds what a
 * player is unusually good at, without single-rating groups or bigs' natural rebounding swamping every title.
 */
const NORM: Record<G, { m: number; s: number }> = {
  S3: { m: -1.3, s: 13.2 }, MID: { m: 2.4, s: 8.3 }, INS: { m: 2.8, s: 9.2 }, PASS: { m: 0.8, s: 6.8 },
  HDL: { m: -1.4, s: 13.6 }, ATH: { m: 1.5, s: 7.8 }, REB: { m: -0.9, s: 12.5 }, PD: { m: -0.3, s: 7.2 },
  ID: { m: -1.5, s: 11.4 },
}

export const ARCHETYPES = [
  '2-Way 3-Level Playmaker', '2-Way Bucket Chaser', '2-Way Mid-Post Slasher', '2-Way Middy Slasher', '2-Way Paint Playmaker',
  '2-Way Scoring Creator', '2-Way Sharpshooter', '2-Way Shot Creator', 'Anomaly', 'Athletic Iso Savant', 'Backcourt Bully',
  'Backline Post Pro', 'Block Party', 'Bouncy Sniper', 'Buckets', 'Bully-Ball Big', 'Chaos-Creating Burner', 'Conductor',
  'Crafty Offensive Engine', 'Defensive Lock', 'Defensive Playmaker', 'Diming Post Popper', 'Diming Sharpshooter', 'Flight Risk',
  'Glass & Splash Wing', 'Hash-Sinking Slasher', 'Inside-Out Combo Guard', 'Jelly Dimer', 'Launchpad', 'Off-the-Bounce Bulldozer',
  'Off-the-Bounce Killer', 'Offensive Engine', 'Offensive Maverick', 'Point-Fading Wizard', 'Post Bully Facilitator',
  'Post-Diming Enforcer', 'Post-Up Glass Guardian', 'Prototype', 'Scoop Artist', 'Sharpshooter', 'Splash', 'Triple-Double Threat',
  'Turbo', 'Versatile Finisher', 'Versatile Slasher',
] as const

type Frame = 'guard' | 'wing' | 'big'
const frameOf = (p: Player): Frame => (p.pos === 'PG' || p.pos === 'SG' ? 'guard' : p.pos === 'SF' ? 'wing' : 'big')
const by = (f: Frame, guard: string, wing: string, big: string) => (f === 'guard' ? guard : f === 'wing' ? wing : big)

/** Title when one skill clearly stands above the rest. */
function single(g: G, f: Frame, v: number): string {
  switch (g) {
    case 'S3': return v >= 92 ? 'Splash' : 'Sharpshooter'
    case 'MID': return 'Point-Fading Wizard'
    case 'INS': return by(f, 'Scoop Artist', 'Scoop Artist', 'Backline Post Pro')
    case 'PASS': return 'Conductor'
    case 'HDL': return 'Off-the-Bounce Killer'
    case 'ATH': return by(f, 'Turbo', 'Flight Risk', 'Launchpad')
    case 'REB': return 'Post-Up Glass Guardian'
    case 'PD': return 'Defensive Lock'
    case 'ID': return 'Block Party'
  }
}

/** Title from the top two skills (order doesn't matter). */
function pair(a: G, b: G, f: Frame): string {
  const has = (x: G, y: G) => (a === x && b === y) || (a === y && b === x)
  if (has('S3', 'MID')) return 'Buckets'
  if (has('S3', 'INS')) return by(f, 'Inside-Out Combo Guard', 'Versatile Slasher', 'Versatile Slasher')
  if (has('S3', 'PASS')) return by(f, 'Diming Sharpshooter', 'Diming Sharpshooter', 'Diming Post Popper')
  if (has('S3', 'HDL')) return 'Off-the-Bounce Killer'
  if (has('S3', 'ATH')) return 'Bouncy Sniper'
  if (has('S3', 'REB')) return 'Glass & Splash Wing'
  if (has('S3', 'PD')) return '2-Way Sharpshooter'
  if (has('S3', 'ID')) return by(f, '2-Way Sharpshooter', '2-Way Sharpshooter', 'Diming Post Popper')
  if (has('MID', 'INS')) return 'Hash-Sinking Slasher'
  if (has('MID', 'PASS')) return 'Crafty Offensive Engine'
  if (has('MID', 'HDL')) return 'Point-Fading Wizard'
  if (has('MID', 'ATH')) return 'Athletic Iso Savant'
  if (has('MID', 'REB')) return by(f, 'Buckets', 'Hash-Sinking Slasher', 'Backline Post Pro')
  if (has('MID', 'PD')) return '2-Way Middy Slasher'
  if (has('MID', 'ID')) return '2-Way Mid-Post Slasher'
  if (has('INS', 'PASS')) return by(f, 'Jelly Dimer', 'Jelly Dimer', 'Post-Diming Enforcer')
  if (has('INS', 'HDL')) return by(f, 'Backcourt Bully', 'Off-the-Bounce Bulldozer', 'Off-the-Bounce Bulldozer')
  if (has('INS', 'ATH')) return by(f, 'Versatile Finisher', 'Flight Risk', 'Launchpad')
  if (has('INS', 'REB')) return by(f, 'Backcourt Bully', 'Versatile Finisher', 'Bully-Ball Big')
  if (has('INS', 'PD')) return '2-Way Bucket Chaser'
  if (has('INS', 'ID')) return 'Bully-Ball Big'
  if (has('PASS', 'HDL')) return by(f, 'Offensive Engine', 'Offensive Engine', 'Post Bully Facilitator')
  if (has('PASS', 'ATH')) return 'Chaos-Creating Burner'
  if (has('PASS', 'REB')) return by(f, 'Triple-Double Threat', 'Triple-Double Threat', 'Post Bully Facilitator')
  if (has('PASS', 'PD')) return 'Defensive Playmaker'
  if (has('PASS', 'ID')) return '2-Way Paint Playmaker'
  if (has('HDL', 'ATH')) return 'Turbo'
  if (has('HDL', 'REB')) return 'Offensive Maverick'
  if (has('HDL', 'PD')) return '2-Way Shot Creator'
  if (has('HDL', 'ID')) return '2-Way Scoring Creator'
  if (has('ATH', 'REB')) return by(f, 'Flight Risk', 'Flight Risk', 'Launchpad')
  if (has('ATH', 'PD')) return 'Chaos-Creating Burner'
  if (has('ATH', 'ID')) return 'Block Party'
  if (has('REB', 'PD')) return 'Defensive Lock'
  if (has('REB', 'ID')) return 'Post-Up Glass Guardian'
  return by(f, 'Defensive Lock', 'Defensive Lock', 'Block Party') // PD + ID
}

const BIG_BASICS: G[] = ['REB', 'ID', 'INS']
function bigFlavour(c: G, raw: Record<G, number>): string {
  switch (c) {
    case 'S3': return raw.PASS >= raw.ATH ? 'Diming Post Popper' : 'Glass & Splash Wing'
    case 'MID': return 'Backline Post Pro'
    case 'PASS': return 'Post-Diming Enforcer'
    case 'HDL': return 'Offensive Maverick'
    case 'ATH': return 'Launchpad'
    default: return 'Defensive Lock'
  }
}

/** Elite on both ends: the offensive skill names the 2-Way flavour. */
function twoWay(g: G, f: Frame): string {
  switch (g) {
    case 'S3': return '2-Way Sharpshooter'
    case 'MID': return f === 'big' ? '2-Way Mid-Post Slasher' : '2-Way Middy Slasher'
    case 'INS': return f === 'big' ? '2-Way Mid-Post Slasher' : '2-Way Bucket Chaser'
    case 'PASS': return '2-Way Paint Playmaker'
    case 'HDL': return '2-Way Shot Creator'
    case 'ATH': return '2-Way Scoring Creator'
    default: return '2-Way Bucket Chaser'
  }
}

/** 2K-style archetype title from ratings. */
export function archetypeFor(p: Player): string {
  const r = p.ratings
  const mean = RATING_KEYS.reduce((s, k) => s + r[k], 0) / RATING_KEYS.length
  const raw = {} as Record<G, number>
  for (const g of ALL) raw[g] = GROUPS[g].reduce((s, k) => s + r[k], 0) / GROUPS[g].length
  const z = (g: G) => (raw[g] - mean - NORM[g].m) / NORM[g].s
  const ranked = [...ALL].sort((a, b) => z(b) - z(a))
  const f = frameOf(p)
  const great = ALL.filter((g) => raw[g] >= 85).length

  // Do-everything superstars.
  if (great >= 7 && f === 'big') return 'Anomaly'
  if (great >= 7 && raw.ATH >= 90) return 'Prototype'
  if (f === 'big' && raw.S3 >= 80 && raw.ID >= 82 && raw.HDL >= 75) return 'Anomaly'

  const bestOff = ranked.find((g) => OFF.includes(g))!
  const bestDef = ranked.find((g) => DEF.includes(g))!
  if (raw.S3 >= 82 && raw.MID >= 82 && raw.INS >= 82 && raw.PASS >= 82 && raw[bestDef] >= 84) return '2-Way 3-Level Playmaker'
  if (raw.PASS >= 84 && raw.REB >= 78 && Math.max(raw.S3, raw.MID, raw.INS) >= 82) return 'Triple-Double Threat'
  if (raw.S3 >= 84 && raw.MID >= 84 && raw.INS >= 84) return 'Buckets'
  if (raw[bestOff] >= 84 && raw[bestDef] >= 84 && Math.abs(z(bestOff) - z(bestDef)) <= 0.8) return twoWay(bestOff, f)

  const [a, b, c] = ranked
  if (z(a) - z(b) >= 0.75) return single(a, f, raw[a])
  // Every big rebounds and protects the rim, so for them the third skill decides the flavour.
  if (f === 'big' && BIG_BASICS.includes(a) && BIG_BASICS.includes(b) && !BIG_BASICS.includes(c)) return bigFlavour(c, raw)
  return pair(a, b, f)
}
