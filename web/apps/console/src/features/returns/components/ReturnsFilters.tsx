import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { DateRangeFilter } from '@/shared/ui/DateRangeFilter'
import { FilterBar } from '@/shared/ui/FilterBar'
import { STATUS_OPTIONS } from '../lib/returnsLabels'
import type { ReturnsPatch, ReturnsState } from '../lib/returnsState'

type ReturnsFiltersProps = {
  state: ReturnsState
  filtered: boolean
  update: (patch: ReturnsPatch) => void
  reset: () => void
  actions: ReactNode
}

export function ReturnsFilters({ state, filtered, update, reset, actions }: ReturnsFiltersProps) {
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
    reset()
  }

  const activeCount = [state.status, state.from, state.to].filter(Boolean).length

  return (
    <FilterBar
      activeCount={activeCount}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук"
          placeholder="Номер замовлення…"
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
      <Select label="Стан" placeholder="Будь-який" data={STATUS_OPTIONS} value={state.status || null} clearable onChange={(value) => update({ status: value })} />
      <DateRangeFilter className="app-filter-range" from={state.from} to={state.to} onChange={(range) => update(range)} />
    </FilterBar>
  )
}
