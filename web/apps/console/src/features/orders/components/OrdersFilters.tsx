import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { deliveryMethodLabel, paymentStatusLabel } from '@polivalko/shared/lib/labels'
import { DateRangeFilter } from '@/shared/ui/DateRangeFilter'
import { FilterBar } from '@/shared/ui/FilterBar'
import type { OrdersState } from '../lib/orderFilters'
import type { OrdersPatch } from '../lib/useOrdersState'

const PAYMENT_OPTIONS = Object.entries(paymentStatusLabel).map(([value, label]) => ({ value, label }))
const DELIVERY_OPTIONS = Object.entries(deliveryMethodLabel).map(([value, label]) => ({ value, label }))

type OrdersFiltersProps = {
  state: OrdersState
  filtered: boolean
  update: (patch: OrdersPatch) => void
  reset: () => void
  actions: ReactNode
}

export function OrdersFilters({ state, filtered, update, reset, actions }: OrdersFiltersProps) {
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

  const activeCount = [state.paymentStatus, state.delivery, state.from, state.to].filter(Boolean).length

  return (
    <FilterBar
      activeCount={activeCount}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук"
          placeholder="Номер замовлення або телефон…"
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
        label="Оплата"
        placeholder="Будь-яка"
        data={PAYMENT_OPTIONS}
        value={state.paymentStatus || null}
        clearable
        onChange={(value) => update({ paymentStatus: value })}
      />
      <Select
        label="Отримання"
        placeholder="Будь-яке"
        data={DELIVERY_OPTIONS}
        value={state.delivery || null}
        clearable
        onChange={(value) => update({ delivery: value })}
      />
      <DateRangeFilter className="app-filter-range" from={state.from} to={state.to} onChange={(range) => update(range)} />
    </FilterBar>
  )
}
