import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { DEFAULT_SORT, isCustomerSort, sortLabel, type CustomersState } from '../lib/customersState'
import type { CustomersPatch } from '../lib/useCustomersState'

const SORT_OPTIONS = Object.entries(sortLabel).map(([value, label]) => ({ value, label }))

type CustomersFiltersProps = {
  state: CustomersState
  update: (patch: CustomersPatch) => void
  actions: ReactNode
}

export function CustomersFilters({ state, update, actions }: CustomersFiltersProps) {
  const [text, setText] = useState(state.q)
  const [seenQ, setSeenQ] = useState(state.q)
  const commitSearch = useDebouncedCallback((value: string) => update({ q: value }), 350)

  if (seenQ !== state.q) {
    setSeenQ(state.q)
    setText(state.q)
  }

  function changeText(value: string) {
    setText(value)
    commitSearch(value)
  }

  function resetSearch() {
    commitSearch.cancel()
    setText('')
    update({ q: null })
  }

  return (
    <FilterBar
      activeCount={state.sort === DEFAULT_SORT ? 0 : 1}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук"
          placeholder="Ім'я, телефон або email…"
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
          {state.q ? (
            <Tooltip label="Скинути">
              <ActionIcon variant="default" aria-label="Скинути" onClick={resetSearch}>
                <IconFilterOff size={17} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {actions}
        </>
      }
    >
      <Select
        label="Порядок"
        data={SORT_OPTIONS}
        value={state.sort}
        allowDeselect={false}
        onChange={(value) => update({ sort: isCustomerSort(value) ? value : DEFAULT_SORT })}
      />
    </FilterBar>
  )
}
