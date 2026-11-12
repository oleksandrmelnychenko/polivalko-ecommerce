import { IconReceiptRefund } from '@tabler/icons-react'
import { refundStatusLabel } from '@polivalko/shared/lib/labels'
import { shortWhen } from '@/shared/lib/when'
import { refundTone } from '@/shared/sales/SalesLists'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { Money } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { RefundRow } from '../api/returnsApi'

export const RETURNS_COLUMNS: DataTableColumn<RefundRow>[] = [
  {
    id: 'order',
    header: 'Замовлення',
    fill: true,
    width: 240,
    minWidth: 200,
    cell: (row) => (
      <span className="app-split-name-cell">
        <span className="app-split-kind-icon">
          <IconReceiptRefund size={16} stroke={1.6} />
        </span>
        <span className="app-split-row-text">
          <span className="app-split-item-name app-split-mono">{row.orderNumber}</span>
          <span className="app-split-row-sub">{shortWhen(row.createdAt)}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'amount',
    header: 'Сума',
    align: 'right',
    numeric: true,
    width: 130,
    cell: (row) => <Money value={row.amount} />,
  },
  {
    id: 'status',
    header: 'Стан',
    width: 150,
    cell: (row) => <TableChip dot tone={refundTone(row.status)} value={refundStatusLabel[row.status] ?? row.status} />,
  },
]
