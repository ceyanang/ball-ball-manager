import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { QuarterBreak, type RecapRow } from '../../src/ui/watch/QuarterBreak'
import type { LiveLine } from '../../src/ui/watch/replay'

const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'G' })
const team = Object.values(league.teams)[0]
const line: LiveLine = {
  pts: 9, reb: 3, oreb: 1, dreb: 2, ast: 2, stl: 0, blk: 0, tov: 1,
  fgm: 3, fga: 6, tpm: 1, tpa: 2, ftm: 2, fta: 3, byPeriod: [9], min: 12, pm: 4,
}
const rows: RecapRow[] = [{ key: 'a', name: 'Smith', playerId: 'p1', team, fav: false, line }]
const html = renderToStaticMarkup(
  <QuarterBreak title="End of Q1" scoreText="A 10 – 8 B" leader="A by 2" standout={null} rows={rows} button="Next" onButton={() => {}} onPick={() => {}} />,
)

describe('QuarterBreak table', () => {
  it('has headers PTS REB AST FG 3P FT in order', () => {
    const heads = [...html.matchAll(/role="columnheader">([^<]*)</g)].map((m) => m[1]).filter(Boolean)
    expect(heads).toEqual(['PTS', 'REB', 'AST', 'FG', '3P', 'FT'])
  })
  it('shows free throws made/attempted', () => {
    expect(html).toContain('<span role="cell">2/3</span>')
  })
})
