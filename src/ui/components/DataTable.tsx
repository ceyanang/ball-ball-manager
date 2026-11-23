import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { POSITIONS, type PosFilter } from '../playerFilter'
import type { StatCol } from '../rosterColumns'
import { filterRows, nextSort, sortRows, type SortState } from '../tableSort'

export interface Column<T> extends StatCol<T> {
  /** Custom cell content (avatars, pills, buttons); falls back to `text` then the value. */
  cell?: (r: T) => ReactNode
  /** Phone card layout (`cards`): which slot the cell takes — name on top, key number, or the action. Others get a data-label. */
  mobile?: 'main' | 'key' | 'act'
  /** False for action/display-only columns: the header is plain text and the column is left out of sorting. Default true. */
  sortable?: boolean
}

export interface DataGroup<T> {
  label: string
  rows: T[]
  /** Start collapsed; the group header toggles it. */
  collapsed?: boolean
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (r: T) => string
  /** Subsets of `rows` shown under headers while no sort or filter is active. */
  groups?: DataGroup<T>[]
  filters?: { pos?: (r: T) => string; name?: (r: T) => string; range?: boolean }
  defaultSort?: SortState
  /** Render as phone cards (the `m-cards` layout) and add a "Sort by" picker, since the header is hidden on phones. */
  cards?: boolean
  /** Tuck the filter bar behind a "Filters" toggle (saves phone screen space). Defaults to on for `cards` tables. */
  collapseFilters?: boolean
  /** Extra full-width row shown under a row (e.g. an inline offer form); null/undefined for none. */
  expanded?: (r: T) => ReactNode
  rowClass?: (r: T) => string | undefined
  emptyText?: string
  ariaLabel: string
}

const ariaSort = (s: SortState, key: string) => (s?.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none')
const toNum = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s))

