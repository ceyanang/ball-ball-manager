import { allStarDayFor } from '../allstar/allstar'
import { ROSTER_MAX, ROSTER_MIN, SALARY_CAP } from '../constants'
import { generateCoach } from '../coach/generate'
import { RATING_KEYS, RATING_MAX, RATING_MIN, heightMaxFor, weightsForRatings } from '../player/ratings'
import type { Rng } from '../rng'
import { generateSchedule, tradeDeadline } from '../schedule/schedule'
import { computeStandings } from '../standings'
import type { League, OffseasonReport, Player, Ratings } from '../types'
import { GmError, committed, log, money, ovr, payroll, pname, refreshRotation, teamPlayers, tname } from './cap'
import { finishDraft, draftUntilUser, setupDraft } from './draft'
import { FA_DAYS, addFreeAgentBatch, aiFillRosters, aiResign, aiTrimRosters, freeAgencyDay, processWaivers, releaseExpired } from './roster'
import { aiTrades } from './trade'
import { aiDevIds, breakoutBump, breakoutChance, coachFactor, isTraining, pruneTraining } from './training'
import { strengthOrder } from './value'
import { applyRivalBumps } from '../rivals/showing'
import { afterOffseason, onBreakout, onNewSeason, onOffseasonStart, onRetired } from '../stories/hooks'

/** Offseason rating change: growth toward potential when young, peak plateau 27-29, decline with age, some variance. */
function progressPlayer(
  p: Player, rng: Rng, coachDev: number, minutes: number, devSlot = false, userSlot = false, coachF = 1,
): void {
  const o = ovr(p)
  const gap = Math.max(0, p.pot - o)
  let delta: number
  if (p.age <= 22) delta = gap * 0.21
  else if (p.age <= 25) delta = gap * 0.14
  else if (p.age <= 27) delta = gap * 0.11
  else if (p.age <= 29) delta = -0.25 + gap * 0.08
  else if (p.age === 30) delta = -0.85
  else if (p.age <= 32) delta = -1.6 - (p.age - 31) * 0.7
  else delta = -3.0 - (p.age - 33) * 1.0
  // Durable players sustain their primes longer and age more gracefully; fragile bodies wear down faster.
  if (p.age >= 30) delta += (p.ratings.overallDurability - 74) * 0.015
  if (p.age <= 25) delta += (coachDev - 60) / 40
  if (minutes >= 800 && p.age <= 26) delta += 0.25
  // Development focus: extra growth for the young, a softer slide for everyone; user slots can nudge +1 past ceiling.
  if (devSlot) delta += (p.age <= 26 ? 0.5 : p.age <= 29 ? 0.3 : 0.15) * coachF
  // Variance is tighter for young players and primes, so nobody craters out of nowhere before the age decline.
  delta += rng.normal(0, p.age <= 26 ? 1.5 : p.age <= 29 ? 1.3 : 2)
  if (p.age <= 26) delta = Math.max(delta, -1)
  else if (p.age <= 29) delta = Math.max(delta, -2.5)
  // Reaching the 90s and up comes slowly.
  if (delta > 0 && o >= 88) delta *= o >= 91 ? 0.35 : 0.6
  if (delta > 0) delta = Math.min(delta, gap + (userSlot ? 1 : 0))
  const target = Math.round(o + delta)
  const w = weightsForRatings(p.ratings, p.pos)
  const dir = Math.sign(target - o)
  const athDecay = new Set<keyof Ratings>(['speed', 'agility', 'vertical', 'stamina'])
  for (let i = 0; i < 180 && dir !== 0 && Math.sign(target - ovr(p)) === dir; i++) {
    const options = RATING_KEYS.filter((k) =>
      dir > 0 ? p.ratings[k] < Math.min(RATING_MAX, heightMaxFor(p.heightIn, k)) : p.ratings[k] > RATING_MIN,
    )
    if (!options.length) break
    // Older players lose athleticism first; young ones grow where their position & role need it.
    const k: keyof Ratings = rng.weighted(options, (key) => Math.max(0.2, w[key]) * (dir < 0 && p.age >= 31 && athDecay.has(key) ? 3 : 1))
    p.ratings[k] += dir
  }
  // Through 29 a dip leaves potential in place (a small one is still recoverable); 30+ the ceiling is today.
  if (p.age >= 30) p.pot = ovr(p)
  else if (p.age >= 27) p.pot = Math.max(ovr(p), Math.min(Math.max(p.pot, o - 1), ovr(p) + 30 - p.age))
  else p.pot = Math.max(ovr(p), Math.min(99, Math.round(p.pot + rng.normal(-0.5, 1.5))))
}

