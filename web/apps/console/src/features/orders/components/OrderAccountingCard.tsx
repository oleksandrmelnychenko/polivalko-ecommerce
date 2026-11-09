import { formatDateTime } from '@polivalko/shared/lib/format'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { OrderCard, OrderCardBody } from './OrderCard'

export function OrderAccountingCard({ order }: { order: ConsoleOrder }) {
  const shipmentConflict = (order.navkoloShippedAt && order.status === 'cancelled')
    || (order.navkoloCancelledAt && (order.navkoloShippedAt || order.status === 'shipped' || order.status === 'completed'))
  const refundRequired = order.navkoloCancelledAt && order.status === 'cancelled'
    && (order.paymentStatus === 'succeeded' || order.paymentStatus === 'partiallyRefunded')
  return (
    <OrderCard className="order-area-accounting" title="Облік">
      <OrderCardBody>
        <dl className="order-facts">
          <div>
            <dt>Продавець</dt>
            <dd>
              {order.sellerName}
              {order.sellerTaxId ? <span className="order-muted"> ({order.sellerTaxId})</span> : null}
            </dd>
          </div>
          <div>
            <dt>Navkolo</dt>
            <dd>
              {order.status === 'cancelled' ? (
                <span>{order.navkoloCancellationSynchronizedAt
                  ? `Скасування оброблено ${formatDateTime(order.navkoloCancellationSynchronizedAt)}`
                  : order.navkoloCancellationRequestedAt
                    ? 'Скасування в черзі. Для переданого замовлення резерв зберігається до підтвердження Навколо. Помилки та повтори — у «Система → Інтеграції».'
                    : 'Скасовано до ввімкнення автоматичної передачі скасувань.'}</span>
              ) : order.navkoloOrderRef ? (
                <>
                  <span className="order-code">{order.navkoloOrderRef}</span>
                  {order.navkoloExportedAt ? <span className="order-muted">, {formatDateTime(order.navkoloExportedAt)}</span> : null}
                </>
              ) : (
                <span className="order-muted">ще не передано (черга повторить спробу)</span>
              )}
            </dd>
          </div>
        </dl>
        {order.navkoloShippedAt ? <p>Навколо підтвердило відвантаження {formatDateTime(order.navkoloShippedAt)}. Залишки та резерв звірено.</p> : null}
        {order.navkoloCancelledAt ? <p>Скасування отримано з Навколо {formatDateTime(order.navkoloCancelledAt)}.</p> : null}
        {shipmentConflict ? <p role="alert">Конфлікт скасування та відвантаження. Перевірте облік і повернення товару в Навколо. Статус сам по собі не повертає товар на склад.</p> : null}
        {refundRequired ? <p role="alert">Замовлення оплачене. Перевірте й оформіть повернення коштів — скасування в Навколо не повертає оплату автоматично.</p> : null}
      </OrderCardBody>
    </OrderCard>
  )
}
