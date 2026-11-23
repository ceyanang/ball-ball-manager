import { describe, expect, it } from 'vitest'
import { activeTab, MORE_GROUPS, SIDEBAR, TABS } from '../../src/ui/nav'

describe('mobile nav model', () => {
  it('maps paths to their owning tab', () => {
    expect(activeTab('/')).toBe('/')
    expect(activeTab('/roster')).toBe('/roster')
    expect(activeTab('/my-team')).toBe('/roster')
    expect(activeTab('/trade')).toBe('/office')
    expect(activeTab('/draft')).toBe('/office')
    expect(activeTab('/inbox')).toBe('/inbox')
    expect(activeTab('/standings')).toBe('more')
    expect(activeTab('/player/12')).toBe('more')
  })
  it('keeps the tab bar to four items plus More', () => {
    expect(TABS.length).toBe(4)
  })
  it('reaches every sidebar destination from a tab or the More sheet', () => {
    const reachable = new Set([...TABS.map((t) => t.to), ...MORE_GROUPS.flatMap((g) => g.items.map((i) => i.to))])
    for (const s of SIDEBAR) expect(reachable.has(s.to)).toBe(true)
  })
})
