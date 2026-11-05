import { Alert, Button, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconChevronRight } from '@tabler/icons-react'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import type { ConsoleOrder } from '../api/orderDetailApi'
import type { OrderStatusChange } from '../lib/useOrderStatusChange'
import { OrderCard, OrderCardBody } from './OrderCard'

export function OrderStatusPanel({ order, status }: { order: ConsoleOrder; status: OrderStatusChange }) {
  const { reason, setReason, busy, error, change } = status

  return (
    <OrderCard className="order-area-status order-status-panel order-no-print" title="Змінити статус">
      <OrderCardBody>
        {order.allowedTransitions.length === 0 ? (
          <Text size="sm" c="dimmed">
            Зі статусу «{orderStatusLabel[order.status] ?? order.status}» переходів немає.
          </Text>
        ) : (
          <>
            <TextInput
              label="Причина або коментар"
              placeholder="Необов'язково…"
              value={reason}
              maxLength={300}
              autoComplete="off"
              disabled={busy !== null}
              onChange={(event) => setReason(event.currentTarget.value)}
            />
            <div className="order-status-actions">
              {order.allowedTransitions.map((next) => (
                <Button
                  key={next}
                  fullWidth
                  justify="space-between"
                  variant={next === 'cancelled' ? 'light' : 'default'}
                  color={next === 'cancelled' ? 'red' : 'gray'}
                  rightSection={<IconChevronRight size={16} stroke={1.8} />}
                  loading={busy === next}
                  disabled={busy !== null && busy !== next}
                  onClick={() => void change(next)}
                >
                  {orderStatusLabel[next] ?? next}
                </Button>
              ))}
            </div>
          </>
        )}
        <Text size="xs" c="dimmed" mt="sm">
          Статус оплати змінює лише підтвердження платіжного провайдера.
        </Text>
        {error ? (
          <Alert mt="sm" color="red" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
            {error}
          </Alert>
        ) : null}
      </OrderCardBody>
    </OrderCard>
  )
}
