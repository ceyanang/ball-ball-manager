export type OvrTier = 'prismatic' | 'red' | 'diamond' | 'purple' | 'gold' | 'silver' | 'bronze'

/** Portrait/badge tier: 95+ prismatic, 90-94 red, 86-89 diamond, 81-85 purple, 76-80 gold, 70-75 silver, below 70 bronze. */
export function ovrTier(v: number): OvrTier {
  return v >= 95 ? 'prismatic' : v >= 90 ? 'red' : v >= 86 ? 'diamond' : v >= 81 ? 'purple' : v >= 76 ? 'gold' : v >= 70 ? 'silver' : 'bronze'
}
