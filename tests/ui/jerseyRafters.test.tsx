import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { JerseyRafters, retiredByLines } from '../../src/ui/components/JerseyRafters'

describe('JerseyRafters', () => {
  const league = createLeague({ seed: 3, userTeamIndex: 0, name: 'J' })
  const [a, b] = Object.keys(league.teams)
  const p = Object.values(league.players).find((q) => q.teamId === a)!
  league.retiredJerseys.push({ teamId: a, playerId: p.id, number: 23, season: 5, seasons: 9, titles: 2, score: 50, door: 'star' })
  const render = (teamId: string) => renderToStaticMarkup(<MemoryRouter><JerseyRafters league={league} teamId={teamId} /></MemoryRouter>)

  it('shows the number, player, seasons and titles for the team', () => {
    const html = render(a)
    expect(html).toContain('>23<')
    expect(html).toContain(p.lastName)
    expect(html).toContain('9 seasons · 2 titles')
    expect(html).toContain(`/player/${p.id}`)
  })
  it('says so when a team has retired nobody', () => {
    expect(render(b)).toContain('retired a number yet')
  })
  it('lists what a player was honored with for his page', () => {
    expect(retiredByLines(league, p.id)).toHaveLength(1)
    expect(retiredByLines(league, p.id)[0]).toContain('#23 retired by')
    expect(retiredByLines(league, 'nobody')).toEqual([])
  })
})
