import { IconReceipt2, IconShoppingBag, IconUsers, IconWallet } from '@tabler/icons-react'
import { formatMoney } from '@polivalko/shared/lib/format'
import { MetricTile, MetricTrack } from '@/shared/ui/MetricCard'
import type { Dashboard } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { DeltaChip } from './DeltaChip'

export function KpiList({ data }: { data: Dashboard }) {
  const { current, previous } = data
  const kpis = [
    { label: 'Виручка', icon: IconWallet, now: Number(current.revenue.value), before: Number(previous.revenue.value), value: formatMoney(current.revenue), prior: formatMoney(previous.revenue) },
    { label: 'Замовлення', icon: IconShoppingBag, now: current.orders, before: previous.orders, value: numberFormat.format(current.orders), prior: numberFormat.format(previous.orders) },
    { label: 'Середній чек', icon: IconReceipt2, now: Number(current.averageOrder.value), before: Number(previous.averageOrder.value), value: formatMoney(current.averageOrder), prior: formatMoney(previous.averageOrder) },
    { label: 'Покупці', icon: IconUsers, now: current.customers, before: previous.customers, value: numberFormat.format(current.customers), prior: numberFormat.format(previous.customers) },
  ]

  return (
    <ul className="dash-kpis" aria-label="Показники за період">
      {kpis.map(({ label, icon: Icon, now, before, value, prior }) => {
        const scale = Math.max(now, before, 1)
        return (
          <MetricTile key={label} icon={Icon} label={label}>
            <div className="dash-kpi-amount">
              <strong className="dash-kpi-value">{value}</strong>
              <DeltaChip current={now} previous={before} />
            </div>
            <span className="dash-kpi-prior">Попередній період · {prior}</span>
            <div className="dash-kpi-lines" aria-hidden="true">
              {[now, before].map((amount, index) => (
                <MetricTrack key={index} value={amount} max={scale} muted={index === 1} />
              ))}
            </div>
          </MetricTile>
        )
      })}
    </ul>
  )
}
