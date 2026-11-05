import { formatDateTime, formatMoney } from '@polivalko/shared/lib/format'
import { OrderStatusChip, PaymentStatusChip } from '@/shared/ui/StatusChip'
import type { ConsoleOrder } from '../api/orderDetailApi'

export function OrderHero({ order, printedAt }: { order: ConsoleOrder; printedAt: string }) {
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const refunded = Number(order.refundedAmount.value) > 0

  return (
    <>
      <p className="order-print-only order-print-stamp">
        <strong>PoliValko</strong> · накладна для комплектування · надруковано {formatDateTime(printedAt)}
      </p>
      <section className="order-hero" aria-label={`Замовлення ${order.number}`}>
        <div className="order-hero-main">
          <span className="order-eyebrow">Замовлення</span>
          <h1 className="order-number">{order.number}</h1>
          <div className="order-hero-chips">
            <OrderStatusChip size="lg" status={order.status} />
            <PaymentStatusChip size="lg" status={order.paymentStatus} />
          </div>
          <span className="order-hero-created">створено {formatDateTime(order.createdAt)}</span>
        </div>
        <dl className="order-metrics">
          <div className="order-metric">
            <dt>Разом до сплати</dt>
            <dd className="app-money">{formatMoney(order.total)}</dd>
          </div>
          <div className="order-metric">
            <dt>Склад</dt>
            <dd>
              {pieces} шт. · {order.items.length} поз.
            </dd>
          </div>
          {refunded ? (
            <div className="order-metric is-refund">
              <dt>Повернено</dt>
              <dd className="app-money">−{formatMoney(order.refundedAmount)}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </>
  )
}
