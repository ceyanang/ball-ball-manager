import { describe, expect, it } from 'vitest'
import { areaFor } from '../../src/audio/area'

describe('areaFor', () => {
  it.each(['/office', '/trade', '/trade-finder', '/free-agents', '/draft', '/offseason', '/office/anything'])('%s is office', (p) => {
    expect(areaFor(p, false)).toBe('office')
  })
  it.each(['/', '/player/abc', '/roster', '/standings', '/saves', '/inbox', '/tradeish'])('%s is menu', (p) => {
    expect(areaFor(p, false)).toBe('menu')
  })
  it('watching always means match, whatever the path', () => {
    expect(areaFor('/office', true)).toBe('match')
    expect(areaFor('/', true)).toBe('match')
  })
})
