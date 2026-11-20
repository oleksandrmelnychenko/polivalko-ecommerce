import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { DateRangeFilter } from '@/shared/ui/DateRangeFilter'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ARCHIVE_ENTITY_OPTIONS } from '../lib/archive'

export const archiveFilterKeys = ['q', 'entityType', 'sourceAccount', 'storeId', 'from', 'to'] as const
export type ArchiveFilterValues = Record<(typeof archiveFilterKeys)[number], string>

const EMPTY_FILTERS: ArchiveFilterValues = { q: '', entityType: '', sourceAccount: '', storeId: '', from: '', to: '' }

const ARCHIVE_REPORT_GROUPS = [
  {
    group: 'Каса й банк',
    items: [
      { value: 'Рух коштів', label: 'Рух коштів', entityType: 'financialReport' },
      { value: 'Звіт по рахунках', label: 'Звіт по рахунках', entityType: 'financialReport' },
      { value: 'Звіт по касі', label: 'Звіт по касі', entityType: 'financialReport' },
      { value: 'Звіт по змінам', label: 'Звіт про касові зміни', entityType: 'financialReport' },
      { value: 'Реєстр Z-звітів', label: 'Реєстр Z-звітів', entityType: 'financialReport' },
      { value: 'Банківський рахунок DNTrade', label: 'Банківські рахунки DNTrade', entityType: 'bankAccount' },
    ],
  },
  {
    group: 'Заборгованість',
    items: [
      { value: 'Взаєморозрахунки з контрагентами', label: 'Взаєморозрахунки з контрагентами', entityType: 'financialReport' },
      { value: 'Журнал коригувань заборгованості', label: 'Журнал коригувань заборгованості', entityType: 'financialReport' },
    ],
  },
  {
    group: 'Облікові звіти й налаштування',
    items: [
      { value: 'Облікові параметри організацій', label: 'Облікові параметри організацій', entityType: 'financialReport' },
      { value: 'Прибутки та витрати (P&L)', label: 'Прибутки та витрати (P&L)', entityType: 'financialReport' },
      { value: 'Звіт по витратам', label: 'Звіт про витрати', entityType: 'financialReport' },
      { value: 'Валовий прибуток', label: 'Валовий прибуток', entityType: 'financialReport' },
    ],
  },
  {
    group: 'Склад і довідники',
    items: [
      { value: 'Залишки на складі', label: 'Залишки на складі', entityType: 'inventorySnapshot' },
      { value: 'Склади', label: 'Склади', entityType: 'sourceReport' },
      { value: 'Довідник товарів DNTrade', label: 'Довідник товарів DNTrade', entityType: 'sourceReport' },
      { value: 'Одиниці виміру', label: 'Одиниці виміру', entityType: 'sourceReport' },
      { value: 'Типи цін', label: 'Типи цін', entityType: 'sourceReport' },
      { value: 'Підрозділи організацій', label: 'Підрозділи організацій', entityType: 'sourceReport' },
    ],
  },
]

const archiveReportOptions = ARCHIVE_REPORT_GROUPS.flatMap(({ items }) => items)

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
  filters: ArchiveFilterValues
  actions: ReactNode
  onChange: (filters: ArchiveFilterValues) => void
}

export function ArchiveFilters({ filters, actions, onChange }: ArchiveFiltersProps) {
  const [draft, setDraft] = useState(filters)
  const [previousFilters, setPreviousFilters] = useState(filters)
  const commit = useDebouncedCallback(onChange, 350)
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

  const selectedReport = archiveReportOptions.find(({ value, entityType }) => value === draft.q && entityType === draft.entityType)
  const activeCount = [draft.entityType, draft.sourceAccount, draft.storeId, draft.from || draft.to].filter(Boolean).length
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
            className="app-filter-wide"
            label="Звіти й довідники"
            placeholder="Оберіть звіт або довідник"
            data={ARCHIVE_REPORT_GROUPS}
            value={selectedReport?.value ?? null}
            clearable
            clearButtonProps={{ 'aria-label': 'Очистити вибір звіту або довідника' }}
            onChange={(value) => {
              const record = archiveReportOptions.find((option) => option.value === value)
              update({ q: record?.value ?? '', entityType: record?.entityType ?? '' }, true)
            }}
          />
        </>
      }
      actions={
        <>
          {draft.q || activeCount ? (
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
      <Select
        label="Тип запису"
        placeholder="Усі"
        data={ARCHIVE_ENTITY_OPTIONS}
        value={draft.entityType || null}
        clearable
        searchable
        onChange={(value) => update({ entityType: value ?? '' }, true)}
      />
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
