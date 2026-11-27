/** Navigation model shared by the desktop sidebar, sub-nav strips, and mobile tab bar + "More" sheet. */
export type IconName =
  | 'home' | 'inbox' | 'team' | 'rotation' | 'office' | 'calendar' | 'trophy' | 'chart'
  | 'star' | 'medal' | 'chat' | 'history' | 'grid' | 'save' | 'more' | 'sun' | 'play' | 'close'

export type NavItem = { to: string; label: string; icon: IconName; match?: string[] }

export const HOME: NavItem = { to: '/', label: 'Home', icon: 'home', match: ['/'] }
export const INBOX: NavItem = { to: '/inbox', label: 'Inbox', icon: 'inbox', match: ['/inbox', '/events'] }
export const ROSTER: NavItem = { to: '/roster', label: 'Roster', icon: 'team', match: ['/roster'] }
export const ROTATIONS: NavItem = { to: '/my-team', label: 'Rotations', icon: 'rotation', match: ['/my-team'] }
export const OFFICE: NavItem = { to: '/office', label: 'Front Office', icon: 'office', match: ['/office', '/trade', '/trade-finder', '/free-agents', '/draft'] }
export const SCHEDULE: NavItem = { to: '/schedule', label: 'Schedule', icon: 'calendar', match: ['/schedule', '/game'] }
export const STANDINGS: NavItem = { to: '/standings', label: 'Standings', icon: 'trophy', match: ['/standings'] }
export const PLAYOFFS: NavItem = { to: '/playoffs', label: 'Playoffs', icon: 'trophy', match: ['/playoffs'] }
export const LEADERS: NavItem = { to: '/leaders', label: 'Leaders', icon: 'chart', match: ['/leaders'] }
export const ALL_STAR: NavItem = { to: '/all-star', label: 'All-Star', icon: 'medal', match: ['/all-star'] }
export const HIGHLIGHTS: NavItem = { to: '/highlights', label: 'Highlights', icon: 'star', match: ['/highlights'] }
export const SOCIAL: NavItem = { to: '/social', label: 'Social', icon: 'chat', match: ['/social'] }
export const HISTORY: NavItem = { to: '/history', label: 'History', icon: 'history', match: ['/history'] }
export const TEAMS: NavItem = { to: '/teams', label: 'Teams', icon: 'grid', match: ['/teams', '/team'] }
export const EVENTS: NavItem = { to: '/events', label: 'Events', icon: 'star', match: ['/events'] }
export const SAVES: NavItem = { to: '/saves', label: 'Saves', icon: 'save', match: ['/saves', '/new'] }
export const OFFSEASON: NavItem = { to: '/offseason', label: 'Offseason', icon: 'sun', match: ['/offseason'] }

/** Grouped destinations for the desktop sidebar. */
export const SIDEBAR_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'My Team', items: [HOME, INBOX, ROSTER, ROTATIONS, OFFICE] },
  { title: 'League', items: [STANDINGS, PLAYOFFS, SCHEDULE, LEADERS, TEAMS, HIGHLIGHTS, SOCIAL] },
  { title: 'Archive & App', items: [ALL_STAR, HISTORY, SAVES] },
]

/** Flat list of every primary sidebar destination. */
export const SIDEBAR: NavItem[] = SIDEBAR_GROUPS.flatMap((g) => g.items)

/** Sub-navigation strips shared on desktop and mobile so related pages stay 1 tap apart. */
export const TEAM_SUBNAV: NavItem[] = [
  { ...ROSTER, label: 'Roster & Search' },
  { ...ROTATIONS, label: 'Rotation & Contracts' },
]

export const LEAGUE_SUBNAV: NavItem[] = [
  STANDINGS,
  PLAYOFFS,
  SCHEDULE,
  LEADERS,
  TEAMS,
]

/** Mobile bottom bar: four everyday hubs + More. Labels stay short so they fit cleanly under the icon. */
export const TABS: (NavItem & { match: string[] })[] = [
  { ...HOME, match: ['/'] },
  { ...ROSTER, label: 'Team', match: ['/roster', '/my-team'] },
  { ...STANDINGS, label: 'League', match: ['/standings', '/playoffs', '/schedule', '/leaders', '/teams', '/team'] },
  { ...OFFICE, label: 'Office', match: ['/office', '/trade', '/trade-finder', '/free-agents', '/draft', '/offseason'] },
]

/** Everything outside the bottom bar, grouped cleanly in the mobile "More" sheet. */
export const MORE_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'Team & Inbox', items: [INBOX, ROTATIONS, EVENTS] },
  { title: 'League & Buzz', items: [SCHEDULE, LEADERS, TEAMS, HIGHLIGHTS, SOCIAL] },
  { title: 'Season & App', items: [PLAYOFFS, ALL_STAR, HISTORY, SAVES] },
]

export function matchesNav(path: string, item: NavItem): boolean {
  const list = item.match ?? [item.to]
  return list.some((m) => (m === '/' ? path === '/' : path === m || path.startsWith(m + '/')))
}

/** Which mobile tab owns this path: a tab's `to`, or 'more' for anything else. */
export function activeTab(path: string): string {
  for (const t of TABS) {
    if (matchesNav(path, t)) return t.to
  }
  return 'more'
}

/** MyCareer hides the GM-only destinations; everything that just shows the league stays. */
const GM_ONLY = new Set(['/office', '/trade', '/trade-finder', '/free-agents', '/draft', '/offseason'])
export const isGmPath = (path: string): boolean => [...GM_ONLY].some((g) => path === g || path.startsWith(g + '/'))
export const withoutGm = <T extends { to: string }>(items: T[]): T[] => items.filter((i) => !GM_ONLY.has(i.to))
export const withoutGmGroups = (groups: { title: string; items: NavItem[] }[]) =>
  groups.map((g) => ({ ...g, items: withoutGm(g.items) })).filter((g) => g.items.length > 0)
