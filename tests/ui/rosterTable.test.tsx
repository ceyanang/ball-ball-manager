import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { RosterTable } from '../../src/ui/components/RosterTable'
import { rosterOf } from '../../src/ui/util'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const team = league.teams[league.userTeamId]
const html = renderToStaticMarkup(
  <MemoryRouter><RosterTable league={league} team={team} players={rosterOf(league, team.id)} /></MemoryRouter>,
)

describe('RosterTable', () => {
  it('shows the full stat line headers', () => {
    const heads = [...html.matchAll(/<button class="th-btn">([^<]*)</g)].map((m) => m[1])
    for (const h of ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF', 'FG%', '3P%', 'FT%', '+/-', 'Salary', 'Through']) expect(heads).toContain(h)
  })
  it('groups into Starters and Bench with five starters', () => {
    const s = html.indexOf('Starters')
    const b = html.indexOf('Bench')
    expect(s).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(s)
    expect(html.slice(s, b).match(/<tr>/g)).toHaveLength(5)
  })
  it('offers a per-game / totals toggle', () => {
    expect(html).toContain('Per game')
    expect(html).toContain('Totals')
  })
  it('has the position, search and range filters', () => {
    expect(html).toContain('aria-label="Position"')
    expect(html).toContain('type="search"')
    expect(html).toContain('aria-label="Stat to filter"')
  })
  it('links player names to their page by default', () => {
    expect(html).toContain('href="/player/')
  })
})
