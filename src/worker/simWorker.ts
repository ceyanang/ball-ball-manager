/// <reference lib="webworker" />
import { careerAdvanceOffseason } from '../engine/career/offseason'
import { careerPlayDay } from '../engine/career/play'
import { offseasonStep, simDays, simUntil, watchDay } from '../engine/season/advance'
import { simRollsEvents, type SimRequest, type SimResponse } from './protocol'

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, cmd, league } = e.data
  const OPTS = { stopOnOffer: true, pauseForEvents: simRollsEvents(cmd) }
  let res: SimResponse
  try {
    if (cmd.type === 'watchDay') res = { id, ...watchDay(league, OPTS) }
    else if (cmd.type === 'careerOffseason') res = { id, league: careerAdvanceOffseason(league).league }
    else if (cmd.type === 'careerDay' || cmd.type === 'careerAnswer') {
      const opts = { ...OPTS, watch: !!cmd.watch }
      const r = cmd.type === 'careerDay' ? careerPlayDay(league, cmd.mode, undefined, opts) : careerPlayDay(league, 'play', cmd.answer, opts)
      res = { id, league: r.league, moment: r.kind === 'moment' ? r.prompt : null, watch: r.watch ?? null, preview: r.kind === 'moment' ? r.preview ?? null : null }
    }
    else res = {
      id,
      league: cmd.type === 'simDays' ? simDays(league, cmd.days, OPTS) : cmd.type === 'simUntil' ? simUntil(league, cmd.target, OPTS) : offseasonStep(league, cmd),
    }
  } catch (err) {
    res = { id, error: err instanceof Error ? err.message : String(err) }
  }
  self.postMessage(res)
}
