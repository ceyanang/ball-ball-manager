import { fanOf } from '../stories/sentiment'
import { induct } from '../stories/awards'
import type { League } from '../types'
import { ovrOf } from './careerOvr'

export interface CareerSummary {
  name: string; age: number; seasons: number; titles: number; finalsMvps: number; mvps: number; dpoys: number
  allLeague: number; peakOvr: number; finalOvr: number; fans: number; points: number; games: number; teams: number
  /** Times a growth event came from a rivalry night. */
  rivalMoments: number
  retiredEarly: boolean; refusals: number; hof: boolean
}

export interface EndingDef { id: string; title: string; when(s: CareerSummary): boolean; lines: ((s: CareerSummary) => string)[] }

/** Ordered: the first ending whose condition matches wins; the last always matches. */
export const ENDINGS: EndingDef[] = [
  {
    id: 'walked-away', title: 'Walked Away at the Top',
    when: (s) => s.retiredEarly && s.finalOvr >= 88,
    lines: [
      (s) => `${s.name} hung it up at ${s.age} while still among the best players alive. Nobody saw it coming, and nobody could say he was done.`,
      (s) => `${s.seasons} seasons, ${s.titles} title${s.titles === 1 ? '' : 's'}, and a peak Career OVR of ${s.peakOvr}. The last game was a good one.`,
      () => 'Years later people will still ask: what if he had played one more?',
    ],
  },
  {
    id: 'legend', title: 'A Legend',
    when: (s) => s.titles >= 2 && (s.mvps >= 1 || s.allLeague >= 4) && s.peakOvr >= 90,
    lines: [
      (s) => `${s.name} finished with ${s.titles} championships and ${s.mvps} MVP${s.mvps === 1 ? '' : 's'}. His number hangs from a rafter and his name is a measuring stick.`,
      (s) => `${s.points.toLocaleString()} points over ${s.games} games, ${s.allLeague} All-League selections, and fans who never really let go.`,
      () => 'The Hall of Fame will call. The highlight reels never stopped.',
    ],
  },
  {
    id: 'forgotten-legend', title: 'A Forgotten Legend',
    when: (s) => s.allLeague >= 3 && s.peakOvr >= 88 && s.fans < 20,
    lines: [
      (s) => `${s.name} was one of the best of his era, with ${s.allLeague} All-League nods and a peak Career OVR of ${s.peakOvr}.`,
      () => 'And yet the arenas were never really his. He moved around, he never made a fuss, and the era moved on.',
      () => 'The numbers are in the books. Ask a stranger and you will get a shrug.',
    ],
  },
  {
    id: 'bench-guy', title: 'A Well-Loved Bench Guy',
    when: (s) => s.fans >= 40 && s.peakOvr < 82,
    lines: [
      (s) => `${s.name} was never the best player on the floor. He was the one the crowd chanted for when the game was already won.`,
      (s) => `${s.seasons} seasons, ${s.teams} team${s.teams === 1 ? '' : 's'}, and a reputation as the nicest man in the league.`,
      () => 'The locker room says the team was better with him in it. The box score never would.',
    ],
  },
  {
    id: 'champion', title: 'A Ring and a Name',
    when: (s) => s.titles >= 1,
    lines: [
      (s) => `${s.name} won ${s.titles === 1 ? 'a title' : `${s.titles} titles`} and spent the rest of his career being recognised for it.`,
      (s) => `${s.seasons} seasons, a peak Career OVR of ${s.peakOvr}. Not a legend, but forever a champion.`,
    ],
  },
  {
    id: 'journeyman', title: 'The Journeyman',
    when: (s) => s.teams >= 4,
    lines: [
      (s) => `${s.name} played for ${s.teams} teams in ${s.seasons} seasons, and every locker room liked him.`,
      () => 'Always the next call, never the first. He made a living and a lot of friends.',
    ],
  },
  {
    id: 'solid', title: 'A Solid Career',
    when: () => true,
    lines: [
      (s) => `${s.name} played ${s.seasons} season${s.seasons === 1 ? '' : 's'} in the league and retired at ${s.age}.`,
      (s) => `${s.points.toLocaleString()} points, a peak Career OVR of ${s.peakOvr}, and the quiet satisfaction of having made it at all.`,
    ],
  },
]

/** Everything the endings read, computed from the league (deterministic). */
export function buildSummary(l: League): CareerSummary {
  const c = l.career!
  const p = l.players[c.playerId]
  const lines = Object.values(l.statLines).filter((s) => s.playerId === p.id && !s.playoffs)
  const peak = Math.max(ovrOf(p), ...p.ratingHistory.map((h) => h.ovr))
  const teams = new Set(Object.values(l.statLines).filter((s) => s.playerId === p.id).map((s) => s.teamId))
  return {
    name: `${p.firstName} ${p.lastName}`,
    age: p.age,
    seasons: new Set(lines.map((s) => s.season)).size,
    titles: l.awards.filter((a) => a.championRoster.includes(p.id)).length,
    finalsMvps: l.awards.filter((a) => a.finalsMvp === p.id).length,
    mvps: l.awards.filter((a) => a.mvp === p.id).length,
    dpoys: l.awards.filter((a) => a.dpoy === p.id).length,
    allLeague: l.awards.reduce((n, a) => n + a.allLeague.filter((t) => t.includes(p.id)).length, 0),
    peakOvr: peak,
    finalOvr: ovrOf(p),
    fans: Math.round(fanOf(l, p.id)),
    points: lines.reduce((s, x) => s + x.pts, 0),
    games: lines.reduce((s, x) => s + x.gp, 0),
    teams: teams.size,
    rivalMoments: c.growth.filter((g) => g.source === 'Rivalry night').length,
    retiredEarly: !!c.retiredEarly,
    refusals: c.refusals ?? 0,
    hof: l.hof.some((h) => h.playerId === p.id),
  }
}

/** He is done: off every roster, an ending chosen from his numbers, the save stays viewable. */
export function finishCareer(l: League): void {
  const c = l.career!
  const p = l.players[c.playerId]
  const team = p.teamId
  p.retired = true
  p.teamId = null
  p.contract = null
  if (team) {
    const t = l.teams[team]
    t.rotation = { ...t.rotation, starters: t.rotation.starters.filter((id) => id !== p.id), bench: t.rotation.bench.filter((id) => id !== p.id), inactive: t.rotation.inactive.filter((id) => id !== p.id) }
  }
  c.offers = null
  c.retirement = null
  c.pending = null
  c.status = 'retired'
  induct(l, [p.id])
  const s = buildSummary({ ...l, career: c })
  const def = ENDINGS.find((e) => e.when(s)) ?? ENDINGS[ENDINGS.length - 1]
  c.ending = { id: def.id, title: def.title, lines: def.lines.map((f) => f(s)) }
  c.log.push({ season: l.season, text: `Retired: ${def.title}.` })
}
