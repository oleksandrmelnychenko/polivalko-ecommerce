import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useEffect, useState, type ReactNode } from 'react'
import { DateRangeFilter } from '@/shared/ui/DateRangeFilter'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ARCHIVE_ENTITY_OPTIONS } from '../lib/archive'
import { archiveReportGroups, archiveViewEntityType, type ArchiveView } from '../lib/archiveViews'

export const archiveFilterKeys = ['q', 'entityType', 'sourceAccount', 'storeId', 'from', 'to'] as const
export type ArchiveFilterValues = Record<(typeof archiveFilterKeys)[number], string>

const EMPTY_FILTERS: ArchiveFilterValues = { q: '', entityType: '', sourceAccount: '', storeId: '', from: '', to: '' }

export function readArchiveFilters(params: URLSearchParams): ArchiveFilterValues {
  return {
    q: params.get('q') ?? '',
    entityType: params.get('entityType') ?? '',
    sourceAccount: params.get('sourceAccount') ?? '',
    storeId: params.get('storeId') ?? '',
    from: readDate(params.get('from')),
    to: readDate(params.get('to')),
  }
}

function readDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  const instant = new Date(value)
  return !Number.isNaN(instant.getTime()) && instant.toISOString().startsWith(value) ? value : ''
}

type ArchiveFiltersProps = {
  view: ArchiveView
  filters: ArchiveFilterValues
  actions: ReactNode
  onChange: (filters: ArchiveFilterValues) => void
}

export function ArchiveFilters({ view, filters, actions, onChange }: ArchiveFiltersProps) {
  const [draft, setDraft] = useState(filters)
  const [previousFilters, setPreviousFilters] = useState(filters)
  const commit = useDebouncedCallback(onChange, 350)
  useEffect(() => () => commit.cancel(), [commit, filters])
  if (previousFilters !== filters) {
    setPreviousFilters(filters)
    setDraft(filters)
  }

  function update(patch: Partial<ArchiveFilterValues>, applyNow = false) {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (applyNow) {
      commit.cancel()
      onChange(next)
    } else {
      commit(next)
    }
  }

  function reset() {
    commit.cancel()
    setDraft(EMPTY_FILTERS)
    onChange(EMPTY_FILTERS)
  }

  const reportGroups = archiveReportGroups(view)
  const reportOptions = reportGroups.flatMap(({ items }) => items)
  const entityOptions = view.id === 'all' ? ARCHIVE_ENTITY_OPTIONS : view.entityTypes.map((value) => ({
    value,
    label: ARCHIVE_ENTITY_OPTIONS.find((option) => option.value === value)?.label ?? value,
  }))
  const defaultEntityType = archiveViewEntityType(view, '')
  const entityType = archiveViewEntityType(view, draft.entityType)
  const selectedReport = reportOptions.find((report) => report.value === draft.q && report.entityType === entityType)
  const activeCount = [draft.sourceAccount, draft.storeId, draft.from || draft.to].filter(Boolean).length
  return (
    <FilterBar
      label="Пошук в архіві Навколо"
      activeCount={activeCount}
      search={
        <>
          <TextInput
            className="app-filter-wide"
            label="Пошук"
            placeholder="Код або тип документа"
            value={draft.q}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            leftSection={<IconSearch size={16} stroke={1.7} />}
            rightSection={draft.q ? <CloseButton size="sm" aria-label="Очистити пошук" onClick={() => update({ q: '' }, true)} /> : null}
            onChange={(event) => update({ q: event.currentTarget.value })}
            onKeyDown={(event) => { if (event.key === 'Enter') commit.flush() }}
          />
          <Select
            label="Тип запису"
            placeholder="Усі"
            data={entityOptions}
            value={entityType || null}
            clearable={entityType !== defaultEntityType}
            searchable
            onChange={(value) => update({
              entityType: value === defaultEntityType ? '' : value ?? '',
              q: selectedReport && archiveViewEntityType(view, value ?? '') !== entityType ? '' : draft.q,
            }, true)}
          />
          <Select
            className="app-filter-wide"
            label="Звіти й довідники"
            placeholder="Оберіть звіт або довідник"
            data={reportGroups}
            value={selectedReport?.value ?? null}
            clearable
            clearButtonProps={{ 'aria-label': 'Очистити вибір звіту або довідника' }}
            onChange={(value) => {
              const record = reportOptions.find((option) => option.value === value)
              update({ q: record?.value ?? '', entityType: record?.entityType ?? '' }, true)
            }}
          />
        </>
      }
      actions={
        <>
          {draft.q || entityType !== defaultEntityType || activeCount ? (
            <Tooltip label="Скинути фільтри">
              <ActionIcon variant="default" aria-label="Скинути фільтри" onClick={reset}>
                <IconFilterOff size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {actions}
        </>
      }
    >
      <TextInput
        label="Код джерела"
        placeholder="Усі джерела"
        value={draft.sourceAccount}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => update({ sourceAccount: event.currentTarget.value })}
        onKeyDown={(event) => { if (event.key === 'Enter') commit.flush() }}
      />
      <TextInput
        label="Код складу"
        placeholder="Усі склади"
        value={draft.storeId}
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => update({ storeId: event.currentTarget.value })}
        onKeyDown={(event) => { if (event.key === 'Enter') commit.flush() }}
      />
      <DateRangeFilter className="app-filter-range" from={draft.from} to={draft.to} label="Дата запису" onChange={(range) => update(range, true)} />
    </FilterBar>
  )
}
