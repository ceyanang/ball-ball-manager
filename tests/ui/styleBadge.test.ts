import { describe, expect, it } from 'vitest'
import { RATING_KEYS } from '../../src/engine/player/ratings'
import { STYLE_EMOJI } from '../../src/engine/player/playStyle'
import { badgeLabel, boostNote, isBoosted } from '../../src/ui/components/StyleBadge'

describe('style badge helpers', () => {
  it('labels and emoji', () => {
    expect(badgeLabel('power')).toBe('Power style')
    expect(badgeLabel('allAround')).toBe('All-Around style')
    expect(STYLE_EMOJI).toEqual({ smart: '🧠', offense: '⚔️', allAround: '🏀', power: '💪', defensive: '🛡' })
  })
  it('marks only the stats a specialty boosts; All-Around gets a note instead of marks', () => {
    expect(isBoosted('power', 'strength')).toBe(true)
    expect(isBoosted('power', 'threePointShot')).toBe(false)
    expect(isBoosted('defensive', 'block')).toBe(true)
    for (const k of RATING_KEYS) expect(isBoosted('allAround', k)).toBe(false)
    expect(boostNote('allAround')).toMatch(/\+2 to every stat/)
    expect(boostNote('power')).toBe('Power boost: plays +4 in games')
  })
})
