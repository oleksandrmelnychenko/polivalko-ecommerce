import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { ACCOUNT_STATUS_OPTIONS, isAccountStatus, type AccountsPatch, type AccountsState } from '../lib/accountsState'

type AccountsFiltersProps = {
  state: AccountsState
  update: (patch: AccountsPatch) => void
  actions: ReactNode
}

export function AccountsFilters({ state, update, actions }: AccountsFiltersProps) {
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

  function resetAll() {
    commitSearch.cancel()
    setText('')
    update({ q: null, status: null })
  }

  const filtered = Boolean(state.q || state.status !== 'all')

  return (
    <FilterBar
      activeCount={state.status === 'all' ? 0 : 1}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук"
          placeholder="Ім'я, email або телефон…"
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
      <Select
        label="Стан"
        data={ACCOUNT_STATUS_OPTIONS}
        value={state.status}
        allowDeselect={false}
        onChange={(value) => update({ status: isAccountStatus(value) ? value : null })}
      />
    </FilterBar>
  )
}