export function DataTable<T>({ rows, columns, rowKey, groups, filters, defaultSort, cards, collapseFilters, expanded, rowClass, emptyText, ariaLabel }: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(defaultSort ?? null)
  const [pos, setPos] = useState<PosFilter>('All')
  const [q, setQ] = useState('')
  const numericCols = useMemo(() => columns.filter((c) => rows.some((r) => typeof c.value(r) === 'number')), [columns, rows])
  const [rangeKey, setRangeKey] = useState(() => (numericCols.find((c) => c.key === 'ovr') ?? numericCols[0])?.key ?? '')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const rangeCol = numericCols.find((c) => c.key === rangeKey)
  const range = filters?.range && rangeCol && (toNum(min) !== undefined || toNum(max) !== undefined)
    ? { value: (r: T) => (typeof rangeCol.value(r) === 'number' ? (rangeCol.value(r) as number) : null), min: toNum(min), max: toNum(max) }
    : undefined
  const filtering = pos !== 'All' || q.trim() !== '' || !!range
  const grouped = !!groups && !sort && !filtering

  const flat = useMemo(() => {
    if (grouped) return []
    const kept = filterRows(rows, { pos, q, range }, { pos: filters?.pos, name: filters?.name })
    const col = sort ? columns.find((c) => c.key === sort.key) : undefined
    return col && sort ? sortRows(kept, col.value, sort.dir) : kept
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, rows, pos, q, min, max, rangeKey, sort, columns])

  const renderRow = (r: T) => {
    const extra = expanded?.(r)
    return (
      <Fragment key={rowKey(r)}>
        <tr className={rowClass?.(r)}>
          {columns.map((c) => (
            <td
              key={c.key}
              className={[c.align === 'left' ? 'left' : '', c.mobile ? `m-${c.mobile}` : ''].filter(Boolean).join(' ') || undefined}
              data-label={cards && !c.mobile && c.label ? c.label : undefined}
            >{c.cell?.(r) ?? c.text?.(r) ?? c.value(r) ?? '—'}</td>
          ))}
        </tr>
        {extra ? <tr className="offer-row"><td colSpan={columns.length}>{extra}</td></tr> : null}
      </Fragment>
    )
  }
  const sortable = columns.filter((c) => c.sortable !== false)
  const reset = () => { setSort(null); setPos('All'); setQ(''); setMin(''); setMax('') }
  const empty = emptyText ?? 'No players match.'
  const collapse = collapseFilters ?? !!cards

  const wrapFilters = (bar: ReactNode) => (collapse
    ? <details className="dt-filter-details"><summary>🔍 Filters{filtering ? ' · on' : ''}</summary>{bar}</details>
    : bar)

  return (
    <div className="stack dt">
      {filters && wrapFilters(
        <div className="filters dt-filters">
          {filters.name && (
            <label className="field">Search
              <input type="search" placeholder="Name" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          {filters.pos && (
            <div className="seg" role="group" aria-label="Position">
              {(['All', ...POSITIONS] as PosFilter[]).map((x) => <button key={x} className="btn" aria-pressed={pos === x} onClick={() => setPos(x)}>{x}</button>)}
            </div>
          )}
          {filters.range && rangeCol && (
            <div className="dt-range" role="group" aria-label="Stat range">
              <select aria-label="Stat to filter" value={rangeKey} onChange={(e) => setRangeKey(e.target.value)}>
                {numericCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input type="number" inputMode="decimal" aria-label="Minimum" placeholder="min" value={min} onChange={(e) => setMin(e.target.value)} />
              <input type="number" inputMode="decimal" aria-label="Maximum" placeholder="max" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          )}
        </div>
      )}
      {cards && (
        <div className="dt-sortby">
          <label className="field">Sort by
            <select value={sort?.key ?? ''} onChange={(e) => {
              const col = sortable.find((c) => c.key === e.target.value)
              setSort(col ? { key: col.key, dir: col.defaultDir } : null)
            }}>
              <option value="">Default order</option>
              {sortable.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          {sort && <button className="btn" onClick={() => setSort({ key: sort.key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })} aria-label="Reverse sort order">{sort.dir === 'asc' ? '▲ Low to high' : '▼ High to low'}</button>}
        </div>
      )}
      {groups && !grouped && (
        <div className="chips">
          <button className="chip" onClick={reset}>↩ Back to {groups.map((g) => g.label).join('/')}</button>
        </div>
      )}
      <div className="table-wrap">
        <table className={`stats dt-table${cards ? ' m-cards' : ''}`} aria-label={ariaLabel}>
          <thead>
            <tr>
              {columns.map((c) => c.sortable === false
                ? <th key={c.key} className={c.align === 'left' ? 'left' : undefined} title={c.title}>{c.label}</th>
                : (
                  <th key={c.key} aria-sort={ariaSort(sort, c.key)} className={c.align === 'left' ? 'left' : undefined} title={c.title}>
                    <button className="th-btn" onClick={() => setSort((s) => nextSort(s, c.key, c.defaultDir))}>
                      {c.label}
                      <span className="th-arrow" aria-hidden="true">{sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {grouped
              ? groups!.map((g) => {
                  const shut = open[g.label] === undefined ? !!g.collapsed : !open[g.label]
                  return [
                    <tr key={`g:${g.label}`} className="group-row">
                      <th colSpan={columns.length} className="left">
                        <button className="th-btn" aria-expanded={!shut} onClick={() => setOpen((o) => ({ ...o, [g.label]: shut }))}>
                          {shut ? '▸' : '▾'} {g.label} <span className="count">{g.rows.length}</span>
                        </button>
                      </th>
                    </tr>,
                    ...(shut ? [] : g.rows.map(renderRow)),
                  ]
                })
              : flat.map(renderRow)}
          </tbody>
        </table>
        {(grouped ? !groups!.some((g) => g.rows.length) : flat.length === 0) && <p className="muted dt-empty">{empty}</p>}
      </div>
    </div>
  )
}
