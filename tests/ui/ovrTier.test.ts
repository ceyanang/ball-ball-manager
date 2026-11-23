import { describe, expect, it } from 'vitest'
import { ovrTier } from '../../src/ui/ovrTier'

describe('ovrTier', () => {
  it.each([
    [50, 'bronze'], [69, 'bronze'],
    [70, 'silver'], [75, 'silver'],
    [76, 'gold'], [80, 'gold'],
    [81, 'purple'], [85, 'purple'],
    [86, 'diamond'], [94, 'diamond'],
    [95, 'prismatic'], [99, 'prismatic'],
  ] as const)('%i is %s', (v, tier) => {
    expect(ovrTier(v)).toBe(tier)
  })
})