/**
 * Season-ending injuries (torn ACL, ruptured Achilles) heal over the summer, but not always cleanly:
 * some players come all the way back, some lose a step, and a few lose the star athleticism for good.
 * Everyone else's injury just heals.
 */
function recoverFromInjury(p: Player, rng: Rng): void {
  const inj = p.injury
  p.injury = null
  if (!inj || inj.severity !== 'season') return
  const achilles = inj.type.includes('Achilles')
  const r = rng.next()
  const full = achilles ? 0.35 : 0.5
  const partial = achilles ? 0.4 : 0.35
  const old = p.age >= 31 ? 0.15 : 0 // older players are less likely to come all the way back
  if (r < full - old) return
  const major = r >= full + partial - old
  const before = ovr(p)
  const lose = (k: keyof Ratings, n: number) => { p.ratings[k] = Math.max(RATING_MIN, p.ratings[k] - n) }
  lose('speed', major ? rng.int(8, 14) : rng.int(3, 6))
  lose('agility', major ? rng.int(8, 14) : rng.int(3, 7))
  lose('vertical', major ? rng.int(7, 13) : rng.int(2, 6))
  lose('stamina', major ? rng.int(4, 8) : rng.int(1, 3))
  lose('overallDurability', major ? rng.int(6, 11) : rng.int(2, 5))
  if (major) { lose('ballHandle', rng.int(1, 4)); lose('perimeterDefense', rng.int(1, 4)) }
  const drop = before - ovr(p)
  // The ceiling comes down with the athleticism, but only part of the way for the young.
  p.pot = Math.max(ovr(p), p.pot - Math.ceil(drop * (p.age <= 25 ? 0.5 : 1)))
}

function retireChance(p: Player): number {
  if (p.age >= 42) return 1
  if (p.age < 31) return p.teamId ? 0 : ovr(p) < 60 ? 0.08 : 0
  let c = ((p.age - 30) / 11) ** 1.6 - (ovr(p) - 70) * 0.012
  if (!p.teamId) c += 0.2
  return Math.max(0, Math.min(1, c))
}

function seasonMinutes(l: League): Record<string, number> {
  const m: Record<string, number> = {}
  for (const s of Object.values(l.statLines)) if (s.season === l.season) m[s.playerId] = (m[s.playerId] ?? 0) + s.min
  return m
}

/** End-of-season mood: winning helps, sitting behind worse players hurts. */
function updateMorale(l: League): void {
  const st = computeStandings(l, l.season)
  const pct = Object.fromEntries([...st.East, ...st.West].map((r) => [r.teamId, r.pct]))
  const mins = seasonMinutes(l)
  for (const t of Object.values(l.teams)) {
    const roster = teamPlayers(l, t.id).sort((a, b) => ovr(b) - ovr(a))
    roster.forEach((p, rank) => {
      const games = l.games.filter((g) => g.result && !g.playoff && (g.homeId === t.id || g.awayId === t.id)).length || 1
      const mpg = (mins[p.id] ?? 0) / games
      const expected = Math.max(4, 34 - rank * 2.6)
      const next = p.morale + ((pct[t.id] ?? 0.5) - 0.5) * 30 + Math.max(-12, Math.min(8, (mpg - expected) / 2))
      p.morale = Math.round(Math.max(0, Math.min(100, 60 + (next - 60) * 0.7)))
    })
  }
}

