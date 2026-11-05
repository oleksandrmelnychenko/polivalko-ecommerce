import { ActionIcon, CloseButton, Select, TextInput, Tooltip } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconFilterOff, IconInfoCircle, IconSearch } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { FilterBar } from '@/shared/ui/FilterBar'
import type { AuditPatch, AuditState } from '../lib/auditFilters'
import { ENTITY_TYPE_OPTIONS } from '../lib/auditLabels'

const SEARCH_HELP = "Пошук: точний номер чи код об'єкта, ім'я працівника або частина коду дії."

type AuditFiltersProps = {
  state: AuditState
  update: (patch: AuditPatch) => void
  reset: () => void
  actions: ReactNode
}

export function AuditFilters({ state, update, reset, actions }: AuditFiltersProps) {
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

  const filtered = Boolean(state.q || state.entityType)

  return (
    <FilterBar
      activeCount={state.entityType ? 1 : 0}
      search={
        <TextInput
          className="app-filter-wide"
          label={
            <span className="audit-search-label">
              Пошук
              <Tooltip label={SEARCH_HELP} multiline w={280} withArrow>
                <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" />
              </Tooltip>
            </span>
          }
          placeholder="PV-100001, ім'я або user.locked"
          value={text}
          leftSection={<IconSearch size={16} stroke={1.7} />}
          rightSection={text ? <CloseButton size="sm" aria-label="Очистити пошук" onClick={() => changeText('')} /> : null}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="audit-search-help"
          onChange={(event) => changeText(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitSearch.flush()
          }}
        />
      }
      actions={
        <>
          <span id="audit-search-help" className="visually-hidden">
            {SEARCH_HELP}
          </span>
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
      <Select label="Об'єкт" placeholder="Усі" data={ENTITY_TYPE_OPTIONS} value={state.entityType || null} clearable onChange={(value) => update({ entityType: value })} />
    </FilterBar>
  )
}
