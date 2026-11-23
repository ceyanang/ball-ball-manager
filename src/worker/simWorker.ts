/// <reference lib="webworker" />
import { offseasonStep, simDays, simUntil, watchDay } from '../engine/season/advance'
import type { SimRequest, SimResponse } from './protocol'

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, cmd, league } = e.data
  let res: SimResponse
  try {
    if (cmd.type === 'watchDay') res = { id, ...watchDay(league, { stopOnOffer: true }) }
    else res = {
      id,
      league: cmd.type === 'simDays' ? simDays(league, cmd.days, { stopOnOffer: true }) : cmd.type === 'simUntil' ? simUntil(league, cmd.target, { stopOnOffer: true }) : offseasonStep(league, cmd),
    }
  } catch (err) {
    res = { id, error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(res)
}
