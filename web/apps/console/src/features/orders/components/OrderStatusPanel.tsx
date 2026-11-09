import { Alert, Button, Group, Text, Textarea } from '@mantine/core'
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { AppModal, AppModalFooter } from '@/shared/ui/AppModal'
import { OrderStatusChip } from '@/shared/ui/StatusChip'
import type { ConsoleOrder } from '../api/orderDetailApi'
import type { OrderStatusChange } from '../lib/useOrderStatusChange'
import { OrderCard, OrderCardBody } from './OrderCard'

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Підтвердити замовлення',
  awaitingPayment: 'Передати на оплату карткою',
  shipped: 'Позначити відправленим',
  readyForPickup: 'Позначити готовим до видачі',
  completed: 'Позначити виконаним',
}

const ACTION_HINT: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Товар є, ціну погоджено з покупцем.',
  awaitingPayment: 'Покупцю відкриється оплата на сторінці замовлення.',
  shipped: 'Посилку передано Новій пошті.',
  readyForPickup: 'Замовлення зібране й чекає на покупця в магазині.',
  completed: 'Покупець отримав замовлення.',
}

function orderRoute(order: ConsoleOrder): OrderStatus[] {
  const start: OrderStatus = order.status === 'awaitingConfirmation' ? 'awaitingConfirmation' : 'new'
  const payment: OrderStatus[] = order.paymentMethod === 'card' ? ['awaitingPayment', 'paid'] : []
  const fulfilment: OrderStatus = order.deliveryMethod === 'pickup' ? 'readyForPickup' : 'shipped'
  return [start, 'confirmed', ...payment, fulfilment, 'completed']
}

export function OrderStatusPanel({ order, status }: { order: ConsoleOrder; status: OrderStatusChange }) {
  const { reason, setReason, busy, error, change } = status
  const [cancelOpen, setCancelOpen] = useState(false)
  const route = orderRoute(order)
  const current = route.indexOf(order.status)
  const cancelled = order.status === 'cancelled'
  const nextSteps = order.allowedTransitions.filter((next) => next !== 'cancelled')
  const canCancel = order.allowedTransitions.includes('cancelled')

  async function confirmCancel() {
    await change('cancelled')
    setCancelOpen(false)
  }

  return (
    <OrderCard className="order-area-status order-status-panel order-no-print" title="Статус замовлення">
      <OrderCardBody>
        <Group gap={8} mb="sm">
          <Text size="sm" c="dimmed">
            Зараз:
          </Text>
          <OrderStatusChip status={order.status} />
        </Group>

        {cancelled ? (
          <Text size="sm" c="dimmed">
            Замовлення скасоване, змінити статус уже не можна. Причину видно в історії нижче.
          </Text>
        ) : (
          <ol className="order-route" aria-label="Шлях замовлення">
            {route.map((step, index) => {
              const state = index < current ? 'done' : index === current ? 'current' : 'next'
              return (
                <li key={step} className="order-route-step" data-state={state}>
                  <span className="order-route-mark" aria-hidden="true">
                    {state === 'done' ? <IconCheck size={12} stroke={3} /> : null}
                  </span>
                  <span className="order-route-label">{orderStatusLabel[step] ?? step}</span>
                  {state === 'current' ? <span className="order-route-now">зараз</span> : null}
                </li>
              )
            })}
          </ol>
        )}

        {order.status === 'awaitingPayment' ? (
          <Text size="xs" c="dimmed" mt="sm">
            Чекаємо, поки покупець оплатить замовлення. Статус зміниться сам, щойно платіжний провайдер підтвердить оплату.
          </Text>
        ) : null}

        {nextSteps.length > 0 ? (
          <div className="order-status-next">
            <Textarea
              label="Коментар до зміни"
              placeholder="Необов'язково, видно в історії замовлення"
              value={reason}
              maxLength={300}
              autosize
              minRows={1}
              maxRows={4}
              disabled={busy !== null}
              onChange={(event) => setReason(event.currentTarget.value)}
            />
            {nextSteps.map((next) => (
              <div key={next} className="order-status-action">
                <Button fullWidth loading={busy === next} disabled={busy !== null && busy !== next} onClick={() => void change(next)}>
                  {ACTION_LABEL[next] ?? `Перевести в «${orderStatusLabel[next] ?? next}»`}
                </Button>
                {ACTION_HINT[next] ? (
                  <Text size="xs" c="dimmed">
                    {ACTION_HINT[next]}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {canCancel ? (
          <Button
            className="order-status-cancel"
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<IconX size={14} stroke={2} />}
            disabled={busy !== null}
            onClick={() => {
              setReason('')
              setCancelOpen(true)
            }}
          >
            Скасувати замовлення
          </Button>
        ) : null}

        <Text size="xs" c="dimmed" mt="sm">
          Статус оплати змінює лише підтвердження платіжного провайдера.
        </Text>

        {error && !cancelOpen ? (
          <Alert mt="sm" color="red" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        ) : null}
      </OrderCardBody>

      <AppModal
        opened={cancelOpen}
        title={`Скасувати замовлення ${order.number}?`}
        size={460}
        closeOnClickOutside={busy === null}
        closeOnEscape={busy === null}
        withCloseButton={busy === null}
        onClose={() => setCancelOpen(false)}
      >
        <Text size="sm" mb="sm">
          Покупець побачить статус «Скасоване». Змінити статус після цього вже не можна.
        </Text>
        <Textarea
          label="Причина скасування"
          placeholder="Наприклад: покупець відмовився, товару немає"
          required
          value={reason}
          maxLength={300}
          autosize
          minRows={2}
          maxRows={5}
          disabled={busy !== null}
          onChange={(event) => setReason(event.currentTarget.value)}
          data-autofocus
        />
        {error ? (
          <Alert mt="sm" color="red" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        ) : null}
        <AppModalFooter>
          <Button variant="default" disabled={busy !== null} onClick={() => setCancelOpen(false)}>
            Не скасовувати
          </Button>
          <Button color="red" loading={busy === 'cancelled'} disabled={!reason.trim()} onClick={() => void confirmCancel()}>
            Скасувати замовлення
          </Button>
        </AppModalFooter>
      </AppModal>
    </OrderCard>
  )
}
