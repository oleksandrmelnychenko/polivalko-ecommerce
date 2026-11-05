import { Button } from '@mantine/core'
import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import './filter-bar.css'

type FilterBarProps = {
  search?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  activeCount?: number
  label?: string
}

export function FilterBar({ search, children, actions, activeCount = 0, label = 'Фільтри' }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="app-filter-bar" role="search" aria-label={label} data-expanded={expanded || undefined}>
      {search || children ? (
        <div className="app-filter-fields">
          {search}
          {children ? (
            <>
              <Button
                className="app-filter-toggle"
                variant="default"
                aria-expanded={expanded}
                leftSection={<IconAdjustmentsHorizontal size={16} stroke={1.7} />}
                rightSection={activeCount > 0 ? <span className="app-filter-toggle-count">{activeCount}</span> : null}
                onClick={() => setExpanded((value) => !value)}
              >
                Фільтри
              </Button>
              <div className="app-filter-more">{children}</div>
            </>
          ) : null}
        </div>
      ) : null}
      {actions ? <div className="app-filter-actions">{actions}</div> : null}
    </div>
  )
}
