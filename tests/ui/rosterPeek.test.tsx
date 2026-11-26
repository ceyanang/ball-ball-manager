import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { teamFull } from '../../src/ui/util'

vi.mock('../../src/worker/client', () => ({ runSim: vi.fn(), runWatch: vi.fn() }))

const { RosterPeekView } = await import('../../src/ui/components/RosterPeek')

describe('RosterPeekView', () => {
  const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
  const render = (teamId: string) =>
    renderToStaticMarkup(<MemoryRouter><RosterPeekView league={league} open onClose={() => {}} teamId={teamId} /></MemoryRouter>)

  it('shows my team in a dialog titled with the team name, grouped into starters with clean key stats', () => {
    const team = league.teams[league.userTeamId]
    const html = render(team.id)
    expect(html).toContain('<dialog')
    expect(html).toContain(`aria-label="${teamFull(team)}"`)
    expect(html).toContain('Starters')
    expect(html).toContain('PPG')
    expect(html).toContain('All stats')
    expect(html).toContain('<details')
  })
  it('shows another team when given their id', () => {
    const other = Object.values(league.teams).find((t) => t.id !== league.userTeamId)!
    const html = render(other.id)
    expect(html).toContain(`aria-label="${teamFull(other)}"`)
    expect(html).toContain('Starters')
  })
  it('renders nothing for an unknown team instead of crashing', () => {
    expect(() => render('nope')).not.toThrow()
  })
  it('does not link players away, so a staged trade is never lost by tapping a name', () => {
    const html = render(league.userTeamId)
    expect(html).not.toContain('href="/player/')
    expect(html).toContain('pname')
  })
})
