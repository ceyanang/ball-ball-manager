import { GmError } from '../gm/cap'
import type { League, Player } from '../types'
import { ovrOf } from './careerOvr'
import { contractOffers } from './contracts'
import { finishCareer } from './endings'

const peakOf = (p: Player) => Math.max(ovrOf(p), ...p.ratingHistory.map((h) => h.ovr))

/**
 * Whether the game asks him to retire now: suggested for age, a steep decline from his peak or a bad injury (he may
 * refuse), forced for the very old or the finished (he may not).
 */
export function retirementPrompt(l: League): { kind: 'suggest' | 'forced'; text: string } | null {
  const c = l.career
  if (!c || c.status !== 'active') return null
  const p = l.players[c.playerId]
  if (!p || p.retired) return null
  const o = ovrOf(p)
  const decline = peakOf(p) - o
  if (p.age >= 40 || (p.age >= 36 && o <= 60) || (p.age >= 35 && p.injury?.severity === 'season'))
    return { kind: 'forced', text: `At ${p.age}, the body has decided for you. It is time to walk away.` }
  if (p.injury?.severity === 'season' && p.age >= 31)
    return { kind: 'suggest', text: 'A season-ending injury at this age makes everyone wonder whether you should come back at all.' }
  if (p.age >= 35) return { kind: 'suggest', text: `You are ${p.age}. The game has changed and your legs have noticed. Hang it up, or one more year?` }
  if (p.age >= 32 && decline >= 15) return { kind: 'suggest', text: `You are not the player you were — down ${decline} from your peak. Is it time?` }
  if (p.age >= 33 && o < 55) return { kind: 'suggest', text: 'The minutes are drying up. Some people say it is time to move on.' }
  return null
}

/** Answers the retirement prompt. `force` retires on the spot, prompt or not. */
export function answerRetirement(l: League, choice: 'accept' | 'refuse' | 'force'): void {
  const c = l.career
  if (!c || c.status !== 'active') throw new GmError('He has already retired.')
  if (choice === 'refuse') {
    const kind = (c.retirement ?? retirementPrompt(l))?.kind
    if (kind === 'forced') throw new GmError('This one is not up to you any more.')
    c.retirement = null
    c.refusals = (c.refusals ?? 0) + 1
    const p = l.players[c.playerId]
    // Staying means his contract question still has to be answered.
    if (l.phase === 'offseason' && p.contract && p.contract.expires <= l.season) c.offers = contractOffers(l)
    return
  }
  if (choice === 'force') c.retiredEarly = true
  finishCareer(l)
}
