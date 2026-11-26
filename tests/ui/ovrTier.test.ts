import { describe, expect, it } from 'vitest'
import { ovrTier } from '../../src/ui/ovrTier'

describe('ovrTier', () => {
  it.each([
    [50, 'bronze'], [69, 'bronze'],
    [70, 'silver'], [74, 'silver'],
    [75, 'gold'], [79, 'gold'],
    [80, 'purple'], [84, 'purple'],
    [85, 'diamond'], [89, 'diamond'],
    [90, 'red'], [92, 'red'],
    [93, 'prismatic'], [94, 'prismatic'],
    [95, 'blacksilver'], [96, 'blacksilver'],
    [97, 'blackrainbow'], [99, 'blackrainbow'],
  ] as const)('%i is %s', (v, tier) => {
    expect(ovrTier(v)).toBe(tier)
  })
})
