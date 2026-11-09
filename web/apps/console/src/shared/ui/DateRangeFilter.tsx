import { Button, CloseButton, Group, InputBase, Popover, TextInput } from '@mantine/core'
import { DatePicker, type DatePickerPreset } from '@mantine/dates'
import { IconCalendar } from '@tabler/icons-react'
import { useState } from 'react'
import './date-range-filter.css'

export type DateRange = { from: string; to: string }

type DateRangeFilterProps = {
  from: string
  to: string
  label?: string
  className?: string
  onChange: (range: DateRange) => void
}

const EMPTY: DateRange = { from: '', to: '' }

export function DateRangeFilter({ from, to, label = 'Період', className, onChange }: DateRangeFilterProps) {
  const [opened, setOpened] = useState(false)
  const [draft, setDraft] = useState<DateRange>({ from, to })
  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to)
  const selected = Boolean(from || to)
  const summary = selected ? rangeText(from, to) : 'Увесь період'

  function changeOpened(next: boolean) {
    if (next) setDraft({ from, to })
    setOpened(next)
  }

  return (
    <Popover opened={opened} onChange={changeOpened} position="bottom-start" withinPortal trapFocus returnFocus shadow="md">
      <Popover.Target>
        <InputBase
          component="button"
          type="button"
          className={['app-date-range', className].filter(Boolean).join(' ')}
          label={label}
          pointer
          aria-haspopup="dialog"
          aria-expanded={opened}
          aria-label={`${label}: ${summary}`}
          onClick={() => changeOpened(!opened)}
          rightSection={
            selected ? (
              <CloseButton size="sm" aria-label="Скинути період" onClick={() => onChange(EMPTY)} />
            ) : (
              <IconCalendar aria-hidden="true" size={15} stroke={1.6} />
            )
          }
          rightSectionPointerEvents={selected ? 'all' : 'none'}
        >
          <span className={selected ? 'app-date-range-value' : 'app-date-range-placeholder'}>{summary}</span>
        </InputBase>
      </Popover.Target>
      <Popover.Dropdown className="app-date-range-menu" role="dialog" aria-label={label}>
        <form
          className="app-date-range-panel"
          onSubmit={(event) => {
            event.preventDefault()
            if (invalid) return
            onChange(draft)
            setOpened(false)
          }}
        >
          <DatePicker
            allowSingleDateInRange
            className="app-date-range-calendar"
            attributes={{ month: { role: 'grid' } }}
            defaultDate={draft.to || draft.from || undefined}
            presets={buildPresets()}
            size="sm"
            type="range"
            value={[draft.from || null, draft.to || null]}
            onChange={([nextFrom, nextTo]) => setDraft({ from: nextFrom ?? '', to: nextTo ?? '' })}
          />
          <div className="app-date-range-fields">
            <TextInput
              label="Від"
              type="date"
              max={draft.to || undefined}
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.currentTarget.value })}
              data-autofocus
            />
            <TextInput
              label="До"
              type="date"
              min={draft.from || undefined}
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value })}
            />
          </div>
          {invalid ? (
            <span className="app-date-range-error" role="alert">
              Дата «Від» має бути не пізніше дати «До»
            </span>
          ) : null}
          <Group justify="space-between" gap={8} wrap="nowrap">
            <Button variant="subtle" color="gray" disabled={!draft.from && !draft.to} onClick={() => setDraft(EMPTY)}>
              Очистити
            </Button>
            <Group gap={8} wrap="nowrap">
              <Button variant="default" onClick={() => setOpened(false)}>
                Скасувати
              </Button>
              <Button type="submit" disabled={invalid}>
                Застосувати
              </Button>
            </Group>
          </Group>
        </form>
      </Popover.Dropdown>
    </Popover>
  )
}

function rangeText(from: string, to: string) {
  if (from && to) return `${displayDate(from)}-${displayDate(to)}`
  return from ? `з ${displayDate(from)}` : `до ${displayDate(to)}`
}

function displayDate(value: string) {
  return value ? value.split('-').reverse().join('.') : '…'
}

function isoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function buildPresets(): DatePickerPreset<'range'>[] {
  const today = new Date()
  const shifted = (days: number) => isoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days))
  const end = isoDate(today)
  return [
    { label: 'Сьогодні', value: [end, end] },
    { label: 'Вчора', value: [shifted(1), shifted(1)] },
    { label: '7 днів', value: [shifted(6), end] },
    { label: '30 днів', value: [shifted(29), end] },
    { label: 'Цей місяць', value: [isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), end] },
    {
      label: 'Минулий місяць',
      value: [isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), isoDate(new Date(today.getFullYear(), today.getMonth(), 0))],
    },
  ]
}
