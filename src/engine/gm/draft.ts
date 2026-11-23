import { MIN_SALARY, ROSTER_MAX } from '../constants'
import { generatePlayer } from '../player/generate'
import type { Rng } from '../rng'
import { computeStandings } from '../standings'
import type { DraftPick, DraftSlot, DraftState, League, LotteryEntry, Player, Team } from '../types'
import { GmError, capProblem, committed, log, money, ovr, pname, refreshRotation, tname } from './cap'

export const PROSPECTS = 70
/** Lottery odds (per 1000) for the 14 non-playoff teams, worst record first. */
export const LOTTERY_ODDS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5]
export const LOTTERY_DRAWS = 4

export function createPicks(teams: Team[], seasons: number[]): DraftPick[] {
  const out: DraftPick[] = []
  for (const season of seasons)
    for (const round of [1, 2] as const)
      for (const t of teams) out.push({ id: `pk_${season}_${round}_${t.id}`, season, round, originalTeamId: t.id, ownerId: t.id })
  return out
}

/** Rookie scale (thousands): R1 #1 $10M sliding to $1.5M at #30, R2 minimum. */
export function rookieSalary(slot: DraftSlot): number {
  if (slot.round === 2) return MIN_SALARY
  return Math.round((10_000 - ((slot.pick - 1) / 29) * 8_500) / 100) * 100
}
export const rookieYears = (slot: DraftSlot) => (slot.round === 1 ? 3 : 2)

const FIRST_ROUND = 30
const FIRST_ROUND_FLOOR = 68

/** Target OVR of each prospect, best first. Slot-shaped: a Flagg/Wemby type up top, then 68+ through the first round. */
export function prospectTargets(rng: Rng): { target: number; generational: boolean }[] {
  const out: { target: number; generational: boolean }[] = []
  for (let r = 0; r < PROSPECTS; r++) {
    if (r >= FIRST_ROUND) {
      out.push({ target: Math.max(42, Math.min(62, Math.round(rng.normal(54, 5.5)))), generational: false })
      continue
    }
    const generational = r < 2 && rng.chance(0.6)
    if (generational) {
      out.push({ target: Math.max(77, Math.min(84, Math.round(rng.normal(80, 1.5)))), generational })
      continue
    }
    const base = r === 0 ? 77 : r < 5 ? 79 - 0.9 * r : r < 14 ? 74.5 - 0.55 * (r - 5) : 70.5 - 0.15 * (r - 14)
    out.push({ target: Math.max(FIRST_ROUND_FLOOR, Math.round(base + rng.normal(0, 1.2))), generational })
  }
  return out.sort((a, b) => b.target - a.target)
}

export function generateProspects(l: League, rng: Rng): { ids: string[]; scout: DraftState['scout'] } {
  const ids: string[] = []
  const scout: DraftState['scout'] = {}
  const targets = prospectTargets(rng)
  for (let i = 0; i < PROSPECTS; i++) {
    const elite = i < 8
    const { target, generational } = targets[i]
    const p = generatePlayer(rng, { season: l.season + 1, age: rng.int(19, 22), targetOvr: target })
    const o = ovr(p)
    p.pot = Math.max(o + 3, Math.min(97, Math.round(o + rng.normal(generational ? 14 : elite ? 9 : 6, generational ? 3 : 4) - (p.age - 19) * 1.5)))
    p.morale = 60
    l.players[p.id] = p
    ids.push(p.id)
    const spread = rng.int(3, 7)
    const shift = rng.int(-3, 3)
    scout[p.id] = { ovrLo: o + shift - spread, ovrHi: o + shift + spread, pot: Math.max(40, Math.min(99, Math.round(p.pot + rng.normal(0, 4)))) }
  }
  return { ids, scout }
}

/** Builds the draft class and runs the lottery (revealed one pick at a time in the UI). */
export function setupDraft(l: League, rng: Rng): void {
  const { ids, scout } = generateProspects(l, rng)
  const st = computeStandings(l, l.season)
  const all = [...st.East, ...st.West].sort((a, b) => a.pct - b.pct || a.w - b.w || (a.teamId < b.teamId ? -1 : 1))
  const playoffIds = new Set((l.playoffs?.series ?? []).filter((s) => s.round === 1).flatMap((s) => [s.highSeedId, s.lowSeedId]))
  const lotteryTeams = all.filter((r) => !playoffIds.has(r.teamId)).slice(0, LOTTERY_ODDS.length).map((r) => r.teamId)
  const rest = all.map((r) => r.teamId).filter((id) => !lotteryTeams.includes(id))

  const pool = lotteryTeams.map((teamId, i) => ({ teamId, odds: LOTTERY_ODDS[i], preSlot: i + 1 }))
  const drawn: string[] = []
  for (let k = 0; k < LOTTERY_DRAWS && pool.length; k++) {
    const win = rng.weighted(pool.filter((e) => !drawn.includes(e.teamId)), (e) => e.odds)
    drawn.push(win.teamId)
  }
  const lotteryOrder = [...drawn, ...lotteryTeams.filter((id) => !drawn.includes(id))]
  const lottery: LotteryEntry[] = pool.map((e) => ({ ...e, pick: lotteryOrder.indexOf(e.teamId) + 1 }))
  const round1 = [...lotteryOrder, ...rest]
  const round2 = all.map((r) => r.teamId)
  const order: DraftSlot[] = []
  const slot = (round: 1 | 2, original: string, n: number) => {
    const pk = l.picks.find((p) => p.season === l.season && p.round === round && p.originalTeamId === original)
    order.push({ pick: n, round, teamId: pk?.ownerId ?? original, pickId: pk?.id ?? `pk_${l.season}_${round}_${original}`, playerId: null })
  }
  round1.forEach((id, i) => slot(1, id, i + 1))
  round2.forEach((id, i) => slot(2, id, 31 + i))
  l.draft = { season: l.season, prospects: ids, lottery, order, scout }
}

