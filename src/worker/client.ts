import type { League } from '../engine/types'
import type { SimCommand, SimResponse } from './protocol'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (l: League) => void; reject: (e: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<SimResponse>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if ('error' in e.data) p.reject(new Error(e.data.error))
    else p.resolve(e.data.league)
  }
  return worker
}

export function runSim(league: League, cmd: SimCommand): Promise<League> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, cmd, league })
  })
}
