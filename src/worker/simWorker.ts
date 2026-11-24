/// <reference lib="webworker" />
import { offseasonStep, simDays, simUntil, watchDay } from '../engine/season/advance'
import { simRollsEvents, type SimRequest, type SimResponse } from './protocol'

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, cmd, league } = e.data
  const OPTS = { stopOnOffer: true, pauseForEvents: simRollsEvents(cmd) }
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
