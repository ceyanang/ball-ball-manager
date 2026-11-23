import { describe, expect, it } from 'vitest'
import { NEED_RANK } from '../../src/ui/needRank'

describe('NEED_RANK', () => {
  it('ranks urgent needs above mild ones above solid positions', () => {
    expect(NEED_RANK.red).toBeGreaterThan(NEED_RANK.yellow)
    expect(NEED_RANK.yellow).toBeGreaterThan(NEED_RANK.green)
  })
})
