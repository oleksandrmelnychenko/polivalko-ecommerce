import { useEffect, useRef } from 'react'
import { Link, useMatch } from 'react-router-dom'
import { useNavigation } from '@/features/navigation'
import { NavBadge } from './NavBadge'

export function ConsoleSectionTabs() {
  const { activeSection, activeSectionItems, activeItem, badgeOf } = useNavigation()
  const onCatalogImport = Boolean(useMatch('/catalog/import'))
  const currentId = onCatalogImport ? 'products' : activeItem?.id
  const activeLink = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!activeSection || !['catalog', 'site', 'sales', 'settings', 'system'].includes(activeSection.id)) return
    const link = activeLink.current
    const nav = link?.parentElement
    if (!link || !nav) return

    const revealActiveLink = () => {
      const item = link.getBoundingClientRect()
      const strip = nav.getBoundingClientRect()
      if (item.left < strip.left + 5) nav.scrollLeft += item.left - strip.left - 5
      else if (item.right > strip.right - 5) nav.scrollLeft += item.right - strip.right + 5
    }
    const observer = new ResizeObserver(revealActiveLink)
    observer.observe(nav)
    revealActiveLink()
    return () => observer.disconnect()
  }, [activeSection, currentId, activeSectionItems.length])

  if (!activeSection || activeSectionItems.length < 2) return null

  return (
    <nav className="console-section-tabs" aria-label={activeSection.label}>
      {activeSectionItems.map((item) => {
        const current = item.id === currentId
        return (
          <Link key={item.id} ref={current ? activeLink : undefined} to={item.path} className={`console-section-tab${current ? ' is-active' : ''}`} aria-current={current ? (onCatalogImport ? 'location' : 'page') : undefined}>
            <span>{item.label}</span>
            <NavBadge count={badgeOf(item)} tone={item.badgeTone} label={item.label} />
          </Link>
        )
      })}
    </nav>
  )
}
