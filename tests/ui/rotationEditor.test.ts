import { describe, expect, it } from 'vitest'
import { dropInRotation, moveInRotation } from '../../src/ui/rotationEdit'
import type { Rotation } from '../../src/engine/types'

const rot: Rotation = {
  starters: ['s1', 's2', 's3', 's4', 's5'],
  bench: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'],
  inactive: ['i1', 'i2'],
}
const all = (r: Rotation) => [...r.starters, ...r.bench, ...r.inactive].sort()

describe('moveInRotation', () => {
  it('moving a starter to the bench swaps in the bench player at that index', () => {
    const r = moveInRotation(rot, 's2', { section: 'bench', index: 0 })
    expect(r.starters).toEqual(['s1', 'b1', 's3', 's4', 's5'])
    expect(r.bench[0]).toBe('s2')
    expect(all(r)).toEqual(all(rot))
  })
  it('moving a bench player into the starters swaps the starter out to his slot', () => {
    const r = moveInRotation(rot, 'b3', { section: 'starters', index: 4 })
    expect(r.starters[4]).toBe('b3')
    expect(r.bench[2]).toBe('s5')
    expect(all(r)).toEqual(all(rot))
  })
  it('moving to inactive with a full bench leaves fewer active players', () => {
    const r = moveInRotation(rot, 'b7', { section: 'inactive', index: 0 })
    expect(r.inactive[0]).toBe('b7')
    expect(r.bench).toHaveLength(6)
    expect(all(r)).toEqual(all(rot))
  })
  it('moving an inactive player onto a full bench pushes nobody out but the result is flagged by validation later', () => {
    const r = moveInRotation(rot, 'i1', { section: 'bench', index: 7 })
    expect(r.bench[7]).toBe('i1')
    expect(all(r)).toEqual(all(rot))
  })
  it('reorders within a section', () => {
    const r = moveInRotation(rot, 'b1', { section: 'bench', index: 3 })
    expect(r.bench.slice(0, 4)).toEqual(['b2', 'b3', 'b4', 'b1'])
    expect(all(r)).toEqual(all(rot))
  })
  it('moving an inactive player into starters sends the starter to inactive', () => {
    const r = moveInRotation(rot, 'i2', { section: 'starters', index: 0 })
    expect(r.starters[0]).toBe('i2')
    expect(r.inactive).toContain('s1')
    expect(all(r)).toEqual(all(rot))
  })
})

describe('dropInRotation', () => {
  it('dropping a bench player on a starter swaps them', () => {
    const r = dropInRotation(rot, 'b2', { section: 'starters', index: 0 })
    expect(r.starters[0]).toBe('b2')
    expect(r.bench[1]).toBe('s1')
    expect(all(r)).toEqual(all(rot))
  })
  it('dropping a starter on another starter slot swaps their positions', () => {
    const r = dropInRotation(rot, 's1', { section: 'starters', index: 4 })
    expect(r.starters).toEqual(['s5', 's2', 's3', 's4', 's1'])
  })
  it('dropping within the bench reorders', () => {
    const r = dropInRotation(rot, 'b5', { section: 'bench', index: 0 })
    expect(r.bench).toEqual(['b5', 'b1', 'b2', 'b3', 'b4', 'b6', 'b7'])
  })
  it('dropping an inactive player on a bench player swaps them so the active count stays 12', () => {
    const r = dropInRotation(rot, 'i1', { section: 'bench', index: 6 })
    expect(r.bench[6]).toBe('i1')
    expect(r.inactive[0]).toBe('b7')
    expect(r.starters.length + r.bench.length).toBe(12)
  })
  it('dropping a bench player in the open inactive area moves him there', () => {
    const r = dropInRotation(rot, 'b1', { section: 'inactive', append: true })
    expect(r.inactive).toEqual(['i1', 'i2', 'b1'])
    expect(r.bench).toHaveLength(6)
  })
  it('never empties a starting slot via an open-area drop', () => {
    expect(dropInRotation(rot, 's3', { section: 'bench', append: true })).toBe(rot)
  })
})
