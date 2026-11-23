import type { PlayEvent } from '../engine/sim/playlog'
import { sfx } from './sfx'

export type SfxName = keyof typeof sfx

/** Which sounds a play makes. `next` is the event right after it in the log (a miss followed by a block was swatted). */
export function sfxFor(e: PlayEvent, next?: PlayEvent): SfxName[] {
  if (e.k === 'fg') {
    if (e.made) return e.three ? ['swish', 'crowd'] : ['swish']
    return [next?.k === 'blk' ? 'block' : 'clank']
  }
  if (e.k === 'ft') return ['ftTick', e.made ? 'swish' : 'clank']
  return []
}
