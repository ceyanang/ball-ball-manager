import { Rng } from '../rng'

export interface FaceSpec {
  head: number; skin: number; ears: number; eyes: number; eyeColor: number; brows: number
  nose: number; mouth: number; hair: number; hairColor: number; facialHair: number; accessory: number
  /** 0..1 */ grey: number
  /** 0..1 */ recede: number
}

type VariantKey = Exclude<keyof FaceSpec, 'grey' | 'recede'>

export const FACE_VARIANTS: { [K in VariantKey]: number } = {
  head: 6, skin: 12, ears: 3, eyes: 8, eyeColor: 5, brows: 6, nose: 8, mouth: 8,
  hair: 18, hairColor: 8, facialHair: 11, accessory: 11,
}

/** Uses its own RNG seeded from `seed`; never touches the league RNG. */
export function generateFace(seed: number): FaceSpec {
  const rng = Rng.fromSeed(seed)
  const any = (k: VariantKey) => rng.int(0, FACE_VARIANTS[k] - 1)
  const nonZero = (k: VariantKey) => rng.int(1, FACE_VARIANTS[k] - 1)
  return {
    head: any('head'),
    skin: any('skin'),
    ears: any('ears'),
    eyes: any('eyes'),
    eyeColor: rng.chance(0.7) ? rng.int(0, 1) : any('eyeColor'),
    brows: any('brows'),
    nose: any('nose'),
    mouth: any('mouth'),
    hair: rng.chance(0.08) ? 0 : nonZero('hair'),
    hairColor: rng.chance(0.6) ? 0 : any('hairColor'),
    facialHair: rng.chance(0.5) ? 0 : nonZero('facialHair'),
    accessory: rng.chance(0.7) ? 0 : nonZero('accessory'),
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
