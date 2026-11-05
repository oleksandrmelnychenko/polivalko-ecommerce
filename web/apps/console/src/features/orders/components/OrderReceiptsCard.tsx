import { Table } from '@mantine/core'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { receiptKindLabel } from '@polivalko/shared/lib/labels'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { TableChip } from '@/shared/ui/TableChip'
import { getOrderReceipts } from '../api/orderDetailApi'
import { receiptStateLabel, receiptTone } from '../lib/orderDetail'
import { OrderCard, OrderLoadState } from './OrderCard'

export function OrderReceiptsCard({ number, version }: { number: string; version: string }) {
  const receipts = useApiQuery(`order-receipts:${number}:${version}`, () => getOrderReceipts(number))
  const rows = receipts.data ?? []

  return (
    <OrderCard className="order-area-receipts order-no-print" title="Фіскальні чеки">
      <OrderLoadState
        state={receipts}
        empty={receipts.status === 'ready' && rows.length === 0 ? 'Чеків ще немає: їх видає ПРРО за погодженими правилами.' : undefined}
      >
        <Table.ScrollContainer minWidth={620} type="native">
          <Table className="order-table" verticalSpacing={8} horizontalSpacing={14}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">Чек</Table.Th>
                <Table.Th scope="col">Фіскальний номер</Table.Th>
                <Table.Th scope="col" className="is-num">
                  Сума
                </Table.Th>
                <Table.Th scope="col">Стан</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <span className="app-cell-stack">
                      <span>{receiptKindLabel[row.kind] ?? row.kind}</span>
                      <span className="app-cell-sub">
                        {row.provider}, {row.paymentType === 'CASH' ? 'готівка' : 'безготівково'}
                      </span>
                    </span>
                  </Table.Td>
                  <Table.Td>
                    {row.fiscalCode ? (
                      row.url ? (
                        <a className="order-code order-link" href={row.url} target="_blank" rel="noopener noreferrer">
                          {row.fiscalCode}
                        </a>
                      ) : (
                        <span className="order-code">{row.fiscalCode}</span>
                      )
                    ) : (
                      'ще немає'
                    )}
                  </Table.Td>
                  <Table.Td className="is-num is-strong">{formatMoney(row.amount)}</Table.Td>
                  <Table.Td>
                    <span className="order-wrap-stack">
                      <span>
                        <TableChip tone={receiptTone(row.status)} value={receiptStateLabel(row.status, row.issuedAt, formatDateTime)} />
                      </span>
                      {row.error ? <span className="order-muted">{row.error}</span> : null}
                    </span>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </OrderLoadState>
    </OrderCard>
  )
}
