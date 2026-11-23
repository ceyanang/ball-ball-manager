import { describe, expect, it, vi } from 'vitest'
import { getSettings, parseSettings, setSettings, subscribeSettings } from '../../src/audio/settings'

const DEFAULTS = { music: 0.5, sfx: 0.7, muted: false }

describe('parseSettings', () => {
  it('returns defaults for null', () => expect(parseSettings(null)).toEqual(DEFAULTS))
  it('returns defaults for invalid JSON', () => expect(parseSettings('not json')).toEqual(DEFAULTS))
  it('clamps volumes and ignores a non-boolean muted', () => {
    expect(parseSettings('{"music":9,"sfx":-3,"muted":"yes"}')).toEqual({ music: 1, sfx: 0, muted: false })
  })
  it('falls back per field when a field is the wrong type', () => {
    expect(parseSettings('{"music":"loud","sfx":0.2,"muted":true}')).toEqual({ music: 0.5, sfx: 0.2, muted: true })
  })
})

describe('setSettings', () => {
  it('updates, clamps and notifies subscribers once', () => {
    const fn = vi.fn()
    const off = subscribeSettings(fn)
    setSettings({ music: 0.2 })
    expect(getSettings().music).toBe(0.2)
    expect(fn).toHaveBeenCalledTimes(1)
    setSettings({ sfx: 5 })
    expect(getSettings().sfx).toBe(1)
    off()
    setSettings({ music: 0.3 })
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('does not throw when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } })
    expect(() => setSettings({ muted: true })).not.toThrow()
    expect(getSettings().muted).toBe(true)
    vi.unstubAllGlobals()
  })
})
