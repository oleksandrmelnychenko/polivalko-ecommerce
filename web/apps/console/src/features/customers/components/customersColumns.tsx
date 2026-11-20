import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { Money, NumberValue } from '@/shared/ui/Money'
import { SplitAvatar } from '@/shared/ui/split/SplitAvatar'
import type { Customer } from '../api/customersApi'

export function customersColumns(select: (row: Customer) => void, compact: boolean): DataTableColumn<Customer>[] {
  const columns: DataTableColumn<Customer>[] = [
    {
      id: 'customer',
      header: 'Покупець',
      fill: true,
      width: compact ? 145 : 260,
      minWidth: compact ? 125 : 200,
      cell: (row) => (
        <button type="button" className="customer-trigger" aria-haspopup="dialog" onClick={() => select(row)}>
          <SplitAvatar name={row.name} size="sm" />
          <span className="app-split-row-text">
            <span className="app-split-item-name">{row.name}</span>
            <span className="app-split-row-sub customer-phone">{row.phone}</span>
          </span>
        </button>
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
      width: compact ? 116 : 140,
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
  return compact ? columns.filter((column) => column.id === 'customer' || column.id === 'totalSpent') : columns
}
