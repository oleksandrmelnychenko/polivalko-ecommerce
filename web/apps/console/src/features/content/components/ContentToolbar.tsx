import { ActionIcon, Tooltip } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type ContentToolbarProps = {
  note?: ReactNode
  summary?: ReactNode
  isLoading?: boolean
  onRefresh?: () => void
}

export function ContentToolbar({ note, summary, isLoading = false, onRefresh }: ContentToolbarProps) {
  return (
    <div className="content-toolbar">
      {note ? <p className="content-toolbar-note">{note}</p> : null}
      <div className="content-toolbar-actions">
        {summary != null ? <span className="content-toolbar-summary">{summary}</span> : null}
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
