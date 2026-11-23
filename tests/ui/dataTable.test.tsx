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

  describe('phone card layout', () => {
    const cols: Column<Row>[] = [
      { key: 'name', label: 'Player', align: 'left', defaultDir: 'asc', value: (r) => r.name, mobile: 'main' },
      { key: 'pts', label: 'PTS', defaultDir: 'desc', value: (r) => r.pts },
      { key: 'act', label: '', defaultDir: 'asc', value: () => null, sortable: false, mobile: 'act', cell: () => <button>Go</button> },
    ]
    it('adds m-cards, mobile classes and data-labels', () => {
      const html = render({ columns: cols, cards: true })
      expect(html).toContain('m-cards')
      expect(html).toContain('class="left m-main"')
      expect(html).toContain('class="m-act"')
      expect(html).toContain('data-label="PTS"')
      expect(html).not.toContain('data-label="Player"')
    })
    it('offers a Sort by select of the sortable columns (phones hide the header)', () => {
      const html = render({ columns: cols, cards: true })
      expect(html).toContain('Sort by')
      expect(html).toMatch(/<option[^>]*value="pts"[^>]*>PTS<\/option>/)
      expect(html).not.toMatch(/<option[^>]*value="act"/)
    })
    it('has no Sort by select without cards', () => {
      expect(render({ columns: cols })).not.toContain('Sort by')
    })
  })

  it('leaves non-sortable columns out of sorting', () => {
    const cols: Column<Row>[] = [
      { key: 'name', label: 'Player', defaultDir: 'asc', value: (r) => r.name },
      { key: 'act', label: 'Do', defaultDir: 'asc', value: () => null, sortable: false },
    ]
    const html = render({ columns: cols })
    expect(html.match(/aria-sort=/g)).toHaveLength(1)
  })
  it('renders an expanded row under the row that asks for one', () => {
    const html = render({ expanded: (r) => (r.id === 'b' ? <span>OFFER-FORM</span> : null) })
    expect(html.match(/OFFER-FORM/g)).toHaveLength(1)
    expect(html).toContain('class="offer-row"')
    expect(html.indexOf('OFFER-FORM')).toBeGreaterThan(html.indexOf('Bravo'))
    expect(html.indexOf('OFFER-FORM')).toBeLessThan(html.indexOf('Charlie'))
  })

  describe('collapsible filters', () => {
    const filters = { pos: (r: Row) => r.pos, name: (r: Row) => r.name, range: true }
    it('keeps filters open by default for plain tables', () => {
      expect(render({ filters })).not.toContain('<details')
    })
    it('tucks filters into a details toggle when collapseFilters is set', () => {
      const html = render({ filters, collapseFilters: true })
      expect(html).toContain('<details')
      expect(html).toContain('Filters')
      expect(html.indexOf('type="search"')).toBeGreaterThan(html.indexOf('<details'))
    })
    it('collapses filters by default for card tables', () => {
      expect(render({ filters, cards: true })).toContain('<details')
      expect(render({ filters, cards: true, collapseFilters: false })).not.toContain('<details')
    })
  })
  it('leaves a custom cell blank when it returns null instead of showing a dash', () => {
    const cols: Column<Row>[] = [
      { key: 'name', label: 'Player', defaultDir: 'asc', value: (r) => r.name },
      { key: 'act', label: '', defaultDir: 'asc', sortable: false, value: () => null, cell: () => null },
    ]
    const html = render({ columns: cols })
    expect(html).not.toContain('—')
  })
})
