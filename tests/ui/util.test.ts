import { describe, expect, it } from 'vitest'
import { money } from '../../src/ui/util'

describe('money', () => {
  it('formats thousands and millions, and zero as plain $0', () => {
    expect(money(0)).toBe('$0')
    expect(money(750)).toBe('$750K')
    expect(money(1500)).toBe('$1.5M')
    expect(money(-2500)).toBe('-$2.5M')
  })
})
