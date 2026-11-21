import { AppShell } from '@mantine/core'
import type { ReactNode } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import { NavigationProvider } from '@/features/navigation'
import { SearchPalette } from '@/features/search'
import { PageHeaderActionsProvider } from '@/shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleMain } from './components/ConsoleMain'
import { ConsoleSectionNav } from './components/ConsoleSectionNav'
import './layout.css'

export function ConsoleLayout({ overlay }: { overlay?: ReactNode }) {
  const dashboard = Boolean(useMatch('/'))
  return (
    <NavigationProvider>
      <PageHeaderActionsProvider>
        <AppShell header={{ height: { base: dashboard ? 104 : 60, sm: 68 } }} navbar={{ width: 236, breakpoint: '64em', collapsed: { mobile: true } }} padding={0}>
          <AppShell.Navbar className="console-sidebar">
            <p className="console-workspace-name">Консоль<br />магазину</p>
            <ConsoleSectionNav />
          </AppShell.Navbar>
          <ConsoleHeader dashboard={dashboard} />
          <ConsoleMain dashboard={dashboard}>
            <Outlet />
          </ConsoleMain>
        </AppShell>
        <SearchPalette />
        {overlay}
      </PageHeaderActionsProvider>
    </NavigationProvider>
  )
}
