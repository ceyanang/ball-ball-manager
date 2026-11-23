import { describe, expect, it } from 'vitest'
import { UNLOCK_EVENTS } from '../../src/audio/useMusic'

describe('UNLOCK_EVENTS', () => {
  it('includes the events browsers count as a user gesture for audio (iOS needs touchend/click, Android pointerup)', () => {
    for (const e of ['pointerup', 'touchend', 'click', 'keydown']) expect(UNLOCK_EVENTS).toContain(e)
  })
})
