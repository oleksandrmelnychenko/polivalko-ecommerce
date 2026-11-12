import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { Money, NumberValue } from '@/shared/ui/Money'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import type { Customer } from '../api/customersApi'

export const CUSTOMERS_COLUMNS: DataTableColumn<Customer>[] = [
  {
    id: 'customer',
    header: 'Покупець',
    fill: true,
    width: 260,
    minWidth: 200,
    cell: (row) => (
      <span className="app-split-name-cell">
        <SplitAvatar name={row.name} size="sm" />
        <span className="app-split-row-text">
          <span className="app-split-item-name">{row.name}</span>
          <span className="app-split-row-sub">{row.phone}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'orders',
    header: 'Замовлень',
    accessor: (row) => row.orders,
    enableSorting: true,
    sortDescFirst: true,
    align: 'right',
    numeric: true,
    width: 120,
    cell: (row) => <NumberValue value={row.orders} />,
  },
  {
    id: 'totalSpent',
    header: 'Сума покупок',
    accessor: (row) => Number(row.totalSpent.value),
    enableSorting: true,
    sortDescFirst: true,
    align: 'right',
    numeric: true,
    width: 140,
    cell: (row) => <Money value={row.totalSpent} />,
  },
  {
    id: 'lastOrder',
    header: 'Останнє',
    accessor: (row) => row.lastOrderAt,
    enableSorting: true,
    sortDescFirst: true,
    width: 160,
    cell: (row) => <span className="app-split-item-meta">{shortWhen(row.lastOrderAt)}</span>,
  },
]
