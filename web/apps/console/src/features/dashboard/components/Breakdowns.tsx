import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { deliveryMethodLabel, orderStatusLabel } from '@polivalko/shared/lib/labels'
import { OrderStatusChip } from '@/shared/ui/StatusChip'
import type { Dashboard } from '../api/dashboardApi'
import { numberFormat, share } from '../lib/insights'
import { DashboardCard } from './DashboardCard'

type BarItem = { key: string; label: ReactNode; count: number }

function BarList({ items }: { items: BarItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const max = Math.max(...items.map((item) => item.count), 1)
  return (
    <ul className="dash-barlist">
      {[...items]
        .sort((a, b) => b.count - a.count)
        .map((item) => (
          <li key={item.key}>
            <span className="dash-barlist-name">{item.label}</span>
            <span className="dash-barlist-value">
              {numberFormat.format(item.count)}
              <small>{share(item.count, total)}</small>
            </span>
            <span className="dash-barlist-track" aria-hidden="true">
              <span className="dash-barlist-fill" style={{ width: `${(item.count / max) * 100}%` }} />
            </span>
          </li>
        ))}
    </ul>
  )
}

export function StatusBreakdown({ data, canOrders }: { data: Dashboard; canOrders: boolean }) {
  const total = data.byStatus.reduce((sum, item) => sum + item.count, 0)
  const items = data.byStatus.map((item) => ({
    key: item.status,
    count: item.count,
    label: canOrders ? (
      <Link to={`/sales/orders?status=${item.status}`} aria-label={`${orderStatusLabel[item.status]}: відкрити замовлення`}>
        <OrderStatusChip status={item.status} />
      </Link>
    ) : (
      <OrderStatusChip status={item.status} />
    ),
  }))
  return (
    <DashboardCard title="Статуси" aside={<span className="dash-muted">{numberFormat.format(total)} замовл.</span>}>
      {items.length === 0 ? <p className="dash-muted">Замовлень за період немає.</p> : <BarList items={items} />}
    </DashboardCard>
  )
}

export function DeliveryBreakdown({ data }: { data: Dashboard }) {
  const items = data.byDelivery.map((item) => ({ key: item.method, count: item.count, label: deliveryMethodLabel[item.method] ?? item.method }))
  return (
    <DashboardCard title="Отримання">
      {items.length === 0 ? <p className="dash-muted">Замовлень за період немає.</p> : <BarList items={items} />}
    </DashboardCard>
  )
}
