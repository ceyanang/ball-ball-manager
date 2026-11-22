export const SKIN = ['#fde3cf', '#f6d1b1', '#eebf98', '#e0a878', '#d39565', '#c08152', '#a86b40', '#8d5532', '#744427', '#5e351f', '#4a2a18', '#3a2113']
export const EYE = ['#4a2c17', '#2b1a0e', '#7a5a2a', '#3d6fa8', '#4f7d45']
export const HAIR = ['#1a1412', '#3b2416', '#5c3a21', '#8a6038', '#d8b46a', '#a5442a', '#6e2c1a', '#e8e0d0']
const GREY = '#c9c7c2'

export function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  const c = [1, 3, 5].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}
export const greyed = (hex: string, grey: number) => mix(hex, GREY, grey)
export const shade = (hex: string, t: number) => mix(hex, '#000000', t)
