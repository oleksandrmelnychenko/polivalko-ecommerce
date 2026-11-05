import { Button, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { AppModal, AppModalFooter } from './AppModal'

type ConfirmDialogProps = {
  opened: boolean
  title: ReactNode
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  opened,
  title,
  message,
  confirmLabel = 'Підтвердити',
  cancelLabel = 'Скасувати',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <AppModal opened={opened} title={title} size={440} closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy} onClose={onClose}>
      {typeof message === 'string' ? <Text size="sm">{message}</Text> : message}
      <AppModalFooter>
        <Button variant="default" disabled={busy} onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button color={danger ? 'red' : 'brand'} loading={busy} onClick={onConfirm} data-autofocus>
          {confirmLabel}
        </Button>
      </AppModalFooter>
    </AppModal>
  )
}