/** CPU teams fire coaches who trail their roster's expectations badly; hire the best developer available. */
function coachingCarousel(l: League, rng: Rng, report: OffseasonReport): void {
  for (const c of Object.values(l.coaches)) c.age++
  for (let i = 0; i < 4; i++) {
    const c = generateCoach(rng)
    l.coaches[c.id] = c
  }
  const st = computeStandings(l, l.season)
  const pct = Object.fromEntries([...st.East, ...st.West].map((r) => [r.teamId, r.pct]))
  const order = strengthOrder(l)
  for (const t of Object.values(l.teams)) {
    if (t.id === l.userTeamId) continue
    const expected = 0.72 - (0.44 * order.indexOf(t.id)) / 29
    const coach = l.coaches[t.coachId]
    const retiring = coach.age >= 70
    if (!retiring && (pct[t.id] ?? 0.5) >= expected - 0.15) continue
    coach.teamId = null
    const pool = Object.values(l.coaches).filter((c) => !c.teamId && c.id !== coach.id && c.age < 68)
    const hire = pool.reduce((a, b) => (b.dev > a.dev ? b : a))
    hire.teamId = t.id
    t.coachId = hire.id
    report.coaching.push({ teamId: t.id, firedId: retiring ? null : coach.id, hiredId: hire.id })
    log(l, retiring ? 'hire' : 'fire', [t.id], [], retiring
      ? `${tname(l, t.id)} coach ${coach.firstName} ${coach.lastName} retired; ${hire.firstName} ${hire.lastName} takes over.`
      : `${tname(l, t.id)} fired coach ${coach.firstName} ${coach.lastName} and hired ${hire.firstName} ${hire.lastName}.`)
  }
}

/** Runs once when the Finals end: mood, progression, retirements, coaches, waivers and the draft lottery. */
export function startOffseason(l: League, rng: Rng): void {
  const report: OffseasonReport = { retired: [], changes: [], coaching: [] }
  updateMorale(l)
  applyRivalBumps(l, rng)
  const mins = seasonMinutes(l)
  const aiDev = aiDevIds(l)
  for (const p of Object.values(l.players)) {
    if (p.retired) continue
    const from = ovr(p)
    const dev = p.teamId ? l.coaches[l.teams[p.teamId].coachId]?.dev ?? 60 : 50
    p.age++
    const userSlot = p.teamId === l.userTeamId && isTraining(l, p.id)
    const cpuSlot = aiDev.has(p.id)
    const devSlot = userSlot || cpuSlot
    const coachF = devSlot && p.teamId ? coachFactor(l, p.teamId) : 1
    // Summer is the big development window: a user-slot bloom lifts his ceiling before this year's growth is rolled.
    if (userSlot && rng.chance(breakoutChance(p, coachF, 4))) {
      const potFrom = p.pot
      p.pot = Math.min(99, p.pot + breakoutBump(p, rng))
      onBreakout(l, p, potFrom)
    }
    progressPlayer(p, rng, dev, mins[p.id] ?? 0, devSlot, userSlot, coachF)
    // CPU development slots can also raise their ceiling for next season.
    if (cpuSlot && rng.chance(breakoutChance(p, coachF, 4))) p.pot = Math.min(99, p.pot + breakoutBump(p, rng))
    recoverFromInjury(p, rng)
    const to = ovr(p)
    p.ratingHistory.push({ season: l.season + 1, ovr: to })
    if (p.teamId && (Math.abs(to - from) >= 4 || p.teamId === l.userTeamId) && to !== from)
      report.changes.push({ playerId: p.id, teamId: p.teamId, from, to })
  }
  for (const p of Object.values(l.players)) {
    if (p.retired || !rng.chance(retireChance(p))) continue
    report.retired.push({ playerId: p.id, teamId: p.teamId, age: p.age, ovr: ovr(p) })
    if (p.teamId) log(l, 'retire', [p.teamId], [p.id], `${pname(p)} (${tname(l, p.teamId)}) retired at ${p.age}.`)
    const teamId = p.teamId
    p.retired = true
    p.teamId = null
    p.contract = null
    p.injury = null
    if (teamId) refreshRotation(l, teamId)
  }
  onRetired(l, report.retired.map((r) => r.playerId))
  coachingCarousel(l, rng, report)
  processWaivers(l)
  l.faOffers = []
  pruneTraining(l)
  setupDraft(l, rng)
  l.offseason = { step: 'awards', faDay: 0, report, resignTries: {} }
  onOffseasonStart(l)
}

/** Moves the offseason forward one step. Each step finishes its own business first. */
export function advanceOffseason(l: League, rng: Rng): void {
  const os = l.offseason
  if (l.phase !== 'offseason' || !os) throw new GmError('The offseason has not started.')
  switch (os.step) {
    case 'awards':
      os.step = 'recap'
      return
    case 'recap':
      os.step = 'lottery'
      return
    case 'lottery':
      os.step = 'draft'
      draftUntilUser(l)
      return
    case 'draft':
      finishDraft(l)
      os.step = 'resign'
      return
    case 'resign':
      aiResign(l, rng)
      releaseExpired(l)
      addFreeAgentBatch(l, rng, 20)
      os.step = 'freeAgency'
      os.faDay = 1
      aiTrades(l, rng, 6)
      return
    case 'freeAgency':
      simFreeAgency(l, rng, FA_DAYS)
      return
    case 'ready':
      startNewSeason(l, rng)
      return
  }
}

