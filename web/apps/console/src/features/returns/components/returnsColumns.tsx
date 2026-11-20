import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import { IconReceiptRefund } from '@tabler/icons-react'
import { shortWhen } from '@/shared/lib/when'
import { refundTone } from '@/shared/sales/SalesLists'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { Money } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { RefundRow } from '../api/returnsApi'
import { methodLabel } from '../lib/returnsLabels'

function statusChip(row: RefundRow) {
  return <TableChip dot tone={refundTone(row.status)} value={refundStatusLabel[row.status]} />
}

export function returnsColumns(select: (row: RefundRow) => void, compact: boolean): DataTableColumn<RefundRow>[] {
  const columns: DataTableColumn<RefundRow>[] = [
    {
      id: 'order', header: 'Замовлення', fill: true, minWidth: compact ? 125 : 165,
      cell: (row) => (
        <button className="return-trigger" type="button" aria-haspopup="dialog" onClick={() => select(row)}>
          <IconReceiptRefund size={16} stroke={1.7} aria-hidden="true" />
          <span><b>{row.orderNumber}</b>{compact && <small>{shortWhen(row.createdAt)}</small>}</span>
        </button>
      ),
    },
  ]
  if (!compact) columns.push(
    { id: 'created', header: 'Оформлено', width: 178, cell: (row) => <span className="return-number">{shortWhen(row.createdAt)}</span> },
    { id: 'method', header: 'Спосіб', width: 136, cell: (row) => methodLabel(row.method) },
    { id: 'status', header: 'Стан', width: 142, cell: statusChip },
  )
  columns.push({
    id: 'amount', header: 'Сума', align: 'right', width: compact ? 125 : 145,
    cell: (row) => <span className="return-amount"><Money value={row.amount} />{compact && statusChip(row)}</span>,
  })
  return columns
}
