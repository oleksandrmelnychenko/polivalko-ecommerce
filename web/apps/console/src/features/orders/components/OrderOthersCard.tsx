import { Anchor } from '@mantine/core'
import { Link } from 'react-router-dom'
import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { getOrders } from '../api/ordersApi'
import { orderHref } from '../lib/orderFilters'
import { OrderCard, OrderCardBody, OrderLoadState } from './OrderCard'

export function OrderOthersCard({ phone, current }: { phone: string; current: string }) {
  const others = useApiQuery(`order-others:${phone}`, () => getOrders({ q: phone, page: 1, pageSize: 6 }))
  const loaded = others.status === 'ready' ? others.data : undefined
  const rows = loaded?.items.filter((row) => row.number !== current) ?? []
  const total = loaded ? Math.max(loaded.totalItems - 1, 0) : 0

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
      <OrderLoadState state={others} empty={loaded && rows.length === 0 ? 'Це перше замовлення покупця.' : undefined}>
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
      </OrderLoadState>
    </OrderCard>
  )
}
