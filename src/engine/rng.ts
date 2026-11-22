/** Seeded PRNG (mulberry32). The state object is mutated in place so it can live in the save. */
export interface RngState {
  s: number
}

export class Rng {
  private st: RngState

  constructor(state: RngState) {
    this.st = state
  }

  static fromSeed(seed: number): Rng {
    return new Rng({ s: seed >>> 0 })
  }

  get state(): RngState {
    return this.st
  }

  next(): number {
    let t = (this.st.s = (this.st.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  normal(mean: number, sd: number): number {
    // no cached spare value, so the state is fully captured by `s`
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    let total = 0
    for (const it of items) total += Math.max(0, weight(it))
    let r = this.next() * total
    for (const it of items) {
      r -= Math.max(0, weight(it))
      if (r < 0) return it
    }
    return items[items.length - 1]
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  id(prefix: string): string {
    let out = prefix
    for (let i = 0; i < 8; i++) out += Math.floor(this.next() * 36).toString(36)
    return out
  }
}
