import { describe, expect, it } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { ACCEPT_FLOOR, ACCEPT_MARGIN } from '../../src/engine/gm/trade'
import { offerShare, rejectionText, tradeLabel } from '../../src/ui/tradeText'

const need = (gave: number) => gave * ACCEPT_MARGIN + ACCEPT_FLOOR

describe('trade reply text', () => {
  it('measures the offer against what they need back', () => {
    expect(offerShare({ gave: 50, got: need(50) })).toBe(1)
    expect(offerShare({ gave: 50, got: need(50) / 2 })).toBeCloseTo(0.5)
  })

  it('says how far off a rejected offer is', () => {
    expect(rejectionText('Kelptics', { gave: 50, got: need(50) * 0.95 })).toMatch(/Close — you’re about 5% short/)
    expect(rejectionText('Kelptics', { gave: 50, got: need(50) * 0.7 })).toMatch(/about 30% short/)
    expect(rejectionText('Kelptics', { gave: 50, got: need(50) * 0.2 })).toMatch(/about 20% of what they’d need/)
  })
})

describe('tradeLabel', () => {
  it('names picks by season and round', () => {
    const l = createLeague({ seed: 3, userTeamIndex: 0, name: 'T' })
    const pk = l.picks[0]
    expect(tradeLabel(l, { kind: 'pick', id: pk.id })).toBe(`Season ${pk.season} · Round ${pk.round} pick (${l.teams[pk.originalTeamId].abbrev})`)
  })
})
