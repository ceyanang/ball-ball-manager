/** Colour helpers for team badges and dots: WCAG contrast and "do these two colours look alike". */

type Rgb = [number, number, number]

function rgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Badge text colour: the team's secondary on its primary when that reads (3:1), else white or black, whichever is clearer. */
export function badgeInk(colors: { primary: string; secondary: string }): string {
  if (contrastRatio(colors.primary, colors.secondary) >= 3) return colors.secondary
  return contrastRatio(colors.primary, '#ffffff') >= contrastRatio(colors.primary, '#000000') ? '#ffffff' : '#000000'
}

/** Rough perceptual distance ("redmean") between two colours, 0 to ~765. */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b)
  const rm = (r1 + r2) / 2
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2)
}

/** A colour for this team that doesn't look like `other`: its primary, or its secondary when the primaries clash. */
export function distinctColor(colors: { primary: string; secondary: string }, other: string): string {
  if (distance(colors.primary, other) >= 150) return colors.primary
  return distance(colors.secondary, other) > distance(colors.primary, other) ? colors.secondary : colors.primary
}
