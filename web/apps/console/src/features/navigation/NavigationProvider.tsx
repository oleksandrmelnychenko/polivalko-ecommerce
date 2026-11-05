import { useCallback, useEffect, useMemo, type PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { onConsoleEvent } from '@/shared/lib/events'
import { getSummary } from './api/summaryApi'
import { NavigationContext, type NavigationContextValue } from './NavigationContext'
import { findActive, isNavItemAllowed, NAV_SECTIONS, type NavItem, type NavSection } from './lib/navigationModel'

const SUMMARY_REFRESH_MS = 60_000

export function NavigationProvider({ children }: PropsWithChildren) {
  const { hasPermission, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const summaryQuery = useApiQuery('console-summary', () => getSummary(), { enabled: isAuthenticated })
  const reloadSummary = summaryQuery.reload

  useEffect(() => {
    if (!isAuthenticated) return undefined
    const timer = window.setInterval(reloadSummary, SUMMARY_REFRESH_MS)
    const off = onConsoleEvent('summary-stale', reloadSummary)
    return () => {
      window.clearInterval(timer)
      off()
    }
  }, [isAuthenticated, reloadSummary])

  const sections = useMemo<NavSection[]>(
    () =>
      NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => isNavItemAllowed(item, hasPermission)) })).filter(
        (section) => section.items.length > 0,
      ),
    [hasPermission],
  )

  const summary = summaryQuery.data
  const badgeOf = useCallback((item: NavItem) => (summary && item.badge ? Math.max(0, item.badge(summary)) : 0), [summary])

  const value = useMemo<NavigationContextValue>(() => {
    const active = findActive(NAV_SECTIONS, pathname)
    const visibleSection = active ? sections.find((section) => section.id === active.section.id) ?? null : null
    return {
      sections,
      activeSection: active?.section ?? null,
      activeItem: active?.item ?? null,
      activeSectionItems: visibleSection?.items ?? [],
      firstAllowedPath: sections[0]?.items[0]?.path ?? null,
      summary,
      badgeOf,
      reloadSummary,
    }
  }, [badgeOf, pathname, reloadSummary, sections, summary])

  return <NavigationContext value={value}>{children}</NavigationContext>
}
