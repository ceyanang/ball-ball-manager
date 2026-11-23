export type SortDir = 'asc' | 'desc'
export type SortState = { key: string; dir: SortDir } | null

/** Header click: a new column starts at its default direction, then flips, then turns sorting off. */
export function nextSort(cur: SortState, key: string, defaultDir: SortDir): SortState {
  if (!cur || cur.key !== key) return { key, dir: defaultDir }
  if (cur.dir === defaultDir) return { key, dir: defaultDir === 'asc' ? 'desc' : 'asc' }
  return null
}

/** Sorted copy. Nulls always go last (either direction); ties keep their input order. */
export function sortRows<T>(rows: readonly T[], value: (r: T) => number | string | null, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return rows
    .map((r, i) => ({ r, i, v: value(r) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1
      const c = typeof a.v === 'string' || typeof b.v === 'string'
        ? String(a.v).localeCompare(String(b.v), undefined, { sensitivity: 'base' })
        : a.v - b.v
      return c !== 0 ? c * sign : a.i - b.i
    })
    .map((x) => x.r)
}

export interface RowFilter<T> {
  /** A position, or 'All'/undefined for no position filter. */
  pos?: string
  /** Case-insensitive substring of the row's name. */
  q?: string
  /** Keep rows whose value is within [min, max]; rows with a null value never match. */
  range?: { value: (r: T) => number | null; min?: number; max?: number }
}

export function filterRows<T>(
  rows: readonly T[],
  f: RowFilter<T>,
  get: { pos?: (r: T) => string; name?: (r: T) => string } = {},
): T[] {
  const q = f.q?.trim().toLowerCase() ?? ''
  const { range } = f
  return rows.filter((r) => {
    if (f.pos && f.pos !== 'All' && get.pos && get.pos(r) !== f.pos) return false
    if (q && get.name && !get.name(r).toLowerCase().includes(q)) return false
    if (range && (range.min !== undefined || range.max !== undefined)) {
      const v = range.value(r)
      if (v === null) return false
      if (range.min !== undefined && v < range.min) return false
      if (range.max !== undefined && v > range.max) return false
    }
    return true
  })
}
