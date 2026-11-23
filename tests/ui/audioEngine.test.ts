import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __debug, playArea, setIntensity, stopMusic, unlockAudio } from '../../src/audio/engine'
import { sfx } from '../../src/audio/sfx'
import { setSettings } from '../../src/audio/settings'

const count = { osc: 0, src: 0 }
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} })
const node = () => ({ connect() { return this }, disconnect() {}, start() {}, stop() {} })

class StubCtx {
  currentTime = 0
  state = 'running'
  sampleRate = 8000
  destination = {}
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  createGain() { return { ...node(), gain: param() } }
  createOscillator() { count.osc++; return { ...node(), frequency: param(), type: 'sine' } }
  createBufferSource() { count.src++; return { ...node(), buffer: null, loop: false } }
  createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) } }
  createBiquadFilter() { return { ...node(), frequency: param(), Q: param(), type: 'lowpass' } }
}

const all = () => { sfx.swish(); sfx.clank(); sfx.ftTick(); sfx.block(); sfx.buzzer(); sfx.crowd(); sfx.tap() }

beforeEach(() => { count.osc = 0; count.src = 0; setSettings({ music: 0.5, sfx: 0.7, muted: false }); __debug.reset() })
afterEach(() => { stopMusic(); __debug.reset(); vi.unstubAllGlobals() })

describe('without Web Audio', () => {
  it('every call is a silent no-op', () => {
    expect(() => { unlockAudio(); playArea('menu'); setIntensity(1); all(); stopMusic() }).not.toThrow()
    expect(__debug.loops()).toBe(0)
  })
})

describe('with a stub AudioContext', () => {
  beforeEach(() => { vi.stubGlobal('AudioContext', StubCtx) })

  it('never stacks loops: same area twice is one loop, a new area replaces it', () => {
    unlockAudio()
    playArea('menu'); playArea('menu')
    expect(__debug.loops()).toBe(1)
    playArea('office')
    expect(__debug.loops()).toBe(1)
    expect(__debug.area()).toBe('office')
    stopMusic()
    expect(__debug.loops()).toBe(0)
  })

  it('remembers the wanted area until the first gesture unlocks audio', () => {
    playArea('match')
    expect(__debug.loops()).toBe(0)
    unlockAudio()
    expect(__debug.loops()).toBe(1)
    expect(__debug.area()).toBe('match')
  })

  it('makes sound when unmuted (positive control)', () => {
    unlockAudio(); sfx.swish()
    expect(count.src + count.osc).toBeGreaterThan(0)
  })

  it('is silent when muted, or at volume 0', () => {
    unlockAudio()
    setSettings({ muted: true }); all()
    expect(count.src + count.osc).toBe(0)
    setSettings({ muted: false, sfx: 0 }); all()
    expect(count.src + count.osc).toBe(0)
  })

  it('throttles the same sound fired twice at the same instant', () => {
    unlockAudio(); sfx.ftTick()
    const once = count.osc
    sfx.ftTick()
    expect(count.osc).toBe(once)
  })
})
