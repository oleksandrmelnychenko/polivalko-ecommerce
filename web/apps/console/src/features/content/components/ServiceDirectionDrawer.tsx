import { Button, Checkbox, Group, NumberInput, Stack, Text, Textarea } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { AppDrawer } from '@/shared/ui/AppDrawer'
import { TableChip } from '@/shared/ui/TableChip'
import { saveService, type ServiceDirection } from '../api/contentApi'
import { useSaveForm } from '../lib/useSaveForm'
import { FormAlert } from './FormAlert'
import { ImageField } from './ImageField'

const FORM_ID = 'content-direction-form'

type ServiceDirectionDrawerProps = {
  direction: ServiceDirection | null
  opened: boolean
  onClose: () => void
  onSaved: (direction: ServiceDirection) => void
}

export function ServiceDirectionDrawer({ direction, opened, onClose, onSaved }: ServiceDirectionDrawerProps) {
  const [busy, setBusy] = useState(false)

  return (
    <AppDrawer
      opened={opened}
      onClose={busy ? () => undefined : onClose}
      title={direction?.name ?? 'Напрямок послуг'}
      size="compact"
      footer={
        <Group justify="flex-end" gap="sm">
          <Button variant="default" disabled={busy} onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy} leftSection={<IconDeviceFloppy size={16} stroke={1.8} />}>
            Зберегти
          </Button>
        </Group>
      }
    >
      {direction ? <DirectionForm key={direction.code} initial={direction} onBusy={setBusy} onSaved={onSaved} /> : null}
    </AppDrawer>
  )
}

type DirectionFormProps = {
  initial: ServiceDirection
  onBusy: (busy: boolean) => void
  onSaved: (direction: ServiceDirection) => void
}

function DirectionForm({ initial, onBusy, onSaved }: DirectionFormProps) {
  const form = useSaveForm()
  const [description, setDescription] = useState(initial.description ?? '')
  const [sortOrder, setSortOrder] = useState<string | number>(initial.sortOrder)
  const [visible, setVisible] = useState(initial.isVisible)
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? '')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (form.busy) return
    const order = Number(sortOrder)
    if (String(sortOrder).trim() === '' || !Number.isInteger(order)) {
      form.invalid({ sortOrder: 'Вкажіть ціле число.' })
      return
    }
    onBusy(true)
    const result = await form.submit(
      (headers) => saveService(headers, initial.code, { description: description.trim() || null, sortOrder: order, isVisible: visible, imageUrl: imageUrl || null }),
      { done: 'Збережено.', failed: 'Напрямок не збережено.' },
    )
    onBusy(false)
    if (result?.data) onSaved(result.data)
  }

  return (
    <form id={FORM_ID} className="content-drawer-form" onSubmit={onSubmit} noValidate aria-label={initial.name}>
      <Stack gap="md">
        <Group gap="xs">
          <Text className="content-code" size="sm">
            {initial.code}
          </Text>
          {initial.isVisible ? null : <TableChip tone="neutral" value="прихований на сайті" />}
        </Group>
        <Textarea
          label="Опис"
          description="До 1000 символів."
          value={description}
          maxLength={1000}
          autosize
          minRows={4}
          error={form.errors.description}
          onChange={(event) => {
            setDescription(event.currentTarget.value)
            form.clearField('description')
          }}
          data-autofocus
        />
        <ImageField
          label="Фото"
          description="Показується біля напрямку на сторінці послуг. Найкраще горизонтальне, від 960 px завширшки."
          shape="wide"
          value={imageUrl}
          error={form.errors.imageUrl}
          onChange={(url) => {
            setImageUrl(url)
            form.clearField('imageUrl')
          }}
        />
        <NumberInput
          label="Порядок"
          value={sortOrder}
          allowDecimal={false}
          step={1}
          w={160}
          error={form.errors.sortOrder}
          onChange={(value) => {
            setSortOrder(value)
            form.clearField('sortOrder')
          }}
        />
        <Checkbox
          label="Показувати на сайті"
          checked={visible}
          error={form.errors.isVisible}
          onChange={(event) => {
            setVisible(event.currentTarget.checked)
            form.clearField('isVisible')
          }}
        />
        <FormAlert error={form.error} />
      </Stack>
    </form>
  )
}
