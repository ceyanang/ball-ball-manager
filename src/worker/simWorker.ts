/// <reference lib="webworker" />
import { offseasonStep, simDays, simUntil, watchDay } from '../engine/season/advance'
import type { SimRequest, SimResponse } from './protocol'

const OPTS = { stopOnOffer: true, pauseForEvents: true }

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, cmd, league } = e.data
  let res: SimResponse
  try {
    if (cmd.type === 'watchDay') res = { id, ...watchDay(league, OPTS) }
    else res = {
      id,
      league: cmd.type === 'simDays' ? simDays(league, cmd.days, OPTS) : cmd.type === 'simUntil' ? simUntil(league, cmd.target, OPTS) : offseasonStep(league, cmd),
    }
  } catch (err) {
    res = { id, error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(res)
}
