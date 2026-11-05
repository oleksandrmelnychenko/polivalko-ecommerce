import { Alert, Button, NumberInput, Table, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle, IconReceiptRefund } from '@tabler/icons-react'
import { formatMoney } from '@polivalko/shared/lib/format'
import type { ConsoleOrder } from '../api/orderDetailApi'
import type { OrderRefundState } from '../lib/useRefund'

export function OrderRefundForm({ order, refund }: { order: ConsoleOrder; refund: OrderRefundState }) {
  const { quantities, setQuantity, reason, setReason, busy, error, refundable, amount, canSubmit, submit } = refund
  const lines = order.items.filter((item) => refundable.has(item.productId))

  return (
    <form className="order-refund-form" onSubmit={(event) => void submit(event)} noValidate>
      <Text size="xs" c="dimmed">
        {order.refundMethod === 'provider'
          ? 'Кошти повернуться на картку покупця через платіжну систему; чек повернення видасться автоматично.'
          : 'Повернення готівкою чи переказом поза сайтом: сайт зафіксує його й видасть чек повернення, якщо продаж фіскалізував сайт.'}
      </Text>
      <Table.ScrollContainer minWidth={300} type="native">
        <Table className="order-table" verticalSpacing={6} horizontalSpacing={14}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th scope="col">Товар</Table.Th>
              <Table.Th scope="col" className="is-num">
                Можна
              </Table.Th>
              <Table.Th scope="col" className="is-num">
                Повернути
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((item) => {
              const max = refundable.get(item.productId) ?? 0
              return (
                <Table.Tr key={item.productId}>
                  <Table.Td>{item.name}</Table.Td>
                  <Table.Td className="is-num">{max}</Table.Td>
                  <Table.Td className="is-num">
                    <NumberInput
                      className="order-refund-qty"
                      aria-label={`Скільки повернути: ${item.name}`}
                      min={0}
                      max={max}
                      allowDecimal={false}
                      allowNegative={false}
                      size="xs"
                      w={92}
                      disabled={busy}
                      value={quantities[item.productId] ?? 0}
                      onChange={(value) => setQuantity(item.productId, Number(value))}
                    />
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <TextInput
        label="Причина"
        value={reason}
        maxLength={500}
        required
        disabled={busy}
        autoComplete="off"
        onChange={(event) => setReason(event.currentTarget.value)}
      />
      <div className="order-refund-actions">
        <Button type="submit" size="sm" leftSection={<IconReceiptRefund size={16} stroke={1.8} />} disabled={!canSubmit} loading={busy}>
          Повернути {amount > 0 ? formatMoney({ value: amount.toFixed(2), currency: 'UAH' }) : ''}
        </Button>
      </div>
      {error ? (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {error}
        </Alert>
      ) : null}
    </form>
  )
}
