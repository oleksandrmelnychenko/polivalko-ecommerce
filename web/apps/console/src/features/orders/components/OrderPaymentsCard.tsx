import { Table } from '@mantine/core'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { TableChip } from '@/shared/ui/TableChip'
import { getOrderPayments } from '../api/orderDetailApi'
import { attemptLabel, outcomeTone } from '../lib/orderDetail'
import { OrderCard, OrderLoadState } from './OrderCard'

export function OrderPaymentsCard({ number, version }: { number: string; version: string }) {
  const payments = useApiQuery(`order-payments:${number}:${version}`, () => getOrderPayments(number))
  const rows = payments.data ?? []

  return (
    <OrderCard className="order-area-payments order-no-print" title="Онлайн-оплата">
      <OrderLoadState state={payments} empty={payments.status === 'ready' && rows.length === 0 ? 'Спроб онлайн-оплати не було.' : undefined}>
        <Table.ScrollContainer minWidth={620} type="native">
          <Table className="order-table" verticalSpacing={8} horizontalSpacing={14}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Створено</Table.Th>
                <Table.Th scope="col">Провайдер</Table.Th>
                <Table.Th scope="col">Стан</Table.Th>
                <Table.Th scope="col" className="is-num">
                  Сума
                </Table.Th>
                <Table.Th scope="col" className="is-num">
                  Повідомлень
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td className="is-nowrap">{formatDateTime(row.createdAt)}</Table.Td>
                  <Table.Td>
                    <span className="app-cell-stack">
                      <span>{row.provider}</span>
                      {row.providerPaymentId ? <span className="app-cell-sub order-code">{row.providerPaymentId}</span> : null}
                    </span>
                  </Table.Td>
                  <Table.Td>
                    <span className="order-wrap-stack">
                      <span>
                        <TableChip tone={outcomeTone(row.status)} value={attemptLabel[row.status] ?? row.status} />
                      </span>
                      {row.failureReason ? <span className="order-muted">{row.failureReason}</span> : null}
                    </span>
                  </Table.Td>
                  <Table.Td className="is-num is-strong">{formatMoney(row.amount)}</Table.Td>
                  <Table.Td className="is-num">{row.eventsCount}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </OrderLoadState>
    </OrderCard>
  )
}
