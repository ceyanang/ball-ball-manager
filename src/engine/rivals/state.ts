/**
 * Rivalry state saved on the League. `heat` is per team pair (see `pairKey`), `dynamic` the up-to-2 heat-driven rivals
 * each team locked in at season rollover, `showing` this season's good rival-game performances by new players, and
 * `met` the pairs that played a playoff series this season (so cooling is gentler for them).
 */
export interface RivalryState { heat: Record<string, number>; dynamic: Record<string, string[]>; showing: Record<string, number>; met: string[] }

export const emptyRivalry = (): RivalryState => ({ heat: {}, dynamic: {}, showing: {}, met: [] })
