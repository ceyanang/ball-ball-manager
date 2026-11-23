import { describe, expect, it } from 'vitest'
import { badgeInk, contrastRatio, distinctColor } from '../../src/ui/color'

describe('contrast helper', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#007ac1', '#ef3b24')).toBeCloseTo(1.17, 1) // OKC
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 1) // short hex
  })

  it('keeps the secondary colour when it reads (>= 3:1) on the primary', () => {
    expect(badgeInk({ primary: '#1d1160', secondary: '#fdb927' })).toBe('#fdb927')
  })

  it('falls back to white or black, whichever contrasts better, when it does not', () => {
    expect(badgeInk({ primary: '#007ac1', secondary: '#ef3b24' })).toBe('#ffffff') // OKC
    expect(badgeInk({ primary: '#006bb6', secondary: '#ed174c' })).toBe('#ffffff') // PHI
    expect(badgeInk({ primary: '#007a33', secondary: '#ba9653' })).toBe('#ffffff') // BOS
    expect(badgeInk({ primary: '#ffd23f', secondary: '#ffffff' })).toBe('#000000')
  })
})

describe('distinctColor', () => {
  it('keeps the primary when the two teams look different', () => {
    expect(distinctColor({ primary: '#007a33', secondary: '#ba9653' }, '#c8102e')).toBe('#007a33')
  })
  it('switches to the secondary when the primaries clash', () => {
    expect(distinctColor({ primary: '#c8102e', secondary: '#1d428a' }, '#ce1141')).toBe('#1d428a')
  })
})
