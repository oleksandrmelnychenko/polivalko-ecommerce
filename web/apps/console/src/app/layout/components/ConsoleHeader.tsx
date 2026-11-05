import { ActionIcon, AppShell, Burger, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconExternalLink } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { SearchButton } from '@/features/search'
import { siteUrl } from '@/shared/lib/siteUrl'
import { PageHeaderActionsSlot, PageHeaderTitleSlot } from '@/shared/ui/page-header-actions/PageHeaderActions'
import { ConsoleAccountMenu } from './ConsoleAccountMenu'
import { ConsoleMobileNav } from './ConsoleMobileNav'
import { ConsoleSectionNav } from './ConsoleSectionNav'
import { ConsoleSectionTabs } from './ConsoleSectionTabs'

export function ConsoleHeader() {
  const [menuOpened, menu] = useDisclosure(false)

  return (
    <AppShell.Header className="console-header">
      <div className="console-header-main">
        <div className="console-header-brand">
          <Burger className="console-burger" opened={menuOpened} onClick={menu.toggle} size="sm" aria-label="Відкрити меню розділів" />
          <Link to="/" className="console-brand" aria-label="PoliValko — консоль, на головну">
            <span className="console-brand-word" translate="no">
              PoliValko
            </span>
            <span className="console-brand-tag">консоль</span>
          </Link>
        </div>

        <div className="console-header-top-nav">
          <ConsoleSectionNav />
        </div>

        <div className="console-header-tools">
          <SearchButton />
          <Tooltip label="Відкрити вітрину в новій вкладці">
            <ActionIcon component="a" href={siteUrl('/')} target="_blank" rel="noopener noreferrer" variant="subtle" color="gray" size={36} aria-label="Відкрити вітрину в новій вкладці">
              <IconExternalLink size={18} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
          <ConsoleAccountMenu />
        </div>

        <PageHeaderTitleSlot className="console-header-page-title" />

        <div className="console-header-tabs">
          <ConsoleSectionTabs />
        </div>

        <PageHeaderActionsSlot className="console-header-page-actions" />
      </div>
      <ConsoleMobileNav opened={menuOpened} onClose={menu.close} />
    </AppShell.Header>
  )
}