export const currentSlot = (l: League) => l.draft?.order.find((s) => !s.playerId) ?? null

/** Expected value of a prospect to a team: OVR now and ceiling, with a small nudge for positions it lacks. */
function draftScore(have: number, p: Player): number {
  return 0.5 * ovr(p) + 0.5 * p.pot + (have <= 1 ? 1.5 : have >= 4 ? -1.5 : 0)
}

export function makePick(l: League, playerId: string): void {
  const s = currentSlot(l)
  if (!s || !l.draft) throw new GmError('The draft is over.')
  if (!l.draft.prospects.includes(playerId)) throw new GmError('That prospect is already gone.')
  const p = l.players[playerId]
  s.playerId = playerId
  l.draft.prospects = l.draft.prospects.filter((id) => id !== playerId)
  l.draftRights[playerId] = s.teamId
  p.draft = { season: l.season, round: s.round, pick: s.pick, teamId: s.teamId }
  log(l, 'draft', [s.teamId], [playerId], `${tname(l, s.teamId)} drafted ${pname(p)} (${p.pos}) at #${s.pick}.`)
}

function aiPick(l: League): void {
  const s = currentSlot(l)!
  const have: Record<string, number> = {}
  for (const q of committed(l, s.teamId)) have[q.pos] = (have[q.pos] ?? 0) + 1
  const score = (p: Player) => draftScore(have[p.pos] ?? 0, p)
  const best = l.draft!.prospects.map((id) => l.players[id]).reduce((a, b) => (score(b) > score(a) ? b : a))
  makePick(l, best.id)
}

/** CPU teams pick until the user is on the clock (or the draft ends). */
export function draftUntilUser(l: League): void {
  for (let s = currentSlot(l); s && s.teamId !== l.userTeamId; s = currentSlot(l)) aiPick(l)
}

/** Picks for the user by the same logic the CPU uses. */
export function autoPick(l: League): void {
  if (currentSlot(l)?.teamId !== l.userTeamId) throw new GmError("You're not on the clock.")
  aiPick(l)
}

export function finishDraft(l: League): void {
  while (currentSlot(l)) aiPick(l)
  const d = l.draft!
  d.prospects = [] // undrafted prospects are now ordinary free agents
  // CPU teams sign the picks they can fit; the rest are let go.
  for (const [pid, teamId] of Object.entries(l.draftRights)) {
    if (teamId === l.userTeamId) continue
    const slot = d.order.find((s) => s.playerId === pid)!
    if (committed(l, teamId).length < ROSTER_MAX && !capProblem(l, teamId, { addSalary: rookieSalary(slot), addCount: 1 })) signRights(l, pid)
    else releaseRights(l, pid)
  }
  const teams = Object.values(l.teams)
  if (!l.picks.some((p) => p.season === l.season + 2)) l.picks.push(...createPicks(teams, [l.season + 2]))
  l.picks = l.picks.filter((p) => p.season > l.season)
}

export function signRights(l: League, playerId: string): void {
  const teamId = l.draftRights[playerId]
  const slot = l.draft?.order.find((s) => s.playerId === playerId)
  if (!teamId || !slot) throw new GmError('No draft rights to sign.')
  const salary = rookieSalary(slot)
  const problem = capProblem(l, teamId, { addSalary: salary, addCount: 1 }, 'Signing him')
  if (problem) throw new GmError(problem)
  const p = l.players[playerId]
  p.teamId = teamId
  p.contract = { salary, expires: l.season + rookieYears(slot) }
  delete l.draftRights[playerId]
  refreshRotation(l, teamId)
  log(l, 'sign', [teamId], [playerId], `${tname(l, teamId)} signed first-year ${pname(p)}: ${rookieYears(slot)} yrs, ${money(salary)}/yr.`)
}

export function releaseRights(l: League, playerId: string): void {
  const teamId = l.draftRights[playerId]
  if (!teamId) throw new GmError('No draft rights to release.')
  delete l.draftRights[playerId]
  log(l, 'release', [teamId], [playerId], `${tname(l, teamId)} renounced the rights to ${pname(l.players[playerId])}.`)
}
