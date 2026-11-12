import { Button, Skeleton } from '@mantine/core'
import { IconArrowRight, IconReceiptRefund } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { OrderStatus } from '@polivalko/shared/api/types'
import { formatDateTime, formatMoney, formatPrice } from '@polivalko/shared/lib/format'
import { deliveryMethodLabel, refundStatusLabel } from '@polivalko/shared/lib/labels'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { moment } from '@/shared/lib/when'
import { findOrders, findRefunds, orderHref } from '@/shared/sales/salesLookups'
import { RefundsList, refundTone } from '@/shared/sales/SalesLists'
import { Money } from '@/shared/ui/Money'
import { OrderStatusChip, PaymentStatusChip } from '@/shared/ui/StatusChip'
import { TableChip } from '@/shared/ui/TableChip'
import type { RefundRow } from '../api/returnsApi'
import { receiptLabel, receiptTone } from '../lib/returnsLabels'

export function ReturnDetailPane({ refund }: { refund: RefundRow | null }) {
  const number = refund?.orderNumber ?? ''
  const orders = useApiQuery(`return-order:${number}`, () => findOrders(number, 5), { enabled: Boolean(refund) })
  const siblings = useApiQuery(`return-siblings:${number}`, () => findRefunds(number, 50), { enabled: Boolean(refund) })

  if (!refund) return <section className="app-split-detail app-split-detail-empty">Оберіть повернення зліва.</section>

  const order = orders.isFetching ? null : orders.data?.items.find((item) => item.number === refund.orderNumber) ?? null
  const related = (siblings.isFetching ? [] : (siblings.data?.items ?? [])).filter((item) => item.orderNumber === refund.orderNumber)
  const returned = related.filter((item) => item.status === 'succeeded').reduce((sum, item) => sum + Number(item.amount.value), 0)
  const created = moment(refund.createdAt)
  const tone = refundTone(refund.status)

  return (
    <section key={refund.id} className="app-split-detail" aria-labelledby="return-detail-title">
      <header className="app-split-hero">
        <div className="app-split-hero-top">
          <div className="app-split-head">
            <span className={`app-split-icon is-${tone}`} aria-hidden="true">
              <IconReceiptRefund size={28} stroke={1.5} />
            </span>
            <div className="app-split-hero-main">
              <p className="app-split-hero-kicker">
                Повернення за замовленням <span className="app-split-mono">{refund.orderNumber}</span>
              </p>
              <h2 id="return-detail-title">
                <span className="app-split-mono">{formatMoney(refund.amount)}</span>
                <TableChip dot tone={tone} value={refundStatusLabel[refund.status] ?? refund.status} />
              </h2>
              <p className="app-split-hero-aliases">Оформив {refund.createdBy || 'не вказано'}</p>
            </div>
          </div>
          <div className="app-split-actions">
            <Button component={Link} to={orderHref(refund.orderNumber)} variant="default" rightSection={<IconArrowRight size={16} stroke={1.7} />}>
              Відкрити замовлення
            </Button>
          </div>
        </div>

        <dl className="app-split-stats is-text">
          <div>
            <dt>Оформлено</dt>
            <dd>
              {created.day}
              <small>о {created.time}</small>
            </dd>
          </div>
          <div>
            <dt>Спосіб</dt>
            <dd>{refund.method === 'card' ? 'На картку' : 'Поза сайтом'}</dd>
          </div>
          <div>
            <dt>Чек повернення</dt>
            <dd>{refund.receiptStatus ? <TableChip tone={receiptTone(refund.receiptStatus)} value={receiptLabel(refund.receiptStatus)} /> : <span className="app-split-value-empty">немає</span>}</dd>
          </div>
        </dl>
      </header>

      <section className="app-split-card" aria-labelledby="return-reason-title">
        <header className="app-split-card-head">
          <h3 id="return-reason-title">Причина</h3>
        </header>
        {refund.reason ? <p className="app-split-text">{refund.reason}</p> : <p className="app-split-blank">Причину не вказали.</p>}
      </section>

      <section className="app-split-card" aria-labelledby="return-order-title">
        <header className="app-split-card-head">
          <h3 id="return-order-title">Замовлення</h3>
          <Link to={orderHref(refund.orderNumber)}>
            {refund.orderNumber}
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </Link>
        </header>
        {orders.isFetching ? (
          <Skeleton height={120} radius={8} />
        ) : order ? (
          <dl className="app-split-fields">
            <div>
              <dt>Покупець</dt>
              <dd>
                {order.customerName}
                <span className="app-split-dot">
                  <a className="app-split-link" href={`tel:${order.phone}`}>
                    {order.phone}
                  </a>
                </span>
              </dd>
            </div>
            <div>
              <dt>Оформлено</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div>
              <dt>Стан</dt>
              <dd className="returns-chips">
                <OrderStatusChip status={order.status as OrderStatus} />
                <PaymentStatusChip status={order.paymentStatus} />
              </dd>
            </div>
            <div>
              <dt>Отримання</dt>
              <dd>{deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod}</dd>
            </div>
            <div>
              <dt>Сума замовлення</dt>
              <dd>
                <Money value={order.total} />
              </dd>
            </div>
          </dl>
        ) : (
          <p className="app-split-blank">Не вдалося знайти замовлення {refund.orderNumber}.</p>
        )}
      </section>

      <section className="app-split-card" aria-labelledby="return-siblings-title">
        <header className="app-split-card-head">
          <h3 id="return-siblings-title">Повернення за цим замовленням</h3>
          {related.length ? <span>повернуто {formatPrice(returned)}{order ? ` з ${formatMoney(order.total)}` : ''}</span> : null}
        </header>
        {siblings.isFetching ? <Skeleton height={60} radius={8} /> : <RefundsList refunds={related.length ? related : [refund]} canOpen activeId={related.length > 1 ? refund.id : undefined} label="Повернення за цим замовленням" />}
      </section>
    </section>
  )
}
