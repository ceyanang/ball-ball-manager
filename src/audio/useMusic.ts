import { useEffect } from 'react'
import { areaFor } from './area'
import { playArea, unlockAudio } from './engine'
import { sfx } from './sfx'

/** Events that count as a user gesture for starting audio: iOS needs touchend/click, Android pointerup (not pointerdown). */
export const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const

/** Keeps the music bed matched to the screen, unlocks audio on the first gesture, and ticks on button taps. */
export function useMusic(pathname: string, watching: boolean): void {
  const area = areaFor(pathname, watching)
  useEffect(() => { playArea(area) }, [area])
  useEffect(() => {
    const unlock = () => unlockAudio()
    const onDown = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('button, a')) sfx.tap()
    }
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock)
    window.addEventListener('pointerdown', onDown)
    return () => {
      for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlock)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [])
}
