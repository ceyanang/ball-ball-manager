import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLeague } from '../../src/engine/league/create'

describe('worker client', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('rejects pending sims when the worker errors, and recovers with a fresh worker', async () => {
    let made = 0
    class BrokenWorker {
      onerror: ((e: unknown) => void) | null = null
      onmessage: ((e: unknown) => void) | null = null
      constructor() { made++ }
      postMessage() { setTimeout(() => this.onerror?.({ message: 'boom' })) }
      terminate() {}
    }
    vi.stubGlobal('Worker', BrokenWorker)
    vi.resetModules()
    const { runSim } = await import('../../src/worker/client')
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'W' })
    await expect(runSim(l, { type: 'simDays', days: 1 })).rejects.toThrow()
    await expect(runSim(l, { type: 'simDays', days: 1 })).rejects.toThrow()
    expect(made).toBe(2)
  })
  it('runWatch resolves to the league and capture from the worker response', async () => {
    const l = createLeague({ seed: 1, userTeamIndex: 0, name: 'W' })
    const watch = { gameId: 'g1', log: [] }
    class OkWorker {
      onmessage: ((e: unknown) => void) | null = null
      postMessage(m: { id: number }) { setTimeout(() => this.onmessage?.({ data: { id: m.id, league: l, watch } })) }
      terminate() {}
    }
    vi.stubGlobal('Worker', OkWorker)
    vi.resetModules()
    const { runWatch } = await import('../../src/worker/client')
    await expect(runWatch(l)).resolves.toEqual({ league: l, watch })
  })
})
