import type { Rng } from '../rng'
import type { Game, Team } from '../types'

type Edge = [number, number]

/** Spreads the 600 games over ~80 days so teams play roughly every other day. */
const MAX_GAMES_PER_DAY = 8

/** Matchups: everyone once (29) + 10 conference extras (circulant, distance 1–5) + 1 cross-conference = 40. */
function buildMatchups(teams: Team[], rng: Rng): Edge[] {
  const edges: Edge[] = []
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) edges.push([i, j])
  const conf = (c: 'East' | 'West') => rng.shuffle(teams.map((t, i) => (t.conf === c ? i : -1)).filter((i) => i >= 0))
  const east = conf('East')
  const west = conf('West')
  // Distances 1–5 on a 15-cycle: each team gets exactly 10 extra conference games, no pair repeated.
  for (const cyc of [east, west]) {
    const n = cyc.length
    for (let i = 0; i < n; i++) for (let d = 1; d <= 5; d++) edges.push([cyc[i], cyc[(i + d) % n]])
  }
  const westPerm = rng.shuffle([...west])
  east.forEach((e, k) => edges.push([e, westPerm[k]]))
  return edges
}

/** Orient edges along an Euler circuit so every vertex has in = out. Returns [home, away] pairs. */
function eulerOrient(edges: Edge[], n: number): Edge[] {
  const adj: number[][] = Array.from({ length: n }, () => [])
  edges.forEach(([a, b], i) => {
    adj[a].push(i)
    adj[b].push(i)
  })
  const used = new Array(edges.length).fill(false)
  const ptr = new Array(n).fill(0)
  const oriented: Edge[] = []
  const stack: { v: number; via: number }[] = [{ v: 0, via: -1 }]
  while (stack.length) {
    const top = stack[stack.length - 1]
    const list = adj[top.v]
    while (ptr[top.v] < list.length && used[list[ptr[top.v]]]) ptr[top.v]++
    if (ptr[top.v] < list.length) {
      const ei = list[ptr[top.v]]
      used[ei] = true
      const [a, b] = edges[ei]
      stack.push({ v: a === top.v ? b : a, via: ei })
    } else {
      stack.pop()
      if (top.via >= 0) {
        const prev = stack[stack.length - 1].v
        oriented.push([top.v, prev]) // traversed prev → top.v; home = top.v
      }
    }
  }
  return oriented
}

export function generateSchedule(teams: Team[], season: number, rng: Rng): Game[] {
  const n = teams.length
  const oriented = eulerOrient(buildMatchups(teams, rng), n)
  const pending = rng.shuffle(oriented.map(([h, a]) => ({ h, a })))
  const remaining = new Array(n).fill(0)
  for (const g of pending) {
    remaining[g.h]++
    remaining[g.a]++
  }
  const playedOn: Set<number>[] = Array.from({ length: n }, () => new Set())
  const games: Game[] = []
  let day = 0
  while (pending.length) {
    day++
    pending.sort((x, y) => remaining[y.h] + remaining[y.a] - (remaining[x.h] + remaining[x.a]))
    const busy = new Set<number>()
    const tired = (t: number) => playedOn[t].has(day - 1) && playedOn[t].has(day - 2)
    for (let i = 0; i < pending.length && busy.size < MAX_GAMES_PER_DAY * 2; ) {
      const g = pending[i]
      if (!busy.has(g.h) && !busy.has(g.a) && !tired(g.h) && !tired(g.a)) {
        busy.add(g.h)
        busy.add(g.a)
        playedOn[g.h].add(day)
        playedOn[g.a].add(day)
        remaining[g.h]--
        remaining[g.a]--
        games.push({
          id: `g_${season}_${games.length + 1}`,
          season,
          day,
          homeId: teams[g.h].id,
          awayId: teams[g.a].id,
          playoff: null,
          result: null,
        })
        pending.splice(i, 1)
      } else i++
    }
  }
  return games
}
