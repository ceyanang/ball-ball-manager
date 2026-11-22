/** Continuous colour for a rating: dark red at 40 → orange → yellow → dark green at 99. */
export function ratingColor(v: number): string {
  const t = (Math.max(40, Math.min(99, v)) - 40) / 59
  const hue = Math.round(t * 130)
  const light = Math.round(32 + 16 * Math.sin(Math.PI * t)) // dark at both ends, brightest mid-scale
  return `hsl(${hue}, 70%, ${light}%)`
}
