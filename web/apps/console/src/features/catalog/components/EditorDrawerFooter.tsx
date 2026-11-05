import { Button, Group } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import type { ReactNode } from 'react'

type EditorDrawerFooterProps = {
  formId: string
  busy: boolean
  onCancel: () => void
  onDelete?: () => void
  extra?: ReactNode
}

export function EditorDrawerFooter({ formId, busy, onCancel, onDelete, extra }: EditorDrawerFooterProps) {
  return (
    <Group justify="space-between" w="100%" wrap="wrap" gap="xs">
      <Group gap={4}>
        {onDelete ? (
          <Button variant="subtle" color="red" leftSection={<IconTrash size={16} stroke={1.7} />} disabled={busy} onClick={onDelete}>
            Видалити
          </Button>
        ) : null}
        {extra}
      </Group>
      <Group gap="xs">
        <Button variant="default" disabled={busy} onClick={onCancel}>
          Скасувати
        </Button>
        <Button type="submit" form={formId} loading={busy}>
          Зберегти
        </Button>
      </Group>
    </Group>
  )
}
