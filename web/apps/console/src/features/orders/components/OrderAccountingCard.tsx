import { formatDateTime } from '@polivalko/shared/lib/format'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { OrderCard, OrderCardBody } from './OrderCard'

export function OrderAccountingCard({ order }: { order: ConsoleOrder }) {
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
              {order.navkoloOrderRef ? (
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
      </OrderCardBody>
    </OrderCard>
  )
}
