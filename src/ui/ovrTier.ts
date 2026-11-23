export type OvrTier = 'dual' | 'purple' | 'gold' | 'silver' | 'bronze'

/** Portrait/badge tier: 95+ two-tone silver & gold, 90+ purple, 85+ gold, 75+ silver, everything below bronze. */
export function ovrTier(v: number): OvrTier {
  return v >= 95 ? 'dual' : v >= 90 ? 'purple' : v >= 85 ? 'gold' : v >= 75 ? 'silver' : 'bronze'
}
