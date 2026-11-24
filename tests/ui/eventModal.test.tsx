import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createLeague } from '../../src/engine/league/create'
import { committed } from '../../src/engine/gm/cap'
import { fullName, moodOf, ovrOf } from '../../src/ui/util'

vi.mock('../../src/worker/client', () => ({ runSim: vi.fn(), runWatch: vi.fn() }))

const { EventPlayer } = await import('../../src/ui/components/EventModal')

describe('event pop-up player card', () => {
  const l = createLeague({ seed: 3, userTeamIndex: 2, name: 'E' })
  it('shows the player, his OVR and his mood', () => {
    const p = committed(l, l.userTeamId)[0]
    const html = renderToStaticMarkup(<EventPlayer league={l} playerId={p.id} />)
    expect(html).toContain(fullName(p))
    expect(html).toContain(`Overall ${ovrOf(p)}`)
    expect(html).toContain(`${moodOf(p.morale).label} · ${p.morale}`)
  })
  it('renders nothing for a whole-team event', () => {
    expect(renderToStaticMarkup(<EventPlayer league={l} playerId={undefined} />)).toBe('')
  })
})