/** Plays out `days` free-agency days (stopping at the end of the period). */
export function simFreeAgency(l: League, rng: Rng, days: number): void {
  const os = l.offseason
  if (!os || os.step !== 'freeAgency') throw new GmError('Free agency is not open.')
  for (let i = 0; i < days && os.step === 'freeAgency'; i++) {
    const newsFrom = l.news.length, txFrom = l.transactions.length
    freeAgencyDay(l, rng)
    processWaivers(l)
    if (os.faDay % 7 === 0) aiTrades(l, rng, 3)
    os.faDay++
    if (os.faDay > FA_DAYS) {
      aiFillRosters(l)
      os.step = 'ready'
    }
    afterOffseason(l, newsFrom, txFrom, true)
  }
}

/** Why the user's team can't start the season yet (or null when it can). */
export function seasonStartProblem(l: League): string | null {
  const n = committed(l, l.userTeamId).length
  if (n < ROSTER_MIN) return `You need at least ${ROSTER_MIN} players under contract (you have ${n}). Sign free agents or claim someone off waivers.`
  if (n > ROSTER_MAX) return `You can carry at most ${ROSTER_MAX} players (you have ${n}). Release or trade someone.`
  if (payroll(l, l.userTeamId) > SALARY_CAP) return `Your payroll (${money(payroll(l, l.userTeamId))}) is over the ${money(SALARY_CAP)} cap.`
  return null
}

export function startNewSeason(l: League, rng: Rng): void {
  const problem = seasonStartProblem(l)
  if (problem) throw new GmError(problem)
  processWaivers(l)
  for (const pid of Object.keys(l.draftRights)) delete l.draftRights[pid]
  // Unsigned veterans who sat through free agency may call it a career.
  const unsigned = Object.values(l.players)
    .filter((p) => !p.teamId && !p.retired && !l.draft?.prospects.includes(p.id))
    .sort((a, b) => ovr(b) - ovr(a))
  const played = new Set(Object.values(l.statLines).map((s) => s.playerId))
  const quit: string[] = []
  unsigned.forEach((p, i) => {
    // Beyond the best ~60 the pool thins out hard; old or fringe players are likeliest to quit.
    const c = i >= 60 ? 0.85 : p.age >= 31 || ovr(p) < 60 ? 0.4 : 0.05
    if (!rng.chance(c)) return
    // Someone who never played a league game leaves no history worth keeping.
    if (!played.has(p.id)) delete l.players[p.id]
    else {
      p.retired = true
      quit.push(p.id)
    }
  })
  onRetired(l, quit)
  l.season++
  l.phase = 'regular'
  l.day = 1
  l.playoffs = null
  l.offseason = null
  l.draft = null
  l.faOffers = []
  aiTrimRosters(l)
  aiFillRosters(l)
  // Keep full box scores for this season and last; older seasons keep their stat lines and results only.
  for (const g of l.games) if (g.result && g.season < l.season - 1 && g.result.box.length) g.result.box = []
  const teams = Object.values(l.teams)
  const games = generateSchedule(teams, l.season, rng)
  l.games.push(...games)
  l.tradeDeadlineDay = tradeDeadline(games, teams)
  l.allStarDay = allStarDayFor(games, l.season)
  l.deadMoney = l.deadMoney.filter((d) => d.expires >= l.season)
  for (const t of teams) refreshRotation(l, t.id)
  onNewSeason(l)
}

/** The user swaps coaches (offseason only): the old one returns to the pool. */
export function hireCoach(l: League, coachId: string): void {
  if (l.phase !== 'offseason') throw new GmError('Coaching changes happen in the offseason.')
  const c = l.coaches[coachId]
  if (!c || c.teamId) throw new GmError('That coach is not available.')
  const team = l.teams[l.userTeamId]
  const old = l.coaches[team.coachId]
  if (old) old.teamId = null
  c.teamId = team.id
  team.coachId = c.id
  log(l, 'hire', [team.id], [], `${team.name} hired coach ${c.firstName} ${c.lastName}${old ? `, replacing ${old.firstName} ${old.lastName}` : ''}.`)
}
