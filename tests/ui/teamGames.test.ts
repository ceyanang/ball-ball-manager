import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import type { Game } from '../../src/engine/types'
import { recentResults, teamGames } from '../../src/ui/util'

const result = { homeScore: 100, awayScore: 90 } as Game['result']

describe('teamGames / recentResults', () => {
  const league = createLeague({ seed: 11, userTeamIndex: 0, name: 'T' })
  const team = league.userTeamId
  const opp = Object.keys(league.teams).find((id) => id !== team)!
  const season = league.season
  // A late game from last season plus early played games this season.
  const old: Game = { id: 'old', season: season - 1, day: 150, homeId: team, awayId: opp, playoff: null, result }
  const early: Game[] = [1, 2, 3].map((d) => ({ id: `new${d}`, season, day: d, homeId: team, awayId: opp, playoff: null, result }))
  const l = { ...league, games: [old, ...early] }

  it('orders games by season before day', () => {
    expect(teamGames(l, team).map((g) => g.id)).toEqual(['old', 'new1', 'new2', 'new3'])
  })

  it("only shows this season's most recent results", () => {
    expect(recentResults(l, team, 5).map((g) => g.id)).toEqual(['new1', 'new2', 'new3'])
  })
})
