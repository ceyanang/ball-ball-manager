import type { Rng } from '../rng'

export type Heritage = 'american' | 'african' | 'asian' | 'latino' | 'european'

/** Order = the 3-bit code stored in the low bits of a faceSeed. */
export const HERITAGES: readonly Heritage[] = ['american', 'african', 'asian', 'latino', 'european']

export const HERITAGE_WEIGHTS: Record<Heritage, number> = {
  american: 50, african: 12.5, asian: 12.5, latino: 12.5, european: 12.5,
}

/** Keeps the seed's high bits, stores the heritage code in the low 3 bits. Result is in [8, 2^31-1]. */
export function encodeHeritage(seed: number, h: Heritage): number {
  const hi = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) % 2 ** 31 : 0
  const out = (Math.floor(hi / 8) * 8) | HERITAGES.indexOf(h)
  return out < 8 ? out + 8 : out
}

/** Total: any number (even junk) maps to a valid heritage; unknown codes fall back to american. */
export function decodeHeritage(seed: number): Heritage {
  if (!Number.isFinite(seed)) return 'american'
  return HERITAGES[Math.floor(Math.abs(seed)) % 8] ?? 'american'
}

export function rollHeritage(rng: Rng): Heritage {
  return rng.weighted(HERITAGES, (h) => HERITAGE_WEIGHTS[h])
}
