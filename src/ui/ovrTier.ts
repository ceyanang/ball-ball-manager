export type OvrTier = 'blackgold' | 'blacksilver' | 'prismatic' | 'red' | 'diamond' | 'purple' | 'gold' | 'silver' | 'bronze'

/** Portrait/badge tier, 97+ black & gold, 95+ black & silver, 93+ prismatic, 90+ red, 85+ diamond, 80+ purple, 75+ gold, 70+ silver, below 70 bronze. */
export function ovrTier(v: number): OvrTier {
  return v >= 97 ? 'blackgold' : v >= 95 ? 'blacksilver' : v >= 93 ? 'prismatic' : v >= 90 ? 'red' : v >= 85 ? 'diamond' : v >= 80 ? 'purple' : v >= 75 ? 'gold' : v >= 70 ? 'silver' : 'bronze'
}
