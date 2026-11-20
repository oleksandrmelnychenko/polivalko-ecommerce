import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'
import { useNavigation } from '@/features/navigation'
import { PageHeaderActionsSlot, PageHeaderTitleSlot } from '@/shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleSectionTabs } from './ConsoleSectionTabs'

export function ConsoleMain({ children, dashboard }: PropsWithChildren<{ dashboard: boolean }>) {
  const { activeItem, activeSection } = useNavigation()
  return (
    <AppShell.Main id="main">
      <div className="console-content">
        {!dashboard && <div className="console-page-title-row">
          <PageHeaderTitleSlot className="console-header-page-title" />
          <h1 className="console-heading-fallback">{activeItem?.label ?? activeSection?.label ?? 'Консоль'}</h1>
        </div>}
        <div className="console-page-toolbar">
          <ConsoleSectionTabs />
          {!dashboard && <PageHeaderActionsSlot className="console-header-page-actions" />}
        </div>
        <div className="console-frame">{children}</div>
      </div>
    </AppShell.Main>
  )
}
