import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'
import type { NavItem } from '../nav'

/** Compact horizontal sub-navigation strip for switching between related screens on mobile and desktop. */
export function SubNav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav className="subnav" aria-label={label}>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} className={({ isActive }) => `subnav-link${isActive ? ' active' : ''}`}>
          <Icon name={i.icon} size={16} />
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
