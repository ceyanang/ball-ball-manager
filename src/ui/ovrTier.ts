export type OvrTier = 'blackgold' | 'prismatic' | 'red' | 'diamond' | 'purple' | 'gold' | 'silver' | 'bronze'

/** Portrait/badge tier, 96+ black & gold, 93+ prismatic, 90+ red, 85+ diamond, 80+ purple, 75+ gold, 70+ silver, below 70 bronze. */
export function ovrTier(v: number): OvrTier {
  return v >= 96 ? 'blackgold' : v >= 93 ? 'prismatic' : v >= 90 ? 'red' : v >= 85 ? 'diamond' : v >= 80 ? 'purple' : v >= 75 ? 'gold' : v >= 70 ? 'silver' : 'bronze'
}
