import { Anchor } from '@mantine/core'
import { Link } from 'react-router-dom'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getOrders } from '../api/ordersApi'
import { orderHref } from '../lib/orderFilters'
import { OrderCard, OrderCardBody, OrderCardNote } from './OrderCard'

export function OrderOthersCard({ phone, current }: { phone: string; current: string }) {
  const others = useApiQuery(`order-others:${phone}`, () => getOrders({ q: phone, page: 1, pageSize: 6 }))
  const rows = others.data?.items.filter((row) => row.number !== current) ?? []
  const total = Math.max((others.data?.totalItems ?? 1) - 1, 0)

  return (
    <OrderCard
      className="order-area-others order-no-print"
      title="Інші замовлення"
      aside={
        total > rows.length ? (
          <Anchor component={Link} to={`/sales/orders?q=${encodeURIComponent(phone)}`} size="sm" fw={600}>
            Усі {total}
          </Anchor>
        ) : null
      }
    >
      {others.status === 'loading' ? (
        <OrderCardNote>Завантажуємо…</OrderCardNote>
      ) : rows.length === 0 ? (
        <OrderCardNote>Це перше замовлення покупця.</OrderCardNote>
      ) : (
        <OrderCardBody className="order-others-body">
          <ul className="order-others">
            {rows.map((row) => (
              <li key={row.number}>
                <span className="app-cell-stack">
                  <Link className="order-others-number" to={orderHref(row.number)}>
                    {row.number}
                  </Link>
                  <span className="app-cell-sub">{formatDateTime(row.createdAt)}</span>
                </span>
                <span className="app-cell-stack order-others-side">
                  <span className="app-money">{formatMoney(row.total)}</span>
                  <span className="app-cell-sub">{orderStatusLabel[row.status] ?? row.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </OrderCardBody>
      )}
    </OrderCard>
  )
}
