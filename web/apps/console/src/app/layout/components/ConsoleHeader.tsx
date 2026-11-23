import { AppShell, Burger } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Can } from '@/features/auth'
import { StorefrontModeControl } from '@/features/storefront-mode'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeaderActionsSlot } from '@/shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleBrand } from './ConsoleBrand'
import { KyivClock } from './KyivClock'
import { ConsoleAccountMenu } from './ConsoleAccountMenu'
import { ConsoleMobileNav } from './ConsoleMobileNav'

export function ConsoleHeader({ dashboard }: { dashboard: boolean }) {
  const [menuOpened, menu] = useDisclosure(false)

  return (
    <AppShell.Header className="console-header">
      <div className="console-header-main">
        <div className="console-header-brand">
          <Burger className="console-burger" opened={menuOpened} onClick={menu.toggle} size="sm" aria-label="Відкрити меню розділів" />
          <ConsoleBrand />
        </div>
        <KyivClock />
        <ConsoleAccountMenu />
        {dashboard && <PageHeaderActionsSlot className="console-period-slot" />}
        <div className="console-header-tools">
          <Can permission={PermissionKeys.Catalog.ManageCollections}><StorefrontModeControl /></Can>
        </div>
      </div>
      <ConsoleMobileNav opened={menuOpened} onClose={menu.close} />
    </AppShell.Header>
  )
}
