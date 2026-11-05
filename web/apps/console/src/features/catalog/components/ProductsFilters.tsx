import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { FilterBar } from '@/shared/ui/FilterBar'
import type { CategoryOption } from '../lib/categoryTree'
import { activeFilterCount, FILL_OPTIONS, STOCK_OPTIONS, VISIBLE_OPTIONS, type ProductsState } from '../lib/productFilters'
import type { ProductsPatch } from '../lib/useProductsState'

type Option = { value: string; label: string }

type ProductsFiltersProps = {
  state: ProductsState
  categories: CategoryOption[]
  brands: Option[] | null
  labels: Option[] | null
  filtered: boolean
  update: (patch: ProductsPatch) => void
  reset: () => void
  actions: ReactNode
}

function withCurrent(options: Option[], value: string, missing: string): Option[] {
  return value && !options.some((option) => option.value === value) ? [...options, { value, label: missing }] : options
}

export function ProductsFilters({ state, categories, brands, labels, filtered, update, reset, actions }: ProductsFiltersProps) {
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

  return (
    <FilterBar
      activeCount={activeFilterCount(state)}
      search={
        <TextInput
          className="app-filter-wide"
          label="Пошук"
          placeholder="Назва або артикул…"
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
            <Tooltip label="Скинути">
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
        label="Категорія"
        placeholder="Усі категорії"
        data={withCurrent(categories, state.categoryId, 'Поточна категорія')}
        value={state.categoryId || null}
        searchable
        clearable
        nothingFoundMessage="Нічого не знайдено"
        onChange={(value) => update({ categoryId: value })}
      />
      {brands ? (
        <Select
          label="Бренд"
          placeholder="Усі бренди"
          data={withCurrent(brands, state.brand, state.brand)}
          value={state.brand || null}
          searchable
          clearable
          nothingFoundMessage="Нічого не знайдено"
          onChange={(value) => update({ brand: value })}
        />
      ) : null}
      {labels ? (
        <Select
          label="Мітка"
          placeholder="Будь-яка"
          data={withCurrent(labels, state.labelId, 'Видалена мітка')}
          value={state.labelId || null}
          clearable
          onChange={(value) => update({ labelId: value })}
        />
      ) : null}
      <Select
        label="Наповнення"
        placeholder="Будь-яке"
        data={FILL_OPTIONS}
        value={state.fill || null}
        clearable
        onChange={(value) => update({ fill: value })}
      />
      <Select
        label="Залишок"
        placeholder="Будь-який"
        data={STOCK_OPTIONS}
        value={state.stock || null}
        clearable
        onChange={(value) => update({ stock: value })}
      />
      <Select
        label="На сайті"
        placeholder="Усі"
        data={VISIBLE_OPTIONS}
        value={state.visible || null}
        clearable
        onChange={(value) => update({ visible: value })}
      />
    </FilterBar>
  )
}
