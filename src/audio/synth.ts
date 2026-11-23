/** Tiny Web Audio building blocks: all take an explicit context and destination, schedule at absolute time `t`. */

export function tone(ctx: AudioContext, dest: AudioNode, wave: OscillatorType, hz: number, t: number, dur: number, gain: number, endHz?: number): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const len = Math.max(dur, 0.03)
  osc.type = wave
  osc.frequency.setValueAtTime(hz, t)
  if (endHz !== undefined) osc.frequency.exponentialRampToValueAtTime(endHz, t + len)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.linearRampToValueAtTime(0, t + len)
  osc.connect(g)
  g.connect(dest)
  osc.start(t)
  osc.stop(t + len + 0.05)
}

const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>()
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 1.5)), ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseBuffers.set(ctx, b)
  }
  return b
}

/** A burst of filtered noise with a quick attack and a linear decay. */
export function noise(ctx: AudioContext, dest: AudioNode, type: BiquadFilterType, hz: number, t: number, dur: number, gain: number, attack = 0.005): void {
  const src = ctx.createBufferSource()
  const f = ctx.createBiquadFilter()
  const g = ctx.createGain()
  src.buffer = noiseBuffer(ctx)
  f.type = type
  f.frequency.setValueAtTime(hz, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + attack)
  g.gain.linearRampToValueAtTime(0, t + Math.max(dur, attack + 0.01))
  src.connect(f)
  f.connect(g)
  g.connect(dest)
  src.start(t)
  src.stop(t + dur + 0.05)
}

export type Drum = 'kick' | 'snare' | 'hat'
export function drumHit(ctx: AudioContext, dest: AudioNode, kind: Drum, t: number, boost = 1): void {
  if (kind === 'kick') tone(ctx, dest, 'sine', 140, t, 0.16, 0.5 * boost, 42)
  else if (kind === 'snare') { noise(ctx, dest, 'highpass', 1500, t, 0.13, 0.22 * boost); tone(ctx, dest, 'triangle', 190, t, 0.08, 0.12 * boost) }
  else noise(ctx, dest, 'highpass', 7000, t, 0.04, 0.07 * boost)
}
