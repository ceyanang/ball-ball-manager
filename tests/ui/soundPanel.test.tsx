import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SoundPanel } from '../../src/ui/components/SoundPanel'

describe('SoundPanel', () => {
  const html = renderToStaticMarkup(<SoundPanel />)
  it('has labelled Music and Sound effects sliders', () => {
    expect(html.match(/type="range"/g)).toHaveLength(2)
    expect(html).toContain('Music')
    expect(html).toContain('Sound effects')
  })
  it('has a mute toggle that starts unpressed', () => {
    expect(html).toMatch(/<button[^>]*aria-pressed="false"/)
  })
})
