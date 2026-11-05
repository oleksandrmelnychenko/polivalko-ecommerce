import { formatMoney } from '@polivalko/shared/lib/format'
import type { Dashboard } from '../api/dashboardApi'
import { bestDay, numberFormat } from '../lib/insights'
import { DashboardCard } from './DashboardCard'
import { DeltaChip } from './DeltaChip'

export function PeriodSummary({ data }: { data: Dashboard }) {
  const { current: c, previous: p } = data
  return (
    <DashboardCard title="Підсумок періоду">
      <dl className="dash-summary">
        <dt>Виручка</dt>
        <dd>
          <strong className="app-money">{formatMoney(c.revenue)}</strong>
        </dd>
        <dt>Замовлень</dt>
        <dd>{numberFormat.format(c.orders)}</dd>
        <dt>Скасовано</dt>
        <dd>
          {numberFormat.format(c.cancelled)} <DeltaChip current={c.cancelled} previous={p.cancelled} inverse />
        </dd>
        <dt>Середній чек</dt>
        <dd>{formatMoney(c.averageOrder)}</dd>
        <dt>Покупців</dt>
        <dd>{numberFormat.format(c.customers)}</dd>
        <dt>Найкращий день</dt>
        <dd>{bestDay(data)}</dd>
      </dl>
    </DashboardCard>
  )
}
