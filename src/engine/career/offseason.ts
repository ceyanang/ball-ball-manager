import { FA_DAYS } from '../gm/roster'
import { advanceOffseason, simFreeAgency, startNewSeason } from '../gm/offseason'
import { contractOffers } from './contracts'
import { retirementPrompt } from './retirement'
import { Rng } from '../rng'
import type { League } from '../types'

/** Right after the Finals: if his contract is up, he gets a choice before anything else happens. */
export function onCareerOffseasonStart(l: League): void {
  const c = l.career
  if (!c || c.status !== 'active') return
  const p = l.players[c.playerId]
  // A retirement prompt comes first; if he refuses, his contract decision follows.
  const r = retirementPrompt(l)
  c.seasonInjury = false
  if (r) c.retirement = r
  else if (p.contract && p.contract.expires <= l.season) c.offers = contractOffers(l)
}

/**
 * Runs the whole offseason for a career: awards, draft, re-signing and free agency all happen for the CPU teams,
 * and the new season starts. Stops (`paused`) whenever he owes a decision (a contract choice).
 */
export function careerAdvanceOffseason(l: League): { status: 'paused' | 'newSeason' | 'idle'; league: League } {
  if (l.phase !== 'offseason' || !l.offseason) return { status: 'idle', league: l }
  const next = structuredClone(l)
  const r = new Rng(next.rng)
  for (let guard = 0; guard < 30; guard++) {
    if (next.career?.offers || next.career?.retirement) return { status: 'paused', league: next }
    const os = next.offseason
    if (!os) break
    if (os.step === 'ready') {
      startNewSeason(next, r)
      return { status: 'newSeason', league: next }
    }
    if (os.step === 'freeAgency') simFreeAgency(next, r, FA_DAYS)
    else advanceOffseason(next, r)
  }
  return { status: 'paused', league: next }
}
