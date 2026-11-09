import { Button, Checkbox, Group, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import { TableChip } from '@/shared/ui/TableChip'
import { savePickupPoint, type PickupPoint } from '../api/settingsApi'
import { fieldError, useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'

const FORM_ID = 'settings-pickup-form'

type PickupPointDrawerProps = {
  point: PickupPoint | null
  opened: boolean
  onClose: () => void
  onSaved: (point: PickupPoint) => void
}

export function PickupPointDrawer({ point, opened, onClose, onSaved }: PickupPointDrawerProps) {
  const [busy, setBusy] = useState(false)

  return (
    <AppDrawer
      opened={opened}
      onClose={busy ? () => undefined : onClose}
      title={point?.name ?? 'Точка самовивозу'}
      size="compact"
      footer={
        <Group justify="flex-end" gap="sm">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти точку
          </Button>
        </Group>
      }
    >
      {point ? <PickupForm key={point.code} initial={point} onBusy={setBusy} onSaved={onSaved} /> : null}
    </AppDrawer>
  )
}

type Values = { name: string; address: string; schedule: string; instructions: string; mapUrl: string; isActive: boolean }
type TextField = Exclude<keyof Values, 'isActive'>

function toValues(point: PickupPoint): Values {
  return { name: point.name, address: point.address, schedule: point.schedule, instructions: point.instructions, mapUrl: point.mapUrl ?? '', isActive: point.isActive }
}

type PickupFormProps = {
  initial: PickupPoint
  onBusy: (busy: boolean) => void
  onSaved: (point: PickupPoint) => void
}

function PickupForm({ initial, onBusy, onSaved }: PickupFormProps) {
  const form = useSaveForm()
  const [values, setValues] = useState(() => toValues(initial))

  function set(field: TextField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    form.clearField(field)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy) return
    onBusy(true)
    const result = await form.submit(
      (headers) => savePickupPoint(headers, initial.code, { ...values, mapUrl: values.mapUrl.trim() || null, isActive: values.isActive }),
      { done: 'Точку збережено.', failed: 'Точку не збережено.' },
    )
    onBusy(false)
    if (result?.data) onSaved(result.data)
  }

  return (
    <form id={FORM_ID} className="settings-drawer-form" onSubmit={onSubmit} noValidate aria-label={initial.name}>
      <Stack gap="md">
        <Group gap="xs">
          <Text className="settings-code" size="sm">
            {initial.code}
          </Text>
          {initial.isActive ? null : <TableChip tone="neutral" value="вимкнена" />}
        </Group>
        <TextInput label="Назва" value={values.name} error={fieldError(form.errors, 'name')} onChange={(event) => set('name', event.currentTarget.value)} data-autofocus />
        <TextInput label="Адреса" value={values.address} error={fieldError(form.errors, 'address')} onChange={(event) => set('address', event.currentTarget.value)} />
        <Textarea
          label="Графік роботи"
          autosize
          minRows={2}
          value={values.schedule}
          error={fieldError(form.errors, 'schedule')}
          onChange={(event) => set('schedule', event.currentTarget.value)}
        />
        <Textarea
          label="Інструкція покупцю"
          description="Як знайти точку й що мати із собою."
          autosize
          minRows={2}
          value={values.instructions}
          error={fieldError(form.errors, 'instructions')}
          onChange={(event) => set('instructions', event.currentTarget.value)}
        />
        <TextInput
          label="Посилання на карту"
          description="Можна лишити порожнім."
          type="url"
          placeholder="https://maps.app.goo.gl/…"
          value={values.mapUrl}
          error={fieldError(form.errors, 'mapUrl')}
          onChange={(event) => set('mapUrl', event.currentTarget.value)}
        />
        <Checkbox
          label="Доступна для самовивозу"
          checked={values.isActive}
          error={fieldError(form.errors, 'isActive')}
          onChange={(event) => {
            const isActive = event.currentTarget.checked
            setValues((current) => ({ ...current, isActive }))
            form.clearField('isActive')
          }}
        />
        <FormAlert error={form.error} />
      </Stack>
    </form>
  )
}
