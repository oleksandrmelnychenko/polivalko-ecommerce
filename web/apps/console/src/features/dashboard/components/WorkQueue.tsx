import type { DashboardSummary } from '../api/dashboardApi'
import { QueueTile } from './QueueTile'

export function WorkQueue({ summary, canOrders, canRequests }: { summary: DashboardSummary; canOrders: boolean; canRequests: boolean }) {
  const items = [
    { n: summary.newOrders, label: 'Нові замовлення', href: '/sales/orders?status=new', allowed: canOrders, hot: true },
    { n: summary.awaitingConfirmation, label: 'Очікують підтвердження', href: '/sales/orders?status=awaitingConfirmation', allowed: canOrders, hot: true },
    { n: summary.awaitingPayment, label: 'Очікують оплати', href: '/sales/orders?status=awaitingPayment', allowed: canOrders, hot: false },
    { n: summary.newServiceRequests, label: 'Нові заявки на послуги', href: '/sales/requests?status=new', allowed: canRequests, hot: true },
  ]

  return (
    <section className="dash-card dash-work">
      <header className="dash-card-head"><h2 className="dash-card-title">Черга на обробку</h2></header>
      <ul className="dash-queue" aria-label="Черга на обробку">
      {items.map((item) => (
        <QueueTile key={item.href} count={item.n} label={item.label} hot={item.hot} href={item.allowed ? item.href : undefined} />
      ))}
      </ul>
    </section>
  )
}
