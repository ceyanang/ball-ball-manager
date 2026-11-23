import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DataTable, type Column } from '../../src/ui/components/DataTable'

interface Row { id: string; name: string; pos: string; pts: number | null }
const a: Row = { id: 'a', name: 'Alpha', pos: 'PG', pts: 10 }
const b: Row = { id: 'b', name: 'Bravo', pos: 'C', pts: 30 }
const c: Row = { id: 'c', name: 'Charlie', pos: 'SF', pts: null }
const rows = [a, b, c]
const columns: Column<Row>[] = [
  { key: 'name', label: 'Player', align: 'left', defaultDir: 'asc', value: (r) => r.name },
  { key: 'pts', label: 'PTS', defaultDir: 'desc', value: (r) => r.pts, text: (r) => (r.pts === null ? '—' : r.pts.toFixed(1)) },
]
const base = { rows, columns, rowKey: (r: Row) => r.id, ariaLabel: 'Test table' }
const render = (props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) => renderToStaticMarkup(<DataTable<Row> {...base} {...props} />)
const order = (html: string) => ['Alpha', 'Bravo', 'Charlie'].map((n) => [n, html.indexOf(n)] as const).filter(([, i]) => i >= 0).sort((x, y) => x[1] - y[1]).map(([n]) => n)

describe('DataTable', () => {
  it('starts unsorted with aria-sort="none" on sortable headers', () => {
    const html = render()
    expect(html.match(/aria-sort="none"/g)).toHaveLength(2)
    expect(order(html)).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
  it('applies defaultSort descending and marks the header', () => {
    const html = render({ defaultSort: { key: 'pts', dir: 'desc' } })
    expect(order(html)).toEqual(['Bravo', 'Alpha', 'Charlie'])
    expect(html).toContain('aria-sort="descending"')
  })
  it('renders no-data cells as — and sorts them last ascending and descending', () => {
    const asc = render({ defaultSort: { key: 'pts', dir: 'asc' } })
    const desc = render({ defaultSort: { key: 'pts', dir: 'desc' } })
    expect(order(asc)).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(order(desc)).toEqual(['Bravo', 'Alpha', 'Charlie'])
    expect(asc).toContain('—')
  })
  it('shows group labels when grouped and unsorted', () => {
    const html = render({ groups: [{ label: 'Starters', rows: [a] }, { label: 'Bench', rows: [b, c] }] })
    expect(html).toContain('Starters')
    expect(html).toContain('Bench')
    expect(html).not.toContain('Back to')
  })
  it('flattens when sorted and offers a way back to the groups', () => {
    const html = render({ groups: [{ label: 'Starters', rows: [a] }, { label: 'Bench', rows: [b, c] }], defaultSort: { key: 'pts', dir: 'desc' } })
    expect(html).not.toContain('class="group-row"')
    expect(html).toContain('Back to Starters/Bench')
    expect(order(html)).toEqual(['Bravo', 'Alpha', 'Charlie'])
  })
  it('hides the rows of a collapsed group but keeps its label', () => {
    const html = render({ groups: [{ label: 'Bench', rows: [a] }, { label: 'Inactive', rows: [b], collapsed: true }] })
    expect(html).toContain('Inactive')
    expect(html).toContain('Alpha')
    expect(html).not.toContain('Bravo')
  })
  it('shows the empty text when there are no rows', () => {
    expect(render({ rows: [] })).toContain('No players match.')
    expect(render({ rows: [], emptyText: 'Nobody here.' })).toContain('Nobody here.')
  })
  it('renders filter controls only when asked for', () => {
    expect(render()).not.toContain('type="search"')
    const html = render({ filters: { pos: (r) => r.pos, name: (r) => r.name, range: true } })
    expect(html).toContain('type="search"')
    expect(html).toContain('aria-label="Position"')
    expect(html).toContain('type="number"')
  })
})
