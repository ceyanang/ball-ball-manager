import { sfxOut } from './engine'
import { noise, tone } from './synth'

/** Make one sound; never throws, silent when audio is unavailable/muted. */
function play(name: string, fn: (ctx: AudioContext, out: AudioNode, t: number) => void) {
  return () => {
    try {
      const o = sfxOut(name)
      if (o) fn(o.ctx, o.out, o.ctx.currentTime)
    } catch { /* ignore */ }
  }
}

export const sfx = {
  swish: play('swish', (c, o, t) => noise(c, o, 'bandpass', 4500, t, 0.28, 0.5, 0.03)),
  clank: play('clank', (c, o, t) => { tone(c, o, 'triangle', 232, t, 0.22, 0.28); tone(c, o, 'sine', 351, t, 0.18, 0.2); noise(c, o, 'highpass', 3000, t, 0.04, 0.2) }),
  ftTick: play('ftTick', (c, o, t) => tone(c, o, 'sine', 1300, t, 0.04, 0.2)),
  block: play('block', (c, o, t) => { noise(c, o, 'lowpass', 500, t, 0.14, 0.6); tone(c, o, 'sine', 160, t, 0.12, 0.4, 70) }),
  buzzer: play('buzzer', (c, o, t) => { tone(c, o, 'sawtooth', 130, t, 0.8, 0.3); tone(c, o, 'square', 136, t, 0.8, 0.18) }),
  crowd: play('crowd', (c, o, t) => noise(c, o, 'bandpass', 900, t, 1.3, 0.3, 0.2)),
  tap: play('tap', (c, o, t) => tone(c, o, 'sine', 880, t, 0.05, 0.15)),
}
