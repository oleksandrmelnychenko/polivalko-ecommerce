import { SimpleGrid, Stack, Switch, TextInput } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { AppDateInput } from '@/shared/ui/AppDateInput'
import { TableChip } from '@/shared/ui/TableChip'
import { LIMITS, type HomeForm } from '../lib/homeSettings'
import { periodEnd, periodStart, periodState } from '../lib/period'
import { fieldError, type FieldErrors } from '../lib/useSaveForm'

type Announcement = HomeForm['announcement']

type AnnouncementFieldsProps = {
  value: Announcement
  errors: FieldErrors
  onChange: (value: Announcement) => void
  onClearField: (...path: (string | number)[]) => void
}

const STATE_CHIP = {
  off: { tone: 'neutral', label: 'Вимкнена' },
  scheduled: { tone: 'warning', label: 'Ще не почалася' },
  ended: { tone: 'neutral', label: 'Період минув' },
  live: { tone: 'success', label: 'Показується зараз' },
} as const

export function AnnouncementFields({ value, errors, onChange, onClearField }: AnnouncementFieldsProps) {
  const state = periodState(value.isActive && Boolean(value.text.trim()), periodStart(value.from), periodEnd(value.to))
  const chip = STATE_CHIP[state]

  function set(patch: Partial<Announcement>, field: string) {
    onChange({ ...value, ...patch })
    onClearField('announcement', field)
  }

  return (
    <Stack gap="md">
      <div className="site-inline">
        <Switch label="Показувати смугу над шапкою сайту" checked={value.isActive} onChange={(event) => set({ isActive: event.currentTarget.checked }, 'isActive')} />
        <TableChip dot tone={chip.tone} value={chip.label} />
      </div>
      <TextInput
        label="Текст"
        placeholder="Сезон поливу відкрито: усе для автополиву в наявності"
        description={`До ${LIMITS.announcementText} символів, один рядок.`}
        value={value.text}
        maxLength={LIMITS.announcementText}
        error={fieldError(errors, 'announcement', 'text')}
        onChange={(event) => set({ text: event.currentTarget.value }, 'text')}
      />
      <TextInput
        label="Посилання"
        placeholder="/catalog/poliv"
        description="Адреса на сайті (починається з /) або повне посилання https://. Можна лишити порожнім."
        value={value.link}
        maxLength={LIMITS.link}
        spellCheck={false}
        autoComplete="off"
        error={fieldError(errors, 'announcement', 'link')}
        onChange={(event) => set({ link: event.currentTarget.value }, 'link')}
      />
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="sm">
        <AppDateInput
          label="Показувати з"
          description="Якщо дату не вказати, показ почнеться одразу після збереження."
          value={value.from}
          max={value.to || undefined}
          error={fieldError(errors, 'announcement', 'startsAt')}
          onChange={(from) => set({ from }, 'startsAt')}
        />
        <AppDateInput
          label="Показувати до"
          description="Включно з цією датою. Без дати показ триває без обмежень."
          value={value.to}
          min={value.from || undefined}
          error={fieldError(errors, 'announcement', 'endsAt')}
          onChange={(to) => set({ to }, 'endsAt')}
        />
      </SimpleGrid>
      {value.text.trim() ? (
        <div className="site-announcement-preview" aria-label="Як виглядатиме смуга">
          <span>{value.text.trim()}</span>
          {value.link.trim() ? <IconArrowRight size={14} stroke={2} aria-hidden="true" /> : null}
        </div>
      ) : null}
    </Stack>
  )
}
