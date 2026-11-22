import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { League } from '../../src/engine/types'

let resolveSim: ((l: League) => void) | null = null
const runSim = vi.fn((_l: League, _c: unknown) => new Promise<League>((r) => (resolveSim = r)))
vi.mock('../../src/worker/client', () => ({ runSim: (l: League, c: unknown) => runSim(l, c) }))

const { useStore } = await import('../../src/ui/store')

describe('store', () => {
  beforeEach(() => {
    runSim.mockClear()
    useStore.setState({ saveId: null, league: null, busy: false, error: null })
  })
  it('creates a league and saves it', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const s = useStore.getState()
    expect(s.league?.name).toBe('N')
    expect(s.saveId).not.toBeNull()
  })
  it('ignores a second sim while one is running', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const base = useStore.getState().league!
    const p1 = useStore.getState().sim({ type: 'simDays', days: 1 })
    expect(useStore.getState().busy).toBe(true)
    const p2 = useStore.getState().sim({ type: 'simDays', days: 7 })
    expect(runSim).toHaveBeenCalledTimes(1)
    resolveSim!({ ...base, day: 2 })
    await Promise.all([p1, p2])
    expect(useStore.getState().busy).toBe(false)
    expect(useStore.getState().league!.day).toBe(2)
  })
  it('rejects an invalid rotation and keeps the old one', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const l = useStore.getState().league!
    const t = l.teams[l.userTeamId]
    const old = t.rotation
    useStore.getState().setRotation(t.id, { ...old, starters: old.starters.slice(0, 4), inactive: [...old.inactive, old.starters[4]] })
    expect(useStore.getState().league!.teams[t.id].rotation).toEqual(old)
    expect(useStore.getState().error).toMatch(/starters/i)
  })
  it('accepts a valid rotation change', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const l = useStore.getState().league!
    const t = l.teams[l.userTeamId]
    const r = t.rotation
    const swapped = { starters: [r.bench[0], ...r.starters.slice(1)], bench: [r.starters[0], ...r.bench.slice(1)], inactive: r.inactive }
    useStore.getState().setRotation(t.id, swapped)
    expect(useStore.getState().league!.teams[t.id].rotation).toEqual(swapped)
    expect(useStore.getState().error).toBeNull()
  })
  it('ignores load/new/import/remove while a sim is running', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'A' })
    const idA = useStore.getState().saveId!
    await useStore.getState().newLeague({ seed: 4, userTeamIndex: 2, name: 'B' })
    const idB = useStore.getState().saveId!
    await useStore.getState().load(idA)
    const p = useStore.getState().sim({ type: 'simDays', days: 1 })
    await useStore.getState().load(idB)
    await useStore.getState().newLeague({ seed: 5, userTeamIndex: 0, name: 'C' })
    await useStore.getState().remove(idA)
    expect(useStore.getState().saveId).toBe(idA)
    resolveSim!({ ...useStore.getState().league!, day: 9 })
    await p
    expect(useStore.getState().league!.name).toBe('A')
    expect(useStore.getState().league!.day).toBe(9)
  })
  it('does not apply a sim result to a different active save', async () => {
    const { loadSave } = await import('../../src/save/db')
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'A' })
    const idA = useStore.getState().saveId!
    const leagueA = useStore.getState().league!
    await useStore.getState().newLeague({ seed: 4, userTeamIndex: 2, name: 'B' })
    const idB = useStore.getState().saveId!
    const leagueB = useStore.getState().league!
    useStore.setState({ saveId: idA, league: leagueA })
    const p = useStore.getState().sim({ type: 'simDays', days: 1 })
    useStore.setState({ saveId: idB, league: leagueB }) // switched underneath the sim
    resolveSim!({ ...leagueA, day: 5 })
    await p
    expect(useStore.getState().league!.name).toBe('B')
    expect((await loadSave(idB)).name).toBe('B')
    expect((await loadSave(idA)).day).toBe(5)
  })
  it('act: a GM error becomes a friendly message and leaves the league untouched; success shows a notice', async () => {
    const { GmError } = await import('../../src/engine/gm/cap')
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const before = useStore.getState().league!
    expect(useStore.getState().act(() => { throw new GmError('Nope.') })).toBe(false)
    expect(useStore.getState().error).toBe('Nope.')
    expect(useStore.getState().league).toBe(before)
    expect(useStore.getState().act((l) => { l.name = 'Renamed'; return 'Done!' })).toBe(true)
    expect(useStore.getState().league!.name).toBe('Renamed')
    expect(before.name).toBe('N')
    expect(useStore.getState().notice).toBe('Done!')
  })
})
