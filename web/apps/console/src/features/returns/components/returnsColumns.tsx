import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack, Money } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { RefundRow } from '../api/returnsApi'
import { orderHref, receiptLabel, receiptTone, refundMethodLabel, refundTone } from '../lib/returnsLabels'

export const returnsColumns: DataTableColumn<RefundRow>[] = [
  {
    id: 'order',
    header: 'Замовлення',
    width: 190,
    cell: (row) => <CellStack code title={<Link to={orderHref(row.orderNumber)}>{row.orderNumber}</Link>} sub={formatDateTime(row.createdAt)} />,
  },
  {
    id: 'amount',
    header: 'Сума',
    align: 'right',
    numeric: true,
    width: 140,
    cell: (row) => <Money value={row.amount} />,
  },
  {
    id: 'status',
    header: 'Стан',
    width: 170,
    cell: (row) => <CellStack title={<TableChip dot tone={refundTone(row.status)} value={refundStatusLabel[row.status] ?? row.status} />} sub={refundMethodLabel(row.method)} />,
  },
  {
    id: 'receipt',
    header: 'Чек повернення',
    width: 160,
    cell: (row) => (row.receiptStatus ? <TableChip tone={receiptTone(row.receiptStatus)} value={receiptLabel(row.receiptStatus)} /> : <span className="returns-muted">немає</span>),
  },
  {
    id: 'reason',
    header: 'Причина',
    width: 280,
    fill: true,
    cell: (row) => <span className="returns-reason">{row.reason || '—'}</span>,
  },
  {
    id: 'createdBy',
    header: 'Оформив',
    width: 180,
    cell: (row) => row.createdBy || '—',
  },
]
