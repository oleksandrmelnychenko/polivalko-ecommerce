import { IconChevronRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { DashboardSummary } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'

export function WorkQueue({ summary, canOrders, canRequests }: { summary: DashboardSummary; canOrders: boolean; canRequests: boolean }) {
  const items = [
    { n: summary.newOrders, label: 'нових замовлень', href: '/sales/orders?status=new', allowed: canOrders, hot: true },
    { n: summary.awaitingConfirmation, label: 'чекають підтвердження', href: '/sales/orders?status=awaitingConfirmation', allowed: canOrders, hot: true },
    { n: summary.awaitingPayment, label: 'чекають оплати', href: '/sales/orders?status=awaitingPayment', allowed: canOrders, hot: false },
    { n: summary.newServiceRequests, label: 'нових заявок на послуги', href: '/sales/requests?status=new', allowed: canRequests, hot: true },
  ]

  return (
    <ul className="dash-queue" aria-label="Черга на обробку">
      {items.map((item) => {
        const className = `dash-queue-item${item.hot && item.n > 0 ? ' is-hot' : ''}`
        const content = (
          <>
            <b>{numberFormat.format(item.n)}</b>
            <span>{item.label}</span>
            {item.allowed ? <IconChevronRight size={16} stroke={1.8} aria-hidden="true" /> : null}
          </>
        )
        return (
          <li key={item.label}>
            {item.allowed ? (
              <Link to={item.href} className={className}>
                {content}
              </Link>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
