import { formatDateTime } from '@polivalko/shared/lib/format'
import { orderStatusLabel } from '@polivalko/shared/lib/labels'
import type { ConsoleOrder } from '../api/orderDetailApi'
import { OrderCard, OrderCardBody } from './OrderCard'

export function OrderHistoryCard({ order }: { order: ConsoleOrder }) {
  const entries = [...order.history].reverse()
  return (
    <OrderCard className="order-area-history" title="Історія">
      <OrderCardBody>
        <ol className="order-timeline">
          {entries.map((entry, index) => {
            const statusKept = entry.from === entry.to && Boolean(entry.reason)
            return (
              <li key={`${entry.at}-${index}`}>
                <strong>{statusKept ? entry.reason : (orderStatusLabel[entry.to] ?? entry.to)}</strong>
                <span>
                  {formatDateTime(entry.at)} · {entry.by}
                  {statusKept ? ` · статус «${orderStatusLabel[entry.to] ?? entry.to}»` : entry.from ? ` · було «${orderStatusLabel[entry.from] ?? entry.from}»` : ''}
                </span>
                {entry.reason && !statusKept ? <q>{entry.reason}</q> : null}
              </li>
            )
          })}
        </ol>
      </OrderCardBody>
    </OrderCard>
  )
}
