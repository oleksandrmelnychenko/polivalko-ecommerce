import { Link } from 'react-router-dom'
import { useNavigation, type NavSection } from '@/features/navigation'
import { NavBadge } from './NavBadge'

export function ConsoleSectionNav() {
  const { sections, activeSection, badgeOf } = useNavigation()

  if (sections.length === 0) return null

  return (
    <nav className="console-section-nav" aria-label="Розділи консолі">
      {sections.map((section) => (
        <SectionLink key={section.id} section={section} active={section.id === activeSection?.id} badgeOf={badgeOf} />
      ))}
    </nav>
  )
}

type SectionLinkProps = {
  section: NavSection
  active: boolean
  badgeOf: ReturnType<typeof useNavigation>['badgeOf']
}

function SectionLink({ section, active, badgeOf }: SectionLinkProps) {
  const first = section.items[0]
  if (!first) return null

  const total = section.items.reduce((sum, item) => sum + badgeOf(item), 0)
  const tone = section.items.some((item) => item.badgeTone === 'bad' && badgeOf(item) > 0) ? 'bad' : 'hot'

  return (
    <Link to={first.path} className={`console-section-pill${active ? ' is-active' : ''}`} aria-current={active ? 'true' : undefined}>
      <span>{section.label}</span>
      <NavBadge count={total} tone={tone} />
    </Link>
  )
}
