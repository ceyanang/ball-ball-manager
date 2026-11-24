import type { Rng } from '../rng'

const NUMBERS = Array.from({ length: 100 }, (_, i) => i)

/**
 * How much players like a number. 1-10 are common; up to 35 the "clean" endings (0-5) win; past that it's rare, and
 * ugly endings (6-9) are rarer still. Outliers (a 78) still happen.
 */
function taste(n: number): number {
  if (n === 0) return 2
  if (n <= 10) return 10
  const clean = n % 10 <= 5
  if (n <= 35) return clean ? 6 : 1
  return clean ? 0.5 : 0.08
}

/** A jersey number 0-99 by player taste, never one in `taken`. */
export function pickJersey(rng: Rng, taken?: ReadonlySet<number>): number {
  return rng.weighted(NUMBERS, (n) => (taken?.has(n) ? 0 : taste(n)))
}
