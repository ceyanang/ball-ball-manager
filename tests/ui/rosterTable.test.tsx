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
const allHtml = renderToStaticMarkup(
  <MemoryRouter><RosterTable league={league} team={team} players={rosterOf(league, team.id)} view="all" /></MemoryRouter>,
)

describe('RosterTable', () => {
  it('defaults to the clean MPG, PPG, RPG, APG overview with a dropdown for all stats', () => {
    const heads = [...html.matchAll(/<button class="th-btn">([^<]*)</g)].map((m) => m[1])
    for (const h of ['Player', 'OVR', 'MPG', 'PPG', 'RPG', 'APG']) expect(heads).toContain(h)
    expect(heads).not.toContain('STL')
    expect(html).toContain('All stats')
    expect(html).toContain('aria-label="Stat columns"')
  })
  it('shows the full stat line headers when switched to all stats', () => {
    const heads = [...allHtml.matchAll(/<button class="th-btn">([^<]*)</g)].map((m) => m[1])
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
