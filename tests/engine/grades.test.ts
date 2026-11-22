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
  it('is dark red at 40 and dark green at 99', () => {
    const lo = hsl(ratingColor(40)), hi = hsl(ratingColor(99))
    expect(lo.h).toBe(0)
    expect(lo.l).toBeLessThanOrEqual(35)
    expect(hi.h).toBeGreaterThanOrEqual(120)
    expect(hi.l).toBeLessThanOrEqual(35)
  })
  it('is brighter in the middle and hue never decreases', () => {
    expect(hsl(ratingColor(70)).l).toBeGreaterThan(hsl(ratingColor(40)).l)
    let prev = -1
    for (let v = 40; v <= 99; v++) {
      const h = hsl(ratingColor(v)).h
      expect(h).toBeGreaterThanOrEqual(prev)
      prev = h
    }
  })
  it('clamps out-of-range values (old leagues)', () => {
    expect(ratingColor(10)).toBe(ratingColor(40))
    expect(ratingColor(120)).toBe(ratingColor(99))
  })
})
