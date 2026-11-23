import type { NeedLevel } from '../engine/gm/needs'

/** Numeric order for sorting a "Need" column: the most urgent position need sorts highest. */
export const NEED_RANK: Record<NeedLevel, number> = { red: 3, yellow: 2, green: 1 }
