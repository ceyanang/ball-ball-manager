import { describe, expect, it } from 'vitest'
import { committed, ovr } from '../../src/engine/gm/cap'
import { autoPick, currentSlot } from '../../src/engine/gm/draft'
import { advanceOffseason } from '../../src/engine/gm/offseason'
import { fillRoster } from '../../src/engine/gm/roster'
import { createLeague } from '../../src/engine/league/create'
import { Rng } from '../../src/engine/rng'
import { simUntil } from '../../src/engine/season/advance'
import type { League } from '../../src/engine/types'

const SEASONS = 8
const SIM_LONG = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM_LONG
const rostered = (l: League) => Object.values(l.players).filter((p) => p.teamId && !p.retired)
const top8Mean = (l: League) => {
  const per = Object.keys(l.teams).map((id) => {
    const o = committed(l, id).map(ovr).sort((a, b) => b - a).slice(0, 8)
    return o.reduce((a, b) => a + b, 0) / o.length
  })
  return per.reduce((a, b) => a + b, 0) / per.length
}
const nAt = (l: League, v: number) => rostered(l).filter((p) => ovr(p) >= v).length
const n80 = (l: League) => nAt(l, 80)

// Long: run with `SIM_LONG=1 npx vitest run tests/engine/inflation.test.ts`.
describe('league talent over many seasons', () => {
  it.skipIf(!SIM_LONG)('does not inflate over 8 seasons', { timeout: 900_000 }, () => {
    let l = createLeague({ seed: 5, userTeamIndex: 3, name: 'Inflate' })
    const start = { n80: n80(l), top8: top8Mean(l) }
    const log: string[] = [`season 1 start: 80+=${start.n80} top8=${start.top8.toFixed(1)}`]
    for (let s = 1; s <= SEASONS; s++) {
      l = simUntil(l, 'playoffsEnd')
      const rng = new Rng(l.rng)
      for (let i = 0; i < 3; i++) advanceOffseason(l, rng) // recap, lottery, draft
      if (currentSlot(l)) autoPick(l)
      for (let i = 0; i < 3; i++) advanceOffseason(l, rng) // finish draft, resign, free agency
      fillRoster(l, l.userTeamId, 13)
      advanceOffseason(l, rng) // new season
      l.rng = rng.state
      log.push(`after season ${s}: 80+=${n80(l)} 85+=${nAt(l, 85)} 90+=${nAt(l, 90)} top8=${top8Mean(l).toFixed(1)}`)
    }
    console.log(log.join('\n'))
    // Plateau: 80+ stays a minority (<= 20% of rostered players), 90+ stays a handful, and the average rotation barely drifts.
    expect(n80(l) / rostered(l).length).toBeLessThanOrEqual(0.2)
    expect(nAt(l, 90)).toBeLessThanOrEqual(16)
    expect(top8Mean(l) - start.top8).toBeLessThan(3.5)
  })
})
