import { describe, expect, it } from 'vitest'
import { money, ordinal, rowPct } from '../../src/ui/util'

describe('money', () => {
  it('formats thousands and millions, and zero as plain $0', () => {
    expect(money(0)).toBe('$0')
    expect(money(750)).toBe('$750K')
    expect(money(1500)).toBe('$1.5M')
    expect(money(-2500)).toBe('-$2.5M')
  })
})

describe('standings display', () => {
  it('shows a dash instead of .000 before a team has played', () => {
    expect(rowPct({ w: 0, l: 0, pct: 0 })).toBe('—')
    expect(rowPct({ w: 0, l: 2, pct: 0 })).toBe('.000')
    expect(rowPct({ w: 3, l: 1, pct: 0.75 })).toBe('.750')
  })
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
  })
})
