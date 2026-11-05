import { createContext } from 'react'
import type { ConsoleSummary, NavItem, NavSection } from './lib/navigationModel'

export type NavigationContextValue = {
  sections: NavSection[]
  activeSection: NavSection | null
  activeItem: NavItem | null
  activeSectionItems: NavItem[]
  firstAllowedPath: string | null
  summary: ConsoleSummary | undefined
  badgeOf: (item: NavItem) => number
  reloadSummary: () => void
}

export const NavigationContext = createContext<NavigationContextValue | null>(null)
