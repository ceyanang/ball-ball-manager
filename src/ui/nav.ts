/** Navigation model shared by the desktop sidebar and the mobile tab bar + "More" sheet. */
export type IconName =
  | 'home' | 'inbox' | 'team' | 'rotation' | 'office' | 'calendar' | 'trophy' | 'chart'
  | 'star' | 'chat' | 'history' | 'grid' | 'save' | 'more' | 'sun' | 'play' | 'close'

export type NavItem = { to: string; label: string; icon: IconName }

const HOME: NavItem = { to: '/', label: 'Home', icon: 'home' }
const INBOX: NavItem = { to: '/inbox', label: 'Inbox', icon: 'inbox' }
const ROSTER: NavItem = { to: '/roster', label: 'Roster', icon: 'team' }
const ROTATIONS: NavItem = { to: '/my-team', label: 'Rotations', icon: 'rotation' }
const OFFICE: NavItem = { to: '/office', label: 'Front Office', icon: 'office' }
const SCHEDULE: NavItem = { to: '/schedule', label: 'Schedule', icon: 'calendar' }
const STANDINGS: NavItem = { to: '/standings', label: 'Standings', icon: 'trophy' }
const LEADERS: NavItem = { to: '/leaders', label: 'Leaders', icon: 'chart' }
const ALL_STAR: NavItem = { to: '/all-star', label: 'All-Star', icon: 'star' }
const HIGHLIGHTS: NavItem = { to: '/highlights', label: 'Highlights', icon: 'star' }
const SOCIAL: NavItem = { to: '/social', label: 'Social', icon: 'chat' }
const HISTORY: NavItem = { to: '/history', label: 'History', icon: 'history' }
const TEAMS: NavItem = { to: '/teams', label: 'Teams', icon: 'grid' }
const SAVES: NavItem = { to: '/saves', label: 'Saves', icon: 'save' }
export const OFFSEASON: NavItem = { to: '/offseason', label: 'Offseason', icon: 'sun' }

/** Full list for the desktop sidebar. */
export const SIDEBAR: NavItem[] = [HOME, INBOX, ROSTER, ROTATIONS, OFFICE, SCHEDULE, STANDINGS, LEADERS, HIGHLIGHTS, ALL_STAR, SOCIAL, HISTORY, TEAMS, SAVES]

/** Mobile bottom bar: four destinations + More. Labels are short so they fit under the icon. */
export const TABS: (NavItem & { match: string[] })[] = [
  { ...HOME, match: ['/'] },
  { ...ROSTER, label: 'Team', match: ['/roster', '/my-team'] },
  { ...OFFICE, label: 'Office', match: ['/office', '/trade', '/trade-finder', '/free-agents', '/draft'] },
  { ...INBOX, match: ['/inbox'] },
]

/** Everything not on the tab bar, grouped, in the mobile "More" sheet. */
export const MORE_GROUPS: { title: string; items: NavItem[] }[] = [
  { title: 'My team', items: [ROTATIONS, SCHEDULE, SAVES] },
  { title: 'League', items: [STANDINGS, LEADERS, TEAMS] },
  { title: 'Stories', items: [HIGHLIGHTS, ALL_STAR, SOCIAL, HISTORY] },
]

/** Which mobile tab owns this path: a tab's `to`, or 'more' for anything else. */
export function activeTab(path: string): string {
  for (const t of TABS) {
    if (t.match.some((m) => (m === '/' ? path === '/' : path === m || path.startsWith(m + '/')))) return t.to
  }
  return 'more'
}
