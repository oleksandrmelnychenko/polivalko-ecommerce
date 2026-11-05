import { ActionIcon, Button, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { IconChecks, IconEraser, IconFilterOff, IconRefresh, IconSearch } from '@tabler/icons-react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { hasActiveFilters, type PermissionFilters, type RiskFilter, type StateFilter } from '../lib/permissionTree'
import { countText } from '../lib/roleText'

const RISK_OPTIONS = [
  { value: 'all', label: 'Усі ризики' },
  { value: 'low', label: 'Низький ризик' },
  { value: 'medium', label: 'Середній ризик' },
  { value: 'high', label: 'Високий ризик' },
]

const STATE_OPTIONS = [
  { value: 'all', label: 'Усі права' },
  { value: 'selected', label: 'Вибрані' },
  { value: 'unselected', label: 'Не вибрані' },
  { value: 'changed', label: 'Змінені' },
]

type PermissionToolbarProps = {
  filters: PermissionFilters
  onFilters: (filters: PermissionFilters) => void
  shown: number
  total: number
  readOnly: boolean
  canSelectAll: boolean
  canClear: boolean
  refreshing: boolean
  onSelectAll: () => void
  onClear: () => void
  onRefresh: () => void
}

export function PermissionToolbar({ filters, onFilters, shown, total, readOnly, canSelectAll, canClear, refreshing, onSelectAll, onClear, onRefresh }: PermissionToolbarProps) {
  const filtered = hasActiveFilters(filters)
  const activeCount = [filters.risk !== 'all', filters.state !== 'all'].filter(Boolean).length

  return (
    <FilterBar
      label="Фільтри прав"
      activeCount={activeCount}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук права"
          placeholder="Назва, опис або ключ…"
          value={filters.query}
          leftSection={<IconSearch size={16} stroke={1.7} />}
          rightSection={filters.query ? <CloseButton size="sm" aria-label="Очистити пошук" onClick={() => onFilters({ ...filters, query: '' })} /> : null}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onFilters({ ...filters, query: event.currentTarget.value })}
        />
      }
      actions={
        <>
          {filtered ? (
            <Tooltip label="Скинути фільтри">
              <ActionIcon variant="default" aria-label="Скинути фільтри" onClick={() => onFilters({ query: '', risk: 'all', state: 'all' })}>
                <IconFilterOff size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {readOnly ? null : (
            <>
              <Button variant="default" leftSection={<IconChecks size={16} stroke={1.8} />} disabled={!canSelectAll} onClick={onSelectAll}>
                {filtered ? 'Вибрати показані' : 'Вибрати все'}
              </Button>
              <Button variant="default" leftSection={<IconEraser size={16} stroke={1.8} />} disabled={!canClear} onClick={onClear}>
                {filtered ? 'Зняти показані' : 'Очистити'}
              </Button>
            </>
          )}
          <span className="app-filter-summary">
            Показано: {countText.format(shown)} з {countText.format(total)}
          </span>
          <Tooltip label="Оновити">
            <ActionIcon variant="default" aria-label="Оновити" loading={refreshing} onClick={onRefresh}>
              <IconRefresh size={17} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        </>
      }
    >
      <Select
        label="Ризик"
        data={RISK_OPTIONS}
        value={filters.risk}
        allowDeselect={false}
        onChange={(value) => onFilters({ ...filters, risk: (value ?? 'all') as RiskFilter })}
      />
      <Select
        label="Стан"
        data={STATE_OPTIONS}
        value={filters.state}
        allowDeselect={false}
        onChange={(value) => onFilters({ ...filters, state: (value ?? 'all') as StateFilter })}
      />
    </FilterBar>
  )
}
