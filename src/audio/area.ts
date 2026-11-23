export type MusicArea = 'menu' | 'office' | 'match'

const OFFICE = ['/office', '/trade', '/trade-finder', '/free-agents', '/draft', '/offseason']

/** Which music bed belongs to the current screen. Watching a game always wins. */
export function areaFor(pathname: string, watching: boolean): MusicArea {
  if (watching) return 'match'
  return OFFICE.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? 'office' : 'menu'
}
