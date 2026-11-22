import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { generatePlayer } from '../../src/engine/player/generate'
import { Rng } from '../../src/engine/rng'
import { simGame } from '../../src/engine/sim/game'
import { autoRotation } from '../../src/engine/sim/rotation'
import type { GameResult, League, Player, Position, Team } from '../../src/engine/types'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const teams = Object.values(league.teams)

function sample(n: number, seed = 1): { res: GameResult; home: Team; away: Team }[] {
  const rng = Rng.fromSeed(seed)
  const out = []
  for (let i = 0; i < n; i++) {
    const home = rng.pick(teams)
    let away = rng.pick(teams)
    while (away.id === home.id) away = rng.pick(teams)
    out.push({ res: simGame(home, away, league.players, league.coaches, rng), home, away })
  }
  return out
}
const games = sample(600)

const POS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SF', 'PF', 'SG']
function cloneTeam(target: number, id: string, seed: number, base: Team): { team: Team; players: Record<string, Player> } {
  const rng = Rng.fromSeed(seed)
  const players: Record<string, Player> = {}
  POS.forEach((pos, i) => {
    const p = generatePlayer(rng, { season: 1, targetOvr: target, pos, age: 27 })
    p.id = `${id}_${i}`
    p.teamId = id
    players[p.id] = p
  })
  return { team: { ...base, id, rotation: autoRotation(Object.values(players)) }, players }
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('simGame box integrity', () => {
  it('team points, minutes, shooting splits and plus-minus add up', () => {
    for (const { res, home, away } of games) {
      for (const [t, score, opp] of [[home, res.homeScore, res.awayScore], [away, res.awayScore, res.homeScore]] as const) {
        const box = res.box.filter((b) => b.teamId === t.id)
        expect(sum(box.map((b) => b.pts))).toBe(score)
        expect(Math.round(sum(box.map((b) => b.min)) * 10)).toBe((240 + 25 * res.ot) * 10)
        expect(sum(box.map((b) => b.pm))).toBe((score - opp) * 5)
        expect(box.filter((b) => b.gs)).toHaveLength(5)
        for (const b of box) {
          expect(b.fgm).toBeLessThanOrEqual(b.fga)
          expect(b.tpm).toBeLessThanOrEqual(b.tpa)
          expect(b.tpa).toBeLessThanOrEqual(b.fga)
          expect(b.ftm).toBeLessThanOrEqual(b.fta)
          expect(b.pts).toBe(2 * (b.fgm - b.tpm) + 3 * b.tpm + b.ftm)
          expect(Math.round(b.min * 10)).toBe(b.min * 10)
        }
        expect(box.length).toBeLessThanOrEqual(12)
      }
      expect(sum(res.quarters.home)).toBe(res.homeScore)
      expect(sum(res.quarters.away)).toBe(res.awayScore)
      expect(res.quarters.home).toHaveLength(4 + res.ot)
      expect(res.box.some((b) => b.playerId === res.potg)).toBe(true)
    }
  })
  it('never ends tied', () => {
    for (const { res } of games) expect(res.homeScore).not.toBe(res.awayScore)
  })
  it('goes to OT at least 1% of the time', () => {
    expect(games.filter((g) => g.res.ot > 0).length / games.length).toBeGreaterThanOrEqual(0.01)
  })
  it('handles multiple overtimes', () => {
    const a = cloneTeam(65, 't_a', 3, teams[0])
    const b = cloneTeam(65, 't_b', 3, teams[1])
    const players = { ...a.players, ...b.players }
    const rng = Rng.fromSeed(9)
    let res: GameResult | null = null
    for (let i = 0; i < 4000; i++) {
      const r = simGame(a.team, b.team, players, league.coaches, rng)
      if (r.ot >= 2) { res = r; break }
    }
    expect(res).not.toBeNull()
    for (const id of ['t_a', 't_b']) {
      const box = res!.box.filter((x) => x.teamId === id)
      expect(Math.round(sum(box.map((x) => x.min)) * 10)).toBe((240 + 25 * res!.ot) * 10)
      for (const x of box) expect(x.min).toBeLessThanOrEqual(48 + 5 * res!.ot)
    }
  })
})

describe('simGame realism', () => {
  const lines = games.flatMap((g) => g.res.box)
  const t = (k: 'fgm' | 'fga' | 'tpm' | 'tpa' | 'ftm' | 'fta' | 'ast' | 'tov' | 'oreb' | 'dreb') => sum(lines.map((b) => b[k]))
  const scores = games.flatMap((g) => [g.res.homeScore, g.res.awayScore])
  it('team scores average 105–115 with 95% in 85–140', () => {
    const mean = sum(scores) / scores.length
    expect(mean).toBeGreaterThanOrEqual(105)
    expect(mean).toBeLessThanOrEqual(115)
    expect(scores.filter((s) => s >= 85 && s <= 140).length / scores.length).toBeGreaterThanOrEqual(0.95)
  })
  it('shooting looks like basketball', () => {
    const fg = t('fgm') / t('fga'), tpRate = t('tpa') / t('fga'), tp = t('tpm') / t('tpa'), ft = t('ftm') / t('fta')
    const ftRate = t('fta') / t('fga'), astRate = t('ast') / t('fgm')
    expect(fg).toBeGreaterThanOrEqual(0.44); expect(fg).toBeLessThanOrEqual(0.49)
    expect(tpRate).toBeGreaterThanOrEqual(0.33); expect(tpRate).toBeLessThanOrEqual(0.45)
    expect(tp).toBeGreaterThanOrEqual(0.34); expect(tp).toBeLessThanOrEqual(0.38)
    expect(ft).toBeGreaterThanOrEqual(0.74); expect(ft).toBeLessThanOrEqual(0.8)
    expect(ftRate).toBeGreaterThanOrEqual(0.2); expect(ftRate).toBeLessThanOrEqual(0.3)
    expect(astRate).toBeGreaterThanOrEqual(0.55); expect(astRate).toBeLessThanOrEqual(0.68)
  })
  it('turnovers and offensive rebounds are in range', () => {
    const tovPerTeam = t('tov') / (games.length * 2)
    expect(tovPerTeam).toBeGreaterThanOrEqual(11); expect(tovPerTeam).toBeLessThanOrEqual(16)
    const orebShare = t('oreb') / (t('oreb') + t('dreb'))
    expect(orebShare).toBeGreaterThanOrEqual(0.2); expect(orebShare).toBeLessThanOrEqual(0.28)
  })
})

describe('simGame behaviour', () => {
  it('talent matters: OVR-80 clones beat OVR-55 clones >= 90%', () => {
    const good = cloneTeam(80, 't_good', 1, teams[0])
    const bad = cloneTeam(55, 't_bad', 2, teams[1])
    const players = { ...good.players, ...bad.players }
    const rng = Rng.fromSeed(4)
    let wins = 0
    for (let i = 0; i < 200; i++) {
      const home = i % 2 === 0
      const r = simGame(home ? good.team : bad.team, home ? bad.team : good.team, players, league.coaches, rng)
      if ((home && r.homeScore > r.awayScore) || (!home && r.awayScore > r.homeScore)) wins++
    }
    expect(wins / 200).toBeGreaterThanOrEqual(0.9)
  })
  it('home court is a small edge: 52–60% on equal teams', () => {
    const a = cloneTeam(68, 't_a', 7, teams[0])
    const b = cloneTeam(68, 't_b', 7, { ...teams[1], coachId: teams[0].coachId })
    const players = { ...a.players, ...b.players }
    const rng = Rng.fromSeed(5)
    let home = 0
    const n = 3000
    for (let i = 0; i < n; i++) {
      const flip = i % 2 === 0
      const r = simGame(flip ? a.team : b.team, flip ? b.team : a.team, players, league.coaches, rng)
      if (r.homeScore > r.awayScore) home++
    }
    expect(home / n).toBeGreaterThanOrEqual(0.52)
    expect(home / n).toBeLessThanOrEqual(0.6)
  })
  it('is deterministic for a seed', () => {
    const r1 = simGame(teams[0], teams[1], league.players, league.coaches, Rng.fromSeed(42))
    const r2 = simGame(teams[0], teams[1], league.players, league.coaches, Rng.fromSeed(42))
    expect(r1).toEqual(r2)
  })
  it('does not mutate its inputs', () => {
    const snap = JSON.stringify(league)
    simGame(teams[2], teams[3], league.players, league.coaches, Rng.fromSeed(3))
    expect(JSON.stringify(league)).toBe(snap)
  })
})

export type { League }
