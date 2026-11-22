/// <reference lib="webworker" />
import { simDays, simUntil } from '../engine/season/advance'
import type { SimRequest, SimResponse } from './protocol'

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, cmd, league } = e.data
  let res: SimResponse
  try {
    res = { id, league: cmd.type === 'simDays' ? simDays(league, cmd.days) : simUntil(league, cmd.target) }
  } catch (err) {
    res = { id, error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(res)
}
