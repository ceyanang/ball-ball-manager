import { Rng } from '../rng'
import { decodeHeritage } from './heritage'
import { eyeColorWeights, eyeWeights, facialHairWeights, hairColorWeights, hairWeights, skinWeights, type W } from './tables'

export interface FaceSpec {
  head: number; skin: number; ears: number; eyes: number; eyeColor: number; brows: number
  nose: number; mouth: number; hair: number; hairColor: number; facialHair: number; accessory: number
  /** 0..1 */ grey: number
  /** 0..1 */ recede: number
}

type VariantKey = Exclude<keyof FaceSpec, 'grey' | 'recede'>

export const FACE_VARIANTS: { [K in VariantKey]: number } = {
  head: 8, skin: 12, ears: 3, eyes: 11, eyeColor: 8, brows: 8, nose: 11, mouth: 12,
  hair: 46, hairColor: 12, facialHair: 14, accessory: 14,
}

/** Uses its own RNG seeded from `seed`; never touches the league RNG. Heritage is read from the seed's low bits. */
export function generateFace(seed: number): FaceSpec {
  const rng = Rng.fromSeed(seed)
  const h = decodeHeritage(seed)
  const n = (k: VariantKey) => FACE_VARIANTS[k]
  const any = (k: VariantKey) => rng.int(0, n(k) - 1)
  const pick = (k: VariantKey, t: W): number => {
    const items = Array.from({ length: n(k) }, (_, i) => i)
    const wt = (i: number) => t.map[i] ?? t.rest ?? 0
    if (items.every((i) => wt(i) <= 0)) return any(k)
    return rng.weighted(items, wt)
  }
  const head = any('head')
  const skin = pick('skin', skinWeights(h))
  const ears = any('ears')
  const eyes = pick('eyes', eyeWeights(h, skin))
  const eyeColor = pick('eyeColor', eyeColorWeights(h, skin))
  const brows = any('brows')
  const nose = any('nose')
  const mouth = any('mouth')
  const bald = rng.chance(0.06)
  const hair = pick('hair', hairWeights(h, skin, head))
  const hairColor = pick('hairColor', hairColorWeights(h, skin))
  const noFacial = rng.chance(0.5)
  const facialHair = pick('facialHair', facialHairWeights(h))
  const noAcc = rng.chance(0.7)
  const accessory = rng.int(1, n('accessory') - 1)
  return {
    head, skin, ears, eyes, eyeColor, brows, nose, mouth,
    hair: bald ? 0 : hair,
    hairColor,
    facialHair: noFacial ? 0 : facialHair,
    accessory: noAcc ? 0 : accessory,
    grey: 0,
    recede: 0,
  }
}

/** Deterministic aging: greying after 30, receding (for ~half of players) after a per-seed onset. */
export function ageFace(spec: FaceSpec, seed: number, age: number): FaceSpec {
  const rng = Rng.fromSeed((seed ^ 0x9e3779b9) >>> 0)
  const greyMax = rng.float(0.3, 1)
  const recedes = rng.chance(0.5)
  const onset = rng.int(28, 36)
  const grey = age <= 30 ? 0 : Math.min(greyMax, (greyMax * (age - 30)) / 8)
  const recede = !recedes || age <= onset ? 0 : Math.min(1, (age - onset) / 6)
  return { ...spec, grey, recede }
}
