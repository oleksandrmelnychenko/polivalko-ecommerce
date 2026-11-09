import { ActionIcon, Button, Checkbox, TextInput, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { AppDateInput } from '@/shared/ui/AppDateInput'
import { TableChip } from '@/shared/ui/TableChip'
import { isPastDay, newSpecialDay, SHOP_LIMITS, type SpecialDayRow } from '../lib/shopForm'
import { fieldError, type FieldErrors } from '../lib/useSaveForm'

type SpecialDaysEditorProps = {
  days: SpecialDayRow[]
  errors: FieldErrors
  onChange: (days: SpecialDayRow[]) => void
  onClearField: (...path: (string | number)[]) => void
}

export function SpecialDaysEditor({ days, errors, onChange, onClearField }: SpecialDaysEditorProps) {
  function update(index: number, patch: Partial<SpecialDayRow>, field: string) {
    onChange(days.map((day, position) => (position === index ? { ...day, ...patch } : day)))
    onClearField('specialDays', index, field)
  }

  return (
    <div className="settings-days">
      {days.length === 0 ? <p className="settings-muted">Особливих днів немає: сайт показує звичайний графік.</p> : null}
      {days.length > 0 ? (
        <ul className="settings-day-list">
          {days.map((day, index) => {
            const name = day.label.trim() || `день ${index + 1}`
            return (
              <li key={day.id} className="settings-day">
                <AppDateInput
                  label="Дата"
                  required
                  value={day.date}
                  error={fieldError(errors, 'specialDays', index, 'date')}
                  onChange={(date) => update(index, { date }, 'date')}
                />
                <TextInput
                  label="Назва"
                  placeholder="Новий рік"
                  required
                  value={day.label}
                  maxLength={SHOP_LIMITS.label}
                  error={fieldError(errors, 'specialDays', index, 'label')}
                  onChange={(event) => update(index, { label: event.currentTarget.value }, 'label')}
                />
                <TextInput
                  label="Години роботи"
                  placeholder="10:00-15:00"
                  value={day.closed ? '' : day.hours}
                  disabled={day.closed}
                  maxLength={SHOP_LIMITS.hours}
                  error={fieldError(errors, 'specialDays', index, 'hours')}
                  onChange={(event) => update(index, { hours: event.currentTarget.value }, 'hours')}
                />
                <Checkbox
                  className="settings-day-closed"
                  label="Зачинено"
                  checked={day.closed}
                  onChange={(event) => update(index, { closed: event.currentTarget.checked }, 'hours')}
                />
                <div className="settings-day-actions">
                  {isPastDay(day.date) ? <TableChip tone="neutral" value="минув" /> : null}
                  <Tooltip label="Видалити">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Видалити: ${name}`}
                      onClick={() => onChange(days.filter((_, position) => position !== index))}
                    >
                      <IconTrash size={16} stroke={1.7} />
                    </ActionIcon>
                  </Tooltip>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      <Button variant="default" size="sm" leftSection={<IconPlus size={16} stroke={1.8} />} onClick={() => onChange([...days, newSpecialDay()])}>
        Додати день
      </Button>
    </div>
  )
}
