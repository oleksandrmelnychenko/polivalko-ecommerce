import { IconSparkles } from '@tabler/icons-react'
import { formatMoney, plural } from '@polivalko/shared/lib/format'
import type { Dashboard } from '../api/dashboardApi'
import { bestDay, numberFormat } from '../lib/insights'

export function PeriodSummary({ data }: { data: Dashboard }) {
  const { current, previous } = data
  const strongest = bestDay(data)
  // "orders" leaves cancelled ones out, as revenue does; what came in is both together.
  const received = current.orders + current.cancelled
  const orders = plural(received, 'замовлення', 'замовлення', 'замовлень')

  return (
    <section className="dash-feature-card dash-period">
      <h2><IconSparkles aria-hidden="true" />Підсумок періоду</h2>
      <p className="dash-period-copy">
        {received > 0 ? (
          <>За період надійшло <strong>{numberFormat.format(received)} {orders}</strong>.</>
        ) : (
          <>За цей період <strong>замовлень немає</strong>.</>
        )}
        {' '}Виручка — <strong>{formatMoney(current.revenue)}</strong>.
        {strongest && <> Найбільше за день — <strong>{formatMoney(strongest.revenue)}</strong> ({strongest.date}).</>}
        {(current.cancelled > 0 || previous.cancelled > 0) && <> З них скасовано <strong>{numberFormat.format(current.cancelled)}</strong>, раніше — {numberFormat.format(previous.cancelled)}.</>}
      </p>
      <footer><span />Останні {data.days} днів</footer>
      <div className="dash-period-matrix" aria-hidden="true" />
    </section>
  )
}
