import { describe, expect, it } from 'vitest'
import { filterRows, nextSort, sortRows } from '../../src/ui/tableSort'

describe('nextSort', () => {
  it('cycles default direction → opposite → off', () => {
    const a = nextSort(null, 'pts', 'desc')
    expect(a).toEqual({ key: 'pts', dir: 'desc' })
    const b = nextSort(a, 'pts', 'desc')
    expect(b).toEqual({ key: 'pts', dir: 'asc' })
    expect(nextSort(b, 'pts', 'desc')).toBeNull()
  })
  it('restarts at the default direction when a different column is clicked', () => {
    expect(nextSort({ key: 'pts', dir: 'asc' }, 'name', 'asc')).toEqual({ key: 'name', dir: 'asc' })
    expect(nextSort({ key: 'name', dir: 'desc' }, 'pts', 'desc')).toEqual({ key: 'pts', dir: 'desc' })
  })
  it('cycles an ascending-default column asc → desc → off', () => {
    const a = nextSort(null, 'name', 'asc')
    const b = nextSort(a, 'name', 'asc')
    expect(b).toEqual({ key: 'name', dir: 'desc' })
    expect(nextSort(b, 'name', 'asc')).toBeNull()
  })
})

describe('sortRows', () => {
  const rows = [{ v: 2 as number | null }, { v: null }, { v: 1 }]
  it('puts nulls last ascending', () => expect(sortRows(rows, (r) => r.v, 'asc').map((r) => r.v)).toEqual([1, 2, null]))
  it('puts nulls last descending', () => expect(sortRows(rows, (r) => r.v, 'desc').map((r) => r.v)).toEqual([2, 1, null]))
  it('keeps input order for equal values in both directions', () => {
    const tied = [{ id: 'a', v: 5 }, { id: 'b', v: 5 }, { id: 'c', v: 5 }]
    expect(sortRows(tied, (r) => r.v, 'asc').map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(sortRows(tied, (r) => r.v, 'desc').map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
  it('sorts strings case-insensitively', () => {
    const names = [{ n: 'b' }, { n: 'A' }, { n: 'a2' }]
    expect(sortRows(names, (r) => r.n, 'asc').map((r) => r.n)).toEqual(['A', 'a2', 'b'])
  })
  it('does not mutate its input', () => {
    const input = [{ v: 2 }, { v: 1 }]
    sortRows(input, (r) => r.v, 'asc')
    expect(input.map((r) => r.v)).toEqual([2, 1])
  })
})

describe('filterRows', () => {
  const rows = [
    { name: 'Joe Smith', pos: 'PG', fg: 45 as number | null },
    { name: 'Amy Jones', pos: 'C', fg: 44.9 },
    { name: 'Rookie Nobody', pos: 'C', fg: null },
  ]
  const get = { pos: (r: (typeof rows)[number]) => r.pos, name: (r: (typeof rows)[number]) => r.name }
  it('range min drops null and values below it but keeps the boundary', () => {
    const out = filterRows(rows, { range: { value: (r) => r.fg, min: 45 } }, get)
    expect(out.map((r) => r.name)).toEqual(['Joe Smith'])
  })
  it('range max keeps values at or under it and still drops null', () => {
    const out = filterRows(rows, { range: { value: (r) => r.fg, max: 45 } }, get)
    expect(out.map((r) => r.name)).toEqual(['Joe Smith', 'Amy Jones'])
  })
  it('matches the name search case-insensitively', () => {
    expect(filterRows(rows, { q: 'SMI' }, get).map((r) => r.name)).toEqual(['Joe Smith'])
  })
  it('treats pos "All" and undefined as no filter', () => {
    expect(filterRows(rows, { pos: 'All' }, get)).toHaveLength(3)
    expect(filterRows(rows, {}, get)).toHaveLength(3)
  })
  it('filters by position', () => {
    expect(filterRows(rows, { pos: 'C' }, get).map((r) => r.name)).toEqual(['Amy Jones', 'Rookie Nobody'])
  })
  it('returns [] when nothing matches', () => {
    expect(filterRows(rows, { q: 'zzz' }, get)).toEqual([])
  })
})
