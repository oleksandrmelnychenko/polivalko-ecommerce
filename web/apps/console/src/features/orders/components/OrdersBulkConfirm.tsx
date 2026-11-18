import { Button, Text, Textarea } from '@mantine/core'
import { useState } from 'react'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { plural } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'

type OrdersBulkConfirmProps = {
  opened: boolean
  status: OrderStatus | null
  count: number
  busy: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}

export function OrdersBulkConfirm({ opened, status, count, busy, onConfirm, onClose }: OrdersBulkConfirmProps) {
  const cancelling = status === 'cancelled'
  return (
    <AppModal
      opened={opened && status !== null}
      title={cancelling ? 'Скасувати замовлення' : 'Змінити статус'}
      size={460}
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
      onClose={onClose}
    >
      {status ? <BulkConfirmBody status={status} count={count} busy={busy} onConfirm={onConfirm} onClose={onClose} /> : null}
    </AppModal>
  )
}

type BulkConfirmBodyProps = Omit<OrdersBulkConfirmProps, 'opened' | 'status'> & { status: OrderStatus }

function BulkConfirmBody({ status, count, busy, onConfirm, onClose }: BulkConfirmBodyProps) {
  const [reason, setReason] = useState('')
  const cancelling = status === 'cancelled'
  const orders = `${count} ${plural(count, 'замовлення', 'замовлення', 'замовлень')}`

  return (
    <>
      {cancelling ? (
        <>
          <Text size="sm" mb="sm">
            Скасувати {orders}? Покупці побачать статус «Скасоване». Змінити статус після цього вже не можна.
          </Text>
          <Textarea
            label="Причина скасування"
            description="Одна для всіх вибраних замовлень, видно в історії кожного."
            placeholder="Наприклад: покупець відмовився, товару немає"
            required
            value={reason}
            maxLength={300}
            autosize
            minRows={2}
            maxRows={5}
            disabled={busy}
            onChange={(event) => setReason(event.currentTarget.value)}
            data-autofocus
          />
        </>
      ) : (
        <Text size="sm">
          Встановити статус «{orderStatusLabel[status]}» для {orders}?
        </Text>
      )}
      <AppModalFooter>
        <Button variant="default" disabled={busy} onClick={onClose}>
          {cancelling ? 'Не скасовувати' : 'Скасувати'}
        </Button>
        {cancelling ? (
          <Button color="red" loading={busy} disabled={!reason.trim()} onClick={() => onConfirm(reason)}>
            Скасувати замовлення
          </Button>
        ) : (
          <Button loading={busy} onClick={() => onConfirm('')} data-autofocus>
            Змінити статус
          </Button>
        )}
      </AppModalFooter>
    </>
  )
}
