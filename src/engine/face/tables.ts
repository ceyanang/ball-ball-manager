import type { Heritage } from './heritage'

/** Sparse weights by variant index. Unlisted indices get `rest` (default 0 = never picked). */
export interface W { map: Record<number, number>; rest?: number }

const w = (map: Record<number, number>, rest = 0): W => ({ map, rest })

/** Skin tone indices run 0 (lightest) .. 11 (darkest). */
export function skinWeights(h: Heritage): W {
  switch (h) {
    case 'european': return w({ 0: 3, 1: 5, 2: 5, 3: 3.5, 4: 1, 5: 0.3 })
    case 'asian': return w({ 0: 3, 1: 5, 2: 5, 3: 3, 4: 2, 5: 0.4, 6: 0.2 })
    case 'latino': return w({ 0: 0.3, 1: 1.5, 2: 4, 3: 5, 4: 5, 5: 3.5, 6: 2, 7: 0.7, 8: 0.25 })
    case 'african': return w({ 5: 0.3, 6: 0.6, 7: 3, 8: 5, 9: 5, 10: 4, 11: 3 })
    default: return w({ 0: 1, 1: 2, 2: 3, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 3, 10: 2, 11: 1 })
  }
}

// Hair index guide: 22 bowl, 23 curtains, 24 undercut, 25 textured crop, 26 slick-back, 27 high-top, 28 waves, 29 short twists,
// 30 taper + curly top, 31 pompadour, 32 side part, 33 half-up bun, 34 curly top, 35 long wavy. Older art: 1-2 short, 3 flat-top, 4-5 afro, 6 curls, 7 waves, 8 lined fade, 9 mohawk, 10 top-knot,
// 11 long, 12 twists, 13 cornrows/braids, 14 side-swept, 15 spiky, 16 tall box, 17 receded sides, 18 bun, 19 long straight, 20 locs, 21 swoop.
const HAIR_TEXTURED = w({ 24: 1.5, 25: 0.5, 26: 1, 27: 4, 28: 5, 29: 3, 30: 4, 34: 1, 1: 5, 2: 4, 3: 2, 4: 3, 5: 2, 6: 3, 7: 3, 8: 5, 9: 0.5, 11: 0.4, 12: 4, 13: 5, 14: 0.5, 16: 4, 20: 4, 21: 1 })
const HAIR_STRAIGHT_ASIAN = w({ 22: 3, 23: 4, 24: 4, 25: 4, 26: 3, 1: 6, 2: 6, 3: 2, 7: 1, 8: 3, 9: 0.5, 10: 2, 11: 1, 14: 5, 15: 2, 16: 1, 17: 1, 18: 1, 19: 1, 21: 4 })
const HAIR_LATINO = w({ 24: 2, 25: 2, 26: 3, 28: 1, 30: 1, 31: 3, 32: 1, 34: 1.5, 1: 4, 2: 5, 3: 1, 4: 0.15, 6: 0.6, 7: 4, 8: 3, 10: 1, 11: 2, 12: 0.2, 13: 0.3, 14: 4, 15: 1, 16: 1, 18: 1, 19: 1.5, 20: 0.1, 21: 4 })
const HAIR_EUROPEAN = w({ 23: 2, 24: 3, 25: 3, 26: 2, 31: 1.5, 32: 5, 33: 2, 34: 2.5, 35: 2, 1: 3, 2: 5, 3: 2, 6: 2, 7: 2, 8: 1, 9: 1, 10: 2, 11: 2, 14: 5, 15: 2, 16: 1, 17: 1, 18: 1.5, 19: 2, 21: 4 })

const blend = (a: W, b: W, t: number): W => {
  const keys = new Set([...Object.keys(a.map), ...Object.keys(b.map)].map(Number))
  const map: Record<number, number> = {}
  for (const k of keys) map[k] = (a.map[k] ?? 0) * (1 - t) + (b.map[k] ?? 0) * t
  return { map, rest: 0 }
}

/** Hair depends on heritage and (for american) on skin tone: darker skin leans toward textured styles. */
export function hairWeights(h: Heritage, skin: number): W {
  switch (h) {
    case 'african': return HAIR_TEXTURED
    case 'asian': return HAIR_STRAIGHT_ASIAN
    case 'latino': return HAIR_LATINO
    case 'european': return HAIR_EUROPEAN
    default:
      if (skin >= 8) return blend(HAIR_TEXTURED, HAIR_EUROPEAN, 0.1)
      if (skin >= 6) return blend(HAIR_TEXTURED, HAIR_LATINO, 0.4)
      if (skin >= 4) return blend(HAIR_LATINO, HAIR_EUROPEAN, 0.5)
      return blend(HAIR_EUROPEAN, HAIR_TEXTURED, 0.04)
  }
}

/** Natural colours are 0-6; 8-11 are dyes (~2% total). */
const DYES = { 8: 0.5, 9: 0.5, 10: 0.5, 11: 0.5 }
export function hairColorWeights(h: Heritage, skin: number): W {
  const dark = h === 'african' || h === 'asian' || h === 'latino' || (h === 'american' && skin >= 7)
  if (dark) return w({ 0: 85, 1: 12, ...DYES })
  if (h === 'european') return w({ 0: 20, 1: 25, 2: 18, 3: 14, 4: 12, 5: 6, 6: 5, ...DYES })
  return w({ 0: 35, 1: 25, 2: 15, 3: 8, 4: 6, 5: 5, 6: 4, ...DYES })
}

/** Eye colours: 0-1 dark brown, 2 hazel, 3 blue, 4 green, 5 grey, 6 amber, 7 teal. */
export function eyeColorWeights(h: Heritage, skin: number): W {
  if (h === 'african' || h === 'asian' || (h === 'american' && skin >= 7)) return w({ 0: 6, 1: 6, 2: 0.5, 6: 0.5 })
  if (h === 'latino') return w({ 0: 6, 1: 5, 2: 2, 6: 1, 4: 0.3, 3: 0.2 })
  if (h === 'european') return w({ 0: 3, 1: 1, 2: 2, 3: 4, 4: 3, 5: 2, 6: 1, 7: 0.5 })
  return w({ 0: 5, 1: 4, 2: 2, 3: 2, 4: 1.5, 5: 1, 6: 1, 7: 0.4 })
}

/** Eye shapes. Asian: slightly narrower / sharper / gently upturned; never the closed-arc "line" eye (6). */
export function eyeWeights(h: Heritage, skin = 0): W {
  // Dot eyes (1) and closed arcs (6) disappear into the darkest skin tones, so keep them off those faces.
  const dark: Record<number, number> = skin >= 9 ? { 1: 0, 6: 0 } : {}
  if (h === 'asian') return w({ 0: 2, 1: 1, 2: 1.5, 3: 1.5, 4: 0.3, 5: 2, 7: 0.2, 8: 4, 9: 3, 10: 0.5, ...dark })
  return w({ 8: 0.3, 9: 0.15, ...dark }, 1)
}

/** Facial hair style weights: identical for every heritage (none is skewed toward moustache/goatee looks). Index 0 = none, handled in generateFace. */
export function facialHairWeights(_h: Heritage): W {
  return w({ 0: 0 }, 1)
}
