import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { generateProspects, projectedArchetype, scoutProspect } from '../../src/engine/gm/draft'
import { createLeague } from '../../src/engine/league/create'
import { PILLAR_KEYS, generatePlayerArchetype } from '../../src/engine/player/archetype'
import { Rng } from '../../src/engine/rng'
import { LineupFitPanel } from '../../src/ui/components/LineupFitPanel'

describe('Archetype & Lineup Fit UI', () => {
  it('renders LineupFitPanel with unit bonuses and spacing warning status', () => {
    const league = createLeague({ seed: 1, userTeamIndex: 0, name: 'UI' })
    const team = league.teams[league.userTeamId]
    const starters = team.rotation.starters.map((id) => league.players[id])
    const html = renderToStaticMarkup(<LineupFitPanel starters={starters} />)
    expect(html).toContain('Lineup fit · Starting five')
    expect(html).toContain('Spacing Bonus')
    expect(html).toContain('Playmaker Link')
    expect(html).toContain('Rim Anchor Coverage')
    expect(html).toContain('Perimeter Clamp')
    expect(html).toContain('Paint Clutter Warning')
  })

  it('produces Projected Archetype range and 6 pillars for draft prospects', () => {
    const league = createLeague({ seed: 2, userTeamIndex: 0, name: 'DraftUI' })
    const { ids, scout } = generateProspects(league, Rng.fromSeed(5))
    const p = league.players[ids[0]]
    const proj = projectedArchetype(p, scout[p.id])
    const rep = scoutProspect(p, scout[p.id])
    expect(proj.label.length).toBeGreaterThan(0)
    expect(rep.pillars).toHaveLength(6)
    expect(rep.projected.label).toBe(proj.label)
  })

  it('exposes all 6 pillars and dynamic title for PlayerPage', () => {
    const league = createLeague({ seed: 3, userTeamIndex: 0, name: 'PlayerUI' })
    const p = Object.values(league.players).find((x) => x.teamId)!
    const arch = generatePlayerArchetype(p)
    expect(arch.title.length).toBeGreaterThan(0)
    for (const k of PILLAR_KEYS) {
      expect(arch.pillars[k]).toBeGreaterThanOrEqual(25)
      expect(arch.pillars[k]).toBeLessThanOrEqual(99)
    }
  })
})
