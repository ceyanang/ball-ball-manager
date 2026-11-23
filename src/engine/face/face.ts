import { Rng } from '../rng'

export interface FaceSpec {
  head: number; skin: number; ears: number; eyes: number; eyeColor: number; brows: number
  nose: number; mouth: number; hair: number; hairColor: number; facialHair: number; accessory: number
  /** 0..1 */ grey: number
  /** 0..1 */ recede: number
}

type VariantKey = Exclude<keyof FaceSpec, 'grey' | 'recede'>

/** The original variant counts. Their draws stay first and unchanged, so existing players keep their look. */
const BASE_VARIANTS: { [K in VariantKey]: number } = {
  head: 6, skin: 12, ears: 3, eyes: 8, eyeColor: 5, brows: 6, nose: 8, mouth: 8,
  hair: 18, hairColor: 8, facialHair: 11, accessory: 11,
}

export const FACE_VARIANTS: { [K in VariantKey]: number } = {
  head: 8, skin: 12, ears: 3, eyes: 8, eyeColor: 8, brows: 8, nose: 9, mouth: 10,
  hair: 22, hairColor: 12, facialHair: 14, accessory: 14,
}

/** Uses its own RNG seeded from `seed`; never touches the league RNG. */
export function generateFace(seed: number): FaceSpec {
  const rng = Rng.fromSeed(seed)
  const any = (k: VariantKey) => rng.int(0, BASE_VARIANTS[k] - 1)
  const nonZero = (k: VariantKey) => rng.int(1, BASE_VARIANTS[k] - 1)
  const base: FaceSpec = {
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
  // The newer parts come from a separate stream so they never shift the draws above.
  const extra = Rng.fromSeed((seed ^ 0x5bd1e995) >>> 0)
  const out = { ...base }
  for (const k of Object.keys(BASE_VARIANTS) as VariantKey[]) {
    if (FACE_VARIANTS[k] === BASE_VARIANTS[k]) continue
    const roll = extra.chance(k === 'hairColor' ? 0.12 : k === 'accessory' || k === 'facialHair' ? 0.2 : 0.3)
    const pick = extra.int(BASE_VARIANTS[k], FACE_VARIANTS[k] - 1)
    if (!roll) continue
    // Don't turn "none" into something for hair/facial hair/accessory; only swap an existing choice.
    if ((k === 'hair' || k === 'facialHair' || k === 'accessory') && base[k] === 0) continue
    out[k] = pick
  }
  return out
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
