import { useSyncExternalStore } from 'react'

export interface AudioSettings { music: number; sfx: number; muted: boolean }

const KEY = 'bbm.audio'
const DEFAULTS: AudioSettings = { music: 0.5, sfx: 0.7, muted: false }
const clamp = (n: number) => Math.min(1, Math.max(0, n))
const vol = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v) : fallback)

export function parseSettings(raw: string | null): AudioSettings {
  if (!raw) return { ...DEFAULTS }
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null
    if (!o || typeof o !== 'object') return { ...DEFAULTS }
    return { music: vol(o.music, DEFAULTS.music), sfx: vol(o.sfx, DEFAULTS.sfx), muted: typeof o.muted === 'boolean' ? o.muted : DEFAULTS.muted }
  } catch {
    return { ...DEFAULTS }
  }
}

function load(): AudioSettings {
  try { return parseSettings(localStorage.getItem(KEY)) } catch { return { ...DEFAULTS } }
}

let current: AudioSettings | null = null
const listeners = new Set<() => void>()

export function getSettings(): AudioSettings {
  return (current ??= load())
}

export function setSettings(patch: Partial<AudioSettings>): void {
  const base = getSettings()
  current = {
    music: patch.music === undefined ? base.music : vol(patch.music, base.music),
    sfx: patch.sfx === undefined ? base.sfx : vol(patch.sfx, base.sfx),
    muted: patch.muted ?? base.muted,
  }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* storage unavailable: keep in memory */ }
  for (const fn of listeners) fn()
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const useAudioSettings = (): AudioSettings => useSyncExternalStore(subscribeSettings, getSettings, getSettings)
