import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import type { StaffRole } from '@/shared/auth/permissionsApi'
import { FilterBar } from '@/shared/ui/FilterBar'
import { sortRoles } from '../lib/roleText'
import type { StaffFilters as Filters } from '../lib/useStaffFilters'

const ACCESS_OPTIONS = [
  { value: 'active', label: 'Активні' },
  { value: 'locked', label: 'Заблоковані' },
]

type StaffFiltersProps = {
  filters: Filters
  filtered: boolean
  roles: readonly StaffRole[]
  update: (patch: Partial<Record<keyof Filters, string | null>>) => void
  reset: () => void
  actions: ReactNode
}

export function StaffFilters({ filters, filtered, roles, update, reset, actions }: StaffFiltersProps) {
  const [text, setText] = useState(filters.q)
  const [seenQ, setSeenQ] = useState(filters.q)
  const commitSearch = useDebouncedCallback((value: string) => update({ q: value }), 250)

  if (seenQ !== filters.q) {
    setSeenQ(filters.q)
    setText(filters.q)
  }

  function changeText(value: string) {
    setText(value)
    commitSearch(value)
  }

  function resetAll() {
    commitSearch.cancel()
    reset()
  }

  const roleOptions = sortRoles(roles).map((role) => ({ value: role.id, label: role.name }))
  const activeCount = [filters.role, filters.access].filter(Boolean).length

  return (
    <FilterBar
      activeCount={activeCount}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук"
          placeholder="Ім'я або email…"
          value={text}
          leftSection={<IconSearch size={16} stroke={1.7} />}
          rightSection={text ? <CloseButton size="sm" aria-label="Очистити пошук" onClick={() => changeText('')} /> : null}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => changeText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitSearch.flush()
          }}
        />
      }
      actions={
        <>
          {filtered ? (
            <Tooltip label="Скинути фільтри">
              <ActionIcon variant="default" aria-label="Скинути фільтри" onClick={resetAll}>
                <IconFilterOff size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {actions}
        </>
      }
    >
      <Select label="Роль" placeholder="Будь-яка" data={roleOptions} value={filters.role || null} clearable onChange={(value) => update({ role: value })} />
      <Select label="Доступ" placeholder="Будь-який" data={ACCESS_OPTIONS} value={filters.access || null} clearable onChange={(value) => update({ access: value })} />
    </FilterBar>
  )
}
