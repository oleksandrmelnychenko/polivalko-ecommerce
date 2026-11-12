import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel } from '@polivalko/shared/lib/labels'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { Money, NumberValue } from '@/shared/ui/Money'
import { OrderStatusChip, PaymentStatusChip } from '@/shared/ui/StatusChip'
import type { OrderRow } from '../api/ordersApi'
import { orderHref, SORT_COLUMN } from '../lib/orderFilters'

export const ordersColumns: DataTableColumn<OrderRow>[] = [
  {
    id: 'number',
    header: 'Номер',
    width: 120,
    cell: (row) => (
      <Link className="app-cell-code" to={orderHref(row.number)}>
        {row.number}
      </Link>
    ),
  },
  {
    id: SORT_COLUMN.date,
    header: 'Дата',
    accessor: (row) => row.createdAt,
    enableSorting: true,
    sortDescFirst: true,
    width: 170,
    cell: (row) => <span className="app-number">{formatDateTime(row.createdAt)}</span>,
  },
  {
    id: 'customer',
    header: 'Покупець',
    fill: true,
    width: 200,
    minWidth: 160,
    cell: (row) => <span className="app-cell-title">{row.customerName}</span>,
  },
  {
    id: 'phone',
    header: 'Телефон',
    width: 150,
    cell: (row) => <span className="app-number">{row.phone}</span>,
  },
  {
    id: 'itemsCount',
    header: 'Позицій',
    align: 'right',
    numeric: true,
    width: 90,
    cell: (row) => <NumberValue value={row.itemsCount} />,
  },
  {
    id: SORT_COLUMN.total,
    header: 'Сума',
    accessor: (row) => Number(row.total.value),
    enableSorting: true,
    sortDescFirst: true,
    align: 'right',
    numeric: true,
    width: 120,
    cell: (row) => <Money value={row.total} />,
  },
  { id: 'status', header: 'Статус', width: 180, cell: (row) => <OrderStatusChip status={row.status} /> },
  { id: 'paymentStatus', header: 'Оплата', width: 200, cell: (row) => <PaymentStatusChip status={row.paymentStatus} /> },
  { id: 'delivery', header: 'Отримання', width: 170, cell: (row) => deliveryMethodLabel[row.deliveryMethod] ?? row.deliveryMethod },
]
