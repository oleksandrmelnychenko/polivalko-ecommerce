import { AppShell } from '@mantine/core'
import { Outlet } from 'react-router-dom'
import { NavigationProvider } from '@/features/navigation'
import { SearchPalette } from '@/features/search'
import { PageHeaderActionsProvider } from '@/shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleHeader } from './components/ConsoleHeader'
import { ConsoleMain } from './components/ConsoleMain'
import './layout.css'

export function ConsoleLayout() {
  return (
    <NavigationProvider>
      <PageHeaderActionsProvider>
        <AppShell header={{ height: 108 }} padding={0}>
          <ConsoleHeader />
          <ConsoleMain>
            <Outlet />
          </ConsoleMain>
        </AppShell>
        <SearchPalette />
      </PageHeaderActionsProvider>
    </NavigationProvider>
  )
}
