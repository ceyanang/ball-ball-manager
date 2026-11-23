import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { League } from '../../src/engine/types'

let resolveSim: ((l: League) => void) | null = null
const runSim = vi.fn((_l: League, _c: unknown) => new Promise<League>((r) => (resolveSim = r)))
const runWatch = vi.fn()
vi.mock('../../src/worker/client', () => ({ runSim: (l: League, c: unknown) => runSim(l, c), runWatch: (l: League) => runWatch(l) }))

const { useStore } = await import('../../src/ui/store')

describe('store', () => {
  beforeEach(() => {
    runSim.mockClear()
    runWatch.mockReset()
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
  it('startWatch stores the capture with the pre-game league and saves the new one', async () => {
    const { loadSave } = await import('../../src/save/db')
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const before = useStore.getState().league!
    const id = useStore.getState().saveId!
    const capture = { gameId: 'g1', log: [] }
    runWatch.mockResolvedValue({ league: { ...before, day: 2 }, watch: capture })
    await useStore.getState().startWatch()
    const s = useStore.getState()
    expect(s.busy).toBe(false)
    expect(s.league!.day).toBe(2)
    expect(s.watch).toEqual({ gameId: 'g1', log: [], before })
    expect((await loadSave(id)).day).toBe(2)
    s.endWatch()
    expect(useStore.getState().watch).toBeNull()
  })
  it('startWatch without a capture behaves like sim', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const before = useStore.getState().league!
    runWatch.mockResolvedValue({ league: { ...before, day: 2 }, watch: null })
    await useStore.getState().startWatch()
    expect(useStore.getState().watch).toBeNull()
    expect(useStore.getState().league!.day).toBe(2)
    expect(useStore.getState().busy).toBe(false)
  })
  it('startWatch reports a failure and clears busy', async () => {
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    runWatch.mockRejectedValue(new Error('boom'))
    await useStore.getState().startWatch()
    expect(useStore.getState().error).toMatch(/boom/)
    expect(useStore.getState().busy).toBe(false)
    expect(useStore.getState().watch).toBeNull()
  })
  it('toggleFavorite adds and removes, persists, and shows no notice', async () => {
    const { loadSave } = await import('../../src/save/db')
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'N' })
    const id = useStore.getState().saveId!
    const pid = Object.keys(useStore.getState().league!.players)[0]
    useStore.getState().toggleFavorite(pid)
    expect(useStore.getState().league!.favoritePlayerIds).toEqual([pid])
    expect(useStore.getState().notice).toBeNull()
    await vi.waitFor(async () => expect((await loadSave(id)).favoritePlayerIds).toEqual([pid]))
    useStore.getState().toggleFavorite(pid)
    expect(useStore.getState().league!.favoritePlayerIds).toEqual([])
  })
})

describe('random events in the store', () => {
  const evt = {
    id: 'ui1', when: 'preGame' as const, weight: 1, emoji: '🧪',
    pick: () => null, title: () => 'T', text: () => 'X',
    choices: [{ label: 'A', outcomes: [{ weight: 1, tone: 'good' as const, text: () => 'ok', effects: (s: { playerIds: string[] }) => [{ kind: 'morale' as const, target: { player: s.playerIds[0] }, delta: 5 }] }] }],
  }
  it('answering clears the pending event, logs it and saves; frequency can be changed', async () => {
    const { setCatalogForTests } = await import('../../src/engine/events/engine')
    setCatalogForTests([evt])
    await useStore.getState().newLeague({ seed: 3, userTeamIndex: 1, name: 'E' })
    const l = structuredClone(useStore.getState().league!)
    const me = Object.values(l.players).find((p) => p.teamId === l.userTeamId)!
    l.events.pending = { eventId: 'ui1', season: l.season, phase: l.phase, day: l.day, subjects: { playerIds: [me.id] } }
    useStore.setState({ league: l })
    const entry = useStore.getState().answerEvent(0)
    expect(entry?.outcomeText).toBe('ok')
    const after = useStore.getState().league!
    expect(after.events.pending).toBeNull()
    expect(after.events.history).toHaveLength(1)
    expect(after.players[me.id].morale).toBe(Math.min(100, me.morale + 5))
    expect(useStore.getState().answerEvent(0)).toBeNull()
    useStore.getState().setEventFrequency('off')
    expect(useStore.getState().league!.events.frequency).toBe('off')
    setCatalogForTests(null)
  })
})
