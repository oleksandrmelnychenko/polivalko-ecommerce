import { Button, Stack, Text } from '@mantine/core'
import { useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel } from '@polivalko/shared/lib/labels'
import { problemMessage } from '@/shared/api/problem'
import type { ApiQueryStatus } from '@/shared/api/useApiQuery'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack, Money } from '@/shared/ui/Money'
import { OrderStatusChip, PaymentStatusChip } from '@/shared/ui/StatusChip'
import type { LatestOrder } from '../api/dashboardApi'
import { DashboardCard } from './DashboardCard'

const orderHref = (number: string) => `/sales/orders/${encodeURIComponent(number)}`
const getRowId = (row: LatestOrder) => row.number

const columns: DataTableColumn<LatestOrder>[] = [
  {
    id: 'number',
    header: 'Замовлення',
    width: 180,
    cell: (row) => <CellStack code title={<Link to={orderHref(row.number)}>{row.number}</Link>} sub={formatDateTime(row.createdAt)} />,
  },
  { id: 'customer', header: 'Покупець', width: 220, fill: true, cell: (row) => <CellStack title={row.customerName} sub={row.phone} /> },
  { id: 'total', header: 'Сума', width: 130, align: 'right', numeric: true, cell: (row) => <Money value={row.total} sub={`${row.itemsCount} поз.`} /> },
  { id: 'status', header: 'Статус', width: 190, cell: (row) => <OrderStatusChip status={row.status} /> },
  { id: 'paymentStatus', header: 'Оплата', width: 200, cell: (row) => <PaymentStatusChip status={row.paymentStatus} /> },
  { id: 'delivery', header: 'Отримання', width: 170, cell: (row) => deliveryMethodLabel[row.deliveryMethod] ?? row.deliveryMethod },
]

type LatestOrdersProps = {
  items: LatestOrder[] | undefined
  status: ApiQueryStatus
  problem: unknown
  isLoading: boolean
  isFetching: boolean
  onRetry: () => void
}

export function LatestOrders({ items, status, problem, isLoading, isFetching, onRetry }: LatestOrdersProps) {
  const navigate = useNavigate()
  const onRowClick = useCallback((row: LatestOrder) => navigate(orderHref(row.number)), [navigate])
  const failed = status === 'error' || status === 'forbidden'
  const rows = failed ? [] : (items ?? [])

  const emptyText = failed ? (
    <Stack align="center" gap={8}>
      <Text size="sm">{problemMessage(problem, 'Не вдалося завантажити замовлення.')}</Text>
      <Button size="xs" variant="default" onClick={onRetry}>
        Спробувати ще раз
      </Button>
    </Stack>
  ) : (
    "Замовлень ще немає. Вони з'являться тут одразу після оформлення на сайті."
  )

  return (
    <DashboardCard
      className="dash-latest"
      title="Останні замовлення"
      flush
      aside={
        <Link to="/sales/orders" className="dash-link">
          Усі замовлення
        </Link>
      }
    >
      <DataTable
        ariaLabel="Останні замовлення"
        columns={columns}
        data={rows}
        getRowId={getRowId}
        isLoading={isLoading}
        isFetching={isFetching}
        minWidth={900}
        onRowClick={onRowClick}
        emptyText={emptyText}
      />
    </DashboardCard>
  )
}
