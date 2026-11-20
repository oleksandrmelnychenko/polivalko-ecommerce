import { ActionIcon, AppShell, Burger, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconExternalLink } from '@tabler/icons-react'
import { SearchButton } from '@/features/search'
import { siteUrl } from '@/shared/lib/siteUrl'
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
          <SearchButton compact />
          <Tooltip label="Відкрити вітрину в новій вкладці">
            <ActionIcon component="a" href={siteUrl('/')} target="_blank" rel="noopener noreferrer" variant="subtle" color="gray" size={36} aria-label="Відкрити вітрину в новій вкладці">
              <IconExternalLink size={18} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
      <ConsoleMobileNav opened={menuOpened} onClose={menu.close} />
    </AppShell.Header>
  )
}
