import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel } from '@polivalko/shared/lib/labels'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack, Money } from '@/shared/ui/Money'
import { OrderStatusChip, PaymentStatusChip } from '@/shared/ui/StatusChip'
import type { OrderRow } from '../api/ordersApi'
import { orderHref, SORT_COLUMN } from '../lib/orderFilters'

export const ordersColumns: DataTableColumn<OrderRow>[] = [
  {
    id: SORT_COLUMN.date,
    header: 'Замовлення',
    accessor: (row) => row.createdAt,
    enableSorting: true,
    sortDescFirst: true,
    width: 190,
    cell: (row) => <CellStack code title={<Link to={orderHref(row.number)}>{row.number}</Link>} sub={formatDateTime(row.createdAt)} />,
  },
  {
    id: 'customer',
    header: 'Покупець',
    width: 240,
    fill: true,
    cell: (row) => <CellStack title={row.customerName} sub={row.phone} />,
  },
  {
    id: SORT_COLUMN.total,
    header: 'Сума',
    accessor: (row) => Number(row.total.value),
    enableSorting: true,
    sortDescFirst: true,
    align: 'right',
    numeric: true,
    width: 140,
    cell: (row) => <Money value={row.total} sub={`${row.itemsCount} поз.`} />,
  },
  { id: 'status', header: 'Статус', width: 200, cell: (row) => <OrderStatusChip status={row.status} /> },
  { id: 'paymentStatus', header: 'Оплата', width: 210, cell: (row) => <PaymentStatusChip status={row.paymentStatus} /> },
  { id: 'delivery', header: 'Отримання', width: 190, cell: (row) => deliveryMethodLabel[row.deliveryMethod] ?? row.deliveryMethod },
]
