import { Button } from '@mantine/core'
import { Link } from 'react-router-dom'
import { formatDateTime, plural } from '@polivalko/shared/lib/format'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack, Money, NumberValue } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { Customer } from '../api/customersApi'
import { ordersOfCustomerHref } from '../lib/customersState'
import { initials } from '../lib/initials'

const orderHref = (number: string) => `/sales/orders/${encodeURIComponent(number)}`

export function customersColumns(canViewOrders: boolean): DataTableColumn<Customer>[] {
  const columns: DataTableColumn<Customer>[] = [
    {
      id: 'customer',
      header: 'Покупець',
      width: 260,
      fill: true,
      cell: (row) => (
        <span className="customers-person">
          <span className="customers-avatar" aria-hidden="true">
            {initials(row.name)}
          </span>
          <CellStack title={row.name} sub={row.email ?? 'без email'} />
        </span>
      ),
    },
    {
      id: 'phone',
      header: 'Телефон',
      width: 150,
      cell: (row) => (
        <a className="customers-phone" href={`tel:${row.phone}`}>
          {row.phone}
        </a>
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
      width: 150,
      cell: (row) => (row.orders > 1 ? <TableChip tone="success" value={`${row.orders} · постійний`} /> : <NumberValue value={row.orders} />),
    },
    {
      id: 'totalSpent',
      header: 'Сума покупок',
      accessor: (row) => Number(row.totalSpent.value),
      enableSorting: true,
      sortDescFirst: true,
      align: 'right',
      numeric: true,
      width: 150,
      cell: (row) => <Money value={row.totalSpent} />,
    },
    {
      id: 'firstOrderAt',
      header: 'Перше',
      width: 165,
      cell: (row) => <span className="app-number">{formatDateTime(row.firstOrderAt)}</span>,
    },
    {
      id: 'lastOrder',
      header: 'Останнє',
      accessor: (row) => row.lastOrderAt,
      enableSorting: true,
      sortDescFirst: true,
      width: 170,
      cell: (row) => (
        <CellStack
          code
          title={canViewOrders ? <Link to={orderHref(row.lastOrderNumber)}>{row.lastOrderNumber}</Link> : row.lastOrderNumber}
          sub={formatDateTime(row.lastOrderAt)}
        />
      ),
    },
  ]

  if (!canViewOrders) return columns

  return [
    ...columns,
    {
      id: 'actions',
      header: <span className="visually-hidden">Дії</span>,
      align: 'right',
      width: 150,
      cell: (row) => (
        <Button component={Link} to={ordersOfCustomerHref(row.phone)} variant="default" size="compact-sm" className="customers-orders-link">
          {row.orders} {plural(row.orders, 'замовлення', 'замовлення', 'замовлень')}
        </Button>
      ),
    },
  ]
}
