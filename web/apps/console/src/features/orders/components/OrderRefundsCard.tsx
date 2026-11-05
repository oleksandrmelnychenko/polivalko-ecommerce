import { Table } from '@mantine/core'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { TableChip } from '@/shared/ui/TableChip'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { outcomeTone } from '../lib/orderDetail'
import { useRefund } from '../lib/useRefund'
import { OrderCard, OrderCardBody, OrderCardNote } from './OrderCard'
import { OrderRefundForm } from './OrderRefundForm'

export function OrderRefundsCard({ order, onChange }: { order: ConsoleOrder; onChange: (order: ConsoleOrder) => void }) {
  const { can } = usePermissions()
  const refund = useRefund(order, onChange)
  const canRefund = can(PermissionKeys.Orders.CreateRefund)
  const formAvailable = Boolean(order.refundMethod) && order.refundable.length > 0
  const hasRefunds = order.refunds.length > 0

  if (!hasRefunds && !canRefund) return null

  return (
    <OrderCard className="order-area-refunds order-no-print" title="Повернення">
      {hasRefunds ? (
        <Table.ScrollContainer minWidth={620} type="native">
          <Table className="order-table" verticalSpacing={8} horizontalSpacing={14}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Коли</Table.Th>
                <Table.Th scope="col">Товари</Table.Th>
                <Table.Th scope="col" className="is-num">
                  Сума
                </Table.Th>
                <Table.Th scope="col">Стан</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {order.refunds.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td className="is-nowrap">
                    <span className="app-cell-stack">
                      <span>{formatDateTime(row.createdAt)}</span>
                      <span className="app-cell-sub">{row.requestedBy}</span>
                    </span>
                  </Table.Td>
                  <Table.Td>
                    <span className="order-wrap-stack">
                      <span>{row.lines.map((line) => `${line.name} × ${line.quantity}`).join(', ')}</span>
                      <span className="order-muted">{row.reason}</span>
                    </span>
                  </Table.Td>
                  <Table.Td className="is-num is-strong">{formatMoney(row.amount)}</Table.Td>
                  <Table.Td>
                    <span className="order-wrap-stack">
                      <span>
                        <TableChip tone={outcomeTone(row.status)} value={refundStatusLabel[row.status] ?? row.status} />
                      </span>
                      <span className="order-muted">{row.method === 'provider' ? 'на картку' : 'поза сайтом'}</span>
                      {row.error ? <span className="order-muted">{row.error}</span> : null}
                    </span>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : null}

      {canRefund && formAvailable ? (
        <OrderCardBody className={hasRefunds ? 'order-card-body--split' : undefined}>
          <OrderRefundForm order={order} refund={refund} />
        </OrderCardBody>
      ) : canRefund && !hasRefunds ? (
        <OrderCardNote>Повернути можна оплачене онлайн замовлення або виконане замовлення з оплатою під час отримання.</OrderCardNote>
      ) : null}
    </OrderCard>
  )
}
