import type { Player, Ratings } from '../types'

type Group = 'shooting' | 'slashing' | 'playmaking' | 'rebounding' | 'perimD' | 'rimP' | 'post'

const GROUPS: Record<Group, (keyof Ratings)[]> = {
  shooting: ['three', 'mid'],
  slashing: ['ins', 'ath', 'handle'],
  playmaking: ['pass', 'handle', 'iq'],
  rebounding: ['oreb', 'dreb'],
  perimD: ['perD', 'stl'],
  rimP: ['intD', 'blk'],
  post: ['ins', 'oreb', 'intD'],
}
const OFFENSE: Group[] = ['shooting', 'slashing', 'playmaking', 'post']
const DEFENSE: Group[] = ['perimD', 'rimP']
const COMBOS: [Group, Group, string][] = [
  ['shooting', 'perimD', '3&D Wing'],
  ['shooting', 'playmaking', 'Playmaking Shooter'],
  ['slashing', 'playmaking', 'Shot Creator'],
  ['rimP', 'rebounding', 'Paint Anchor'],
  ['shooting', 'rimP', 'Stretch Rim Protector'],
]

export const ARCHETYPES = [
  'Sharpshooter', 'Stretch Big', 'Slasher', 'Floor General', 'Point Forward', 'Glass Cleaner', 'Lockdown Defender',
  'Rim Protector', 'Post Scorer', 'Paint Beast', 'Role Player', ...COMBOS.map((c) => c[2]),
  ...['Sharpshooter', 'Stretch Big', 'Slasher', 'Floor General', 'Point Forward', 'Post Scorer', 'Paint Beast'].map((t) => `2-Way ${t}`),
]

function single(g: Group, p: Player): string {
  const big = p.pos === 'PF' || p.pos === 'C'
  const guard = p.pos === 'PG' || p.pos === 'SG'
  switch (g) {
    case 'shooting': return big ? 'Stretch Big' : 'Sharpshooter'
    case 'slashing': return 'Slasher'
    case 'playmaking': return guard ? 'Floor General' : 'Point Forward'
    case 'rebounding': return 'Glass Cleaner'
    case 'perimD': return 'Lockdown Defender'
    case 'rimP': return 'Rim Protector'
    case 'post': return p.ratings.ath >= 80 ? 'Paint Beast' : 'Post Scorer'
  }
}

/** 2K-style archetype title from ratings. */
export function archetypeFor(p: Player): string {
  // Bigs all rebound well, so rebounding needs a clear edge before it becomes the headline.
  const score = (g: Group) => GROUPS[g].reduce((s, k) => s + p.ratings[k], 0) / GROUPS[g].length - (g === 'rebounding' ? 4 : 0)
  const ranked = (Object.keys(GROUPS) as Group[]).map((g) => ({ g, v: score(g) })).sort((a, b) => b.v - a.v)
  const [top, second] = ranked
  if (top.v < 62) return 'Role Player'
  if (top.v - second.v <= 6) {
    const combo = COMBOS.find(([a, b]) => (a === top.g && b === second.g) || (a === second.g && b === top.g))
    if (combo) return combo[2]
  }
  const off = ranked.find((r) => OFFENSE.includes(r.g))!
  const def = ranked.find((r) => DEFENSE.includes(r.g))!
  // Post scoring and rim protection share interior D, so that pairing isn't "two-way".
  const sharesRatings = GROUPS[off.g].some((k) => GROUPS[def.g].includes(k))
  if (!sharesRatings && off.v >= 75 && def.v >= 75 && Math.abs(off.v - def.v) <= 6) return `2-Way ${single(off.g, p)}`
  return single(top.g, p)
}
