import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'
import { useMatch } from 'react-router-dom'
import { useNavigation } from '@/features/navigation'
import { PageHeaderActionsSlot, PageHeaderTitleSlot } from '@/shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleSectionTabs } from './ConsoleSectionTabs'

export function ConsoleMain({ children, dashboard }: PropsWithChildren<{ dashboard: boolean }>) {
  const { activeItem, activeSection } = useNavigation()
  const matchesItem = useMatch(activeItem?.path ?? '/')
  const productDialog = useMatch('/catalog/products/:id')
  const isCatalogList = activeSection?.id === 'catalog' && Boolean((matchesItem && activeItem) || productDialog)
  return (
    <AppShell.Main id="main" data-section={activeSection?.id}>
      <div className="console-content">
        {isCatalogList && <h1 className="visually-hidden">{activeItem?.label}</h1>}
        {!dashboard && !isCatalogList && <div className="console-page-title-row">
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
