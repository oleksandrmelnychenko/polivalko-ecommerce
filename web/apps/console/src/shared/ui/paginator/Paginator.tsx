import { ActionIcon, Group, NumberInput, Select, Text, Tooltip } from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from './pageSize'
import './paginator.css'

export type PaginatorProps = {
  page: number
  pageSize: number
  totalPages?: number
  hasNext?: boolean
  pageSizeOptions?: readonly number[]
  isLoading?: boolean
  className?: string
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  onRefresh?: () => void
}

export function Paginator({
  page,
  pageSize,
  totalPages,
  hasNext,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  isLoading = false,
  className,
  onPageChange,
  onPageSizeChange,
  onRefresh,
}: PaginatorProps) {
  const canPrevious = page > 1
  const canNext = hasNext ?? (typeof totalPages === 'number' ? page < totalPages : true)
  const [draft, setDraft] = useState(() => ({ page, value: String(page) }))
  const currentDraft = draft.page === page ? draft.value : String(page)

  function commitDraft() {
    const parsed = Math.floor(Number(currentDraft))
    if (!Number.isFinite(parsed) || parsed < 1) {
      setDraft({ page, value: String(page) })
      return
    }
    const clamped = typeof totalPages === 'number' ? Math.min(parsed, Math.max(1, totalPages)) : parsed
    if (clamped !== page) onPageChange(clamped)
    setDraft({ page: clamped, value: String(clamped) })
  }

  return (
    <Group className={['app-paginator', className].filter(Boolean).join(' ')} gap={2} wrap="nowrap" role="navigation" aria-label="Сторінки">
      {onPageSizeChange ? (
        <Select
          allowDeselect={false}
          aria-label="Кількість рядків на сторінці"
          data={pageSizeOptions.map(String)}
          disabled={isLoading}
          size="xs"
          value={String(pageSize)}
          w={68}
          comboboxProps={{ width: 90 }}
          onChange={(value) => onPageSizeChange(Number(value) || DEFAULT_PAGE_SIZE)}
        />
      ) : null}
      <Text className="app-paginator-label" size="xs">
        стор.
      </Text>
      <NumberInput
        allowDecimal={false}
        allowNegative={false}
        aria-label="Номер сторінки"
        disabled={isLoading}
        hideControls
        min={1}
        max={typeof totalPages === 'number' ? Math.max(1, totalPages) : undefined}
        size="xs"
        value={currentDraft}
        w={48}
        onBlur={commitDraft}
        onChange={(value) => setDraft({ page, value: String(value) })}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      {typeof totalPages === 'number' ? (
        <Text className="app-paginator-label" size="xs">
          / {Math.max(1, totalPages)}
        </Text>
      ) : null}
      <ActionIcon aria-label="Попередня сторінка" color="gray" disabled={!canPrevious || isLoading} size="sm" variant="subtle" onClick={() => onPageChange(Math.max(1, page - 1))}>
        <IconChevronLeft size={16} />
      </ActionIcon>
      <ActionIcon aria-label="Наступна сторінка" color="gray" disabled={!canNext || isLoading} size="sm" variant="subtle" onClick={() => onPageChange(page + 1)}>
        <IconChevronRight size={16} />
      </ActionIcon>
      {onRefresh ? (
        <Tooltip label="Оновити">
          <ActionIcon aria-label="Оновити" color="gray" loading={isLoading} size="sm" variant="subtle" onClick={onRefresh}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      ) : null}
    </Group>
  )
}
