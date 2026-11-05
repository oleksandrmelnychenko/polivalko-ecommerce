import { ActionIcon, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type SiteToolbarProps = {
  note?: ReactNode
  summary?: ReactNode
  isLoading?: boolean
  onRefresh?: () => void
}

export function SiteToolbar({ note, summary, isLoading = false, onRefresh }: SiteToolbarProps) {
  return (
    <div className="site-toolbar">
      {note ? <p className="site-toolbar-note">{note}</p> : null}
      <div className="site-toolbar-actions">
        {summary != null ? <span className="site-toolbar-summary">{summary}</span> : null}
        {onRefresh ? (
          <Tooltip label="Оновити">
            <ActionIcon aria-label="Оновити" variant="default" loading={isLoading} onClick={onRefresh}>
              <IconRefresh size={16} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        ) : null}
      </div>
    </div>
  )
}
