import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILD_TEMPLATES } from '../../src/engine/career/build'
import { isGmPath, SIDEBAR_GROUPS, TABS, withoutGm, withoutGmGroups } from '../../src/ui/nav'

vi.mock('../../src/worker/client', () => ({ runSim: vi.fn(), runWatch: vi.fn() }))
const { useStore } = await import('../../src/ui/store')

const t = BUILD_TEMPLATES[0]
const startCareer = () => useStore.getState().newCareer({ seed: 4, name: 'C', build: { max: t.max, pos: t.pos, first: 'A', last: 'B', heightIn: 76 } })

describe('MyCareer GM gating', () => {
  beforeEach(() => useStore.setState({ saveId: null, league: null, busy: false, error: null, notice: null }))

  it('newCareer saves a career league waiting on draft night', async () => {
    await startCareer()
    const l = useStore.getState().league!
    expect(l.career?.status).toBe('draftNight')
    expect(useStore.getState().saveId).not.toBeNull()
  })
  it('refuses GM moves but allows marked ones', async () => {
    await startCareer()
    const ran = vi.fn()
    expect(useStore.getState().act(() => { ran() })).toBe(false)
    expect(ran).not.toHaveBeenCalled()
    expect(useStore.getState().error).toMatch(/MyCareer/)
    expect(useStore.getState().act(() => { ran() }, { career: true })).toBe(true)
    expect(ran).toHaveBeenCalledTimes(1)
  })
  it('refuses to edit the rotation', async () => {
    await startCareer()
    const l = useStore.getState().league!
    const team = l.teams[l.userTeamId]
    useStore.getState().setRotation(team.id, { ...team.rotation, starters: [...team.rotation.starters].reverse() })
    expect(useStore.getState().league!.teams[team.id].rotation).toEqual(team.rotation)
    expect(useStore.getState().error).toMatch(/coach/)
  })
  it('normal leagues still allow GM moves', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    expect(useStore.getState().act(() => {})).toBe(true)
  })
  it('hides the GM destinations from navigation', () => {
    expect(isGmPath('/trade')).toBe(true)
    expect(isGmPath('/standings')).toBe(false)
    const flat = withoutGmGroups(SIDEBAR_GROUPS).flatMap((g) => g.items).map((i) => i.to)
    for (const gm of ['/office', '/offseason']) expect(flat).not.toContain(gm)
    expect(flat).toContain('/standings')
    expect(withoutGm(TABS).map((x) => x.to)).not.toContain('/office')
  })
})
