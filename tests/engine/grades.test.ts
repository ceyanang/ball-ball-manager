import { describe, expect, it } from 'vitest'
import { gradeFor } from '../../src/engine/player/grades'
import { ratingColor } from '../../src/ui/ratingColor'

const hsl = (s: string) => {
  const m = s.match(/hsl\(\s*([\d.]+)[ ,]+([\d.]+)%[ ,]+([\d.]+)%\s*\)/)!
  return { h: +m[1], s: +m[2], l: +m[3] }
}

describe('gradeFor', () => {
  it('uses the US grade scale', () => {
    const cases: [number, string][] = [
      [99, 'A+'], [97, 'A+'], [96, 'A'], [93, 'A'], [92, 'A−'], [90, 'A−'], [89, 'B+'], [87, 'B+'], [86, 'B'], [83, 'B'],
      [82, 'B−'], [80, 'B−'], [79, 'C+'], [77, 'C+'], [76, 'C'], [73, 'C'], [72, 'C−'], [70, 'C−'], [69, 'D+'], [67, 'D+'],
      [66, 'D'], [63, 'D'], [62, 'D−'], [60, 'D−'], [59, 'F'], [40, 'F'], [12, 'F'],
    ]
    for (const [v, g] of cases) expect([v, gradeFor(v)]).toEqual([v, g])
  })
})

describe('ratingColor', () => {
  it('is dark red at 25 and dark green at 99', () => {
    const lo = hsl(ratingColor(25)), hi = hsl(ratingColor(99))
    expect(lo.h).toBe(0)
    expect(lo.l).toBeLessThanOrEqual(35)
    expect(hi.h).toBeGreaterThanOrEqual(120)
    expect(hi.l).toBeLessThanOrEqual(35)
  })
  it('is brighter in the middle and hue never decreases', () => {
    expect(hsl(ratingColor(62)).l).toBeGreaterThan(hsl(ratingColor(25)).l)
    let prev = -1
    for (let v = 25; v <= 99; v++) {
      const h = hsl(ratingColor(v)).h
      expect(h).toBeGreaterThanOrEqual(prev)
      prev = h
    }
  })
  it('clamps out-of-range values (old leagues)', () => {
    expect(ratingColor(10)).toBe(ratingColor(25))
    expect(ratingColor(120)).toBe(ratingColor(99))
  })
})

describe('ratingTextColor', () => {
  const hslToRgb = (h: number, s: number, l: number) => {
    s /= 100; l /= 100
    const k = (n: number) => (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return [f(0), f(8), f(4)].map((x) => x * 255)
  }
  const lum = ([r, g, b]: number[]) => {
    const c = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
  }
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  it('keeps pill text readable (WCAG AA 4.5:1) at every rating', async () => {
    const { ratingPillBg, ratingTextColor } = await import('../../src/ui/ratingColor')
    for (let v = 40; v <= 99; v++) {
      const m = ratingPillBg(v).match(/hsl\((\d+), (\d+)%, (\d+)%\)/)!
      const bg = lum(hslToRgb(+m[1], +m[2], +m[3]))
      const fg = lum(hex(ratingTextColor(v)))
      const ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)
      expect([v, ratio >= 4.5]).toEqual([v, true])
    }
  })
})
