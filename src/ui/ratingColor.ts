/** Continuous colour for a rating: dark red at 40 → orange → yellow → dark green at 99. */
export function ratingColor(v: number): string {
  const t = (Math.max(40, Math.min(99, v)) - 40) / 59
  const hue = Math.round(t * 130)
  const light = Math.round(29 + 19 * Math.sin(Math.PI * t)) // dark at both ends, brightest mid-scale
  return `hsl(${hue}, 70%, ${light}%)`
}

function luminanceOf(css: string): number {
  const m = css.match(/hsl\((\d+), (\d+)%, (\d+)%\)/)!
  const [h, s, l] = [+m[1], +m[2] / 100, +m[3] / 100]
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const ch = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(ch(0)) + 0.7152 * lin(ch(8)) + 0.0722 * lin(ch(4))
}

const DARK_LUM = 0.0056 // #111111
const contrastWhite = (bg: number) => 1.05 / (bg + 0.05)
const contrastDark = (bg: number) => (bg + 0.05) / (DARK_LUM + 0.05)

/**
 * Background for an OVR pill: ratingColor(v), lightened just enough (same hue) that white or dark text
 * reaches WCAG AA 4.5:1.
 */
export function ratingPillBg(v: number): string {
  const m = ratingColor(v).match(/hsl\((\d+), (\d+)%, (\d+)%\)/)!
  for (let l = +m[3]; l <= 80; l++) {
    const css = `hsl(${m[1]}, ${m[2]}%, ${l}%)`
    const bg = luminanceOf(css)
    if (contrastWhite(bg) >= 4.5 || contrastDark(bg) >= 4.5) return css
  }
  return `hsl(${m[1]}, ${m[2]}%, 80%)`
}

/** Dark or white text, whichever reads better on ratingPillBg(v). */
export function ratingTextColor(v: number): string {
  const bg = luminanceOf(ratingPillBg(v))
  return contrastWhite(bg) >= contrastDark(bg) ? '#ffffff' : '#111111'
}
