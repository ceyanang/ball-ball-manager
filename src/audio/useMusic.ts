import { useEffect } from 'react'
import { areaFor } from './area'
import { playArea, unlockAudio } from './engine'
import { sfx } from './sfx'

/** Keeps the music bed matched to the screen, unlocks audio on the first gesture, and ticks on button taps. */
export function useMusic(pathname: string, watching: boolean): void {
  const area = areaFor(pathname, watching)
  useEffect(() => { playArea(area) }, [area])
  useEffect(() => {
    const onDown = (e: Event) => {
      unlockAudio()
      if ((e.target as Element | null)?.closest?.('button, a')) sfx.tap()
    }
    const onKey = () => unlockAudio()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [])
}
