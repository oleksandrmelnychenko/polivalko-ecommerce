import { Link } from 'react-router-dom'
import { useNavigation } from '@/features/navigation'
import { NavBadge } from './NavBadge'

export function ConsoleSectionTabs() {
  const { activeSection, activeSectionItems, activeItem, badgeOf } = useNavigation()

  if (!activeSection || activeSectionItems.length < 2) return null

  return (
    <nav className="console-section-tabs" aria-label={activeSection.label}>
      {activeSectionItems.map((item) => {
        const current = item.id === activeItem?.id
        return (
          <Link key={item.id} to={item.path} className={`console-section-tab${current ? ' is-active' : ''}`} aria-current={current ? 'page' : undefined}>
            <span>{item.label}</span>
            <NavBadge count={badgeOf(item)} tone={item.badgeTone} label={item.label} />
          </Link>
        )
      })}
    </nav>
  )
}
