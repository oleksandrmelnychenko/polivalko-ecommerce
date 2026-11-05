import { DateInput, type DateInputProps } from '@mantine/dates'
import { IconCalendar } from '@tabler/icons-react'
import { useState } from 'react'
import './app-date-input.css'

export type AppDateInputProps = Omit<
  DateInputProps,
  'defaultValue' | 'maxDate' | 'minDate' | 'onChange' | 'type' | 'value' | 'valueFormat' | 'withTime'
> & {
  value?: string | null
  min?: string
  max?: string
  onChange?: (value: string) => void
}

const TYPED_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

export function AppDateInput({
  value,
  min,
  max,
  onChange,
  onBlur,
  onClick,
  onFocus,
  onKeyDown,
  placeholder,
  readOnly,
  disabled,
  rightSection,
  popoverProps,
  ...rest
}: AppDateInputProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [emitted, setEmitted] = useState(value ?? '')
  const [seen, setSeen] = useState(value ?? '')
  const [generation, setGeneration] = useState(0)
  const minDay = toPickerValue(min)
  const maxDay = toPickerValue(max)

  if ((value ?? '') !== seen) {
    setSeen(value ?? '')
    if ((value ?? '') !== emitted) {
      setEmitted(value ?? '')
      if (calendarOpen) {
        setCalendarOpen(false)
        setGeneration((current) => current + 1)
      }
    }
  }

  function emit(next: string) {
    setEmitted(next)
    onChange?.(next)
  }

  return (
    <DateInput
      key={generation}
      {...rest}
      attributes={{ ...rest.attributes, month: { role: 'grid', ...rest.attributes?.month } }}
      className={['app-date-input', rest.className].filter(Boolean).join(' ')}
      clearable={!readOnly && !disabled}
      dateParser={parseTypedDate}
      disabled={disabled}
      getDayProps={(day) => ({
        ...rest.getDayProps?.(day),
        disabled: Boolean((minDay && day < minDay) || (maxDay && day > maxDay)) || rest.getDayProps?.(day).disabled,
      })}
      placeholder={placeholder ?? 'дд.мм.рррр'}
      popoverProps={{ withinPortal: true, ...popoverProps }}
      readOnly={readOnly}
      rightSection={rightSection ?? <IconCalendar aria-hidden="true" size={15} stroke={1.6} />}
      rightSectionPointerEvents={rightSection ? undefined : 'none'}
      value={toPickerValue(value)}
      valueFormat="DD.MM.YYYY"
      onBlur={(event) => {
        setCalendarOpen(false)
        onBlur?.(event)
      }}
      onChange={(next) => emit(toPickerValue(next) ?? '')}
      onClick={(event) => {
        setCalendarOpen(true)
        onClick?.(event)
      }}
      onFocus={(event) => {
        setCalendarOpen(true)
        onFocus?.(event)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.key === 'Escape') setCalendarOpen(false)
      }}
    />
  )
}

function toPickerValue(value: string | null | undefined): string | null {
  const match = value ? ISO_DATE.exec(value) : null
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function parseTypedDate(input: string): string | null {
  const text = input.trim()
  const typed = TYPED_DATE.exec(text)
  const iso = typed ? null : ISO_DATE.exec(text)
  const parts = typed
    ? [Number(typed[3]), Number(typed[2]), Number(typed[1])]
    : iso && iso[0].length === text.length
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : null
  if (!parts) return null
  const [year, month, day] = parts
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}
