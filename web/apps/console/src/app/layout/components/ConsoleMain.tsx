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
  const catalogImport = useMatch('/catalog/import')
  const isCatalogList = activeSection?.id === 'catalog' && Boolean((matchesItem && activeItem) || productDialog || catalogImport)
  const siteHome = useMatch('/site/home')
  const siteBanners = useMatch('/site/banners')
  const siteWorkspace = Boolean(siteHome || siteBanners)
  const compactHeader = isCatalogList || siteWorkspace
  return (
    <AppShell.Main id="main" data-section={activeSection?.id} data-site-workspace={siteWorkspace || undefined}>
      <div className="console-content">
        {compactHeader && <h1 className="visually-hidden">{catalogImport ? 'Імпорт товарів' : activeItem?.label}</h1>}
        {!dashboard && !compactHeader && <div className="console-page-title-row">
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
