import { SimpleGrid, Stack, Switch, TextInput } from '@mantine/core'
import { IconArrowRight } from '@tabler/icons-react'
import { AppDateInput } from '@/shared/ui/AppDateInput'
import { LIMITS, type HomeForm } from '../lib/homeSettings'
import { fieldError, type FieldErrors } from '../lib/useSaveForm'

type Announcement = HomeForm['announcement']

type AnnouncementFieldsProps = {
  value: Announcement
  errors: FieldErrors
  onChange: (value: Announcement) => void
  onClearField: (...path: (string | number)[]) => void
}

export function AnnouncementFields({ value, errors, onChange, onClearField }: AnnouncementFieldsProps) {
  function set(patch: Partial<Announcement>, field: string) {
    onChange({ ...value, ...patch })
    onClearField('announcement', field)
  }

  return (
    <Stack gap="sm">
      <div className="site-inline">
        <Switch label="Увімкнути оголошення" checked={value.isActive} onChange={(event) => set({ isActive: event.currentTarget.checked }, 'isActive')} />
      </div>
      <TextInput
        label="Текст"
        placeholder="Сезон поливу відкрито: усе для автополиву в наявності"
        description={`До ${LIMITS.announcementText} символів`}
        value={value.text}
        maxLength={LIMITS.announcementText}
        error={fieldError(errors, 'announcement', 'text')}
        onChange={(event) => set({ text: event.currentTarget.value }, 'text')}
      />
      <TextInput
        label="Посилання"
        placeholder="/catalog/poliv"
        description="Шлях на сайті або повна адреса. Необов’язково."
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
          description="Без дати — одразу після збереження."
          value={value.from}
          max={value.to || undefined}
          error={fieldError(errors, 'announcement', 'startsAt')}
          onChange={(from) => set({ from }, 'startsAt')}
        />
        <AppDateInput
          label="Показувати до"
          description="Включно. Без дати — безстроково."
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
