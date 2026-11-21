import { SegmentedControl } from '@mantine/core'
import { IconCash, IconReceipt, IconReceiptRefund, IconShoppingBag, IconSparkles, IconWallet } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { dateLabel, dateRange, formatAmount, formatPrice } from '@/shared/lib/salesFormat'
import type { DocumentSales } from '../api/dashboardApi'
import type { Metric } from '../lib/insights'
import { ShareCard } from './CompletionCard'
import { DashboardCard } from './DashboardCard'
import { DeltaChip } from './DeltaChip'
import { KpiTiles } from './KpiList'
import { RevenueChart } from './RevenueChart'

const metrics = [
  { field: 'net', title: 'Чистий оборот', icon: IconWallet, format: formatPrice },
  { field: 'purchases', title: 'Покупки', icon: IconShoppingBag, format: formatAmount },
  { field: 'gross', title: 'Продажі до повернень', icon: IconCash, format: formatPrice },
  { field: 'returned', title: 'Сума повернень', icon: IconReceiptRefund, format: formatPrice },
] as const

export function DocumentSalesFeatures({ data, metric, onMetric }: { data: DocumentSales; metric: Metric; onMetric: (value: Metric) => void }) {
  const turnover = metric === 'revenue'
  const field = turnover ? 'net' : 'purchases'
  return (
    <div className="dash-feature-row">
      <ShareCard heading={<><IconReceipt aria-hidden="true" />Частка покупок за окремими чеками</>}
        totalLabel="Усього покупок" total={data.current.purchases} partLabel="Окремих чеків"
        part={data.current.receipts} empty="За цей період покупок немає." />
      <DashboardCard className="dash-chart-card" title={turnover ? 'Чистий оборот по днях' : 'Покупки по днях'}
        aside={<SegmentedControl size="xs" aria-label="Показник графіка" value={metric}
          data={[{ value: 'revenue', label: 'Оборот' }, { value: 'orders', label: 'Покупки' }]}
          onChange={value => onMetric(value === 'orders' ? 'orders' : 'revenue')} />}>
        <div className="dash-chart-total">
          <strong>{turnover ? formatPrice(data.current.net) : formatAmount(data.current.purchases)}</strong>
          <DeltaChip current={data.current[field]} previous={data.previous[field]} />
        </div>
        <RevenueChart documents metric={metric} days={data.byDay.map(d => ({ date: d.day, count: d.purchases, amount: d.net }))} />
      </DashboardCard>
    </div>
  )
}

export function DocumentPeriodSummary({ data }: { data: DocumentSales }) {
  return (
    <section className="dash-feature-card dash-period">
      <h2><IconSparkles aria-hidden="true" />Підсумок періоду</h2>
      <p className="dash-period-copy">Чистий оборот — <strong>{formatPrice(data.current.net)}</strong>.
        {' '}Видаткових накладних — <strong>{formatAmount(data.current.invoices)}</strong>,
        повернень — <strong>{formatAmount(data.current.refunds)}</strong>.</p>
      {data.latest && <p className="dash-muted">Останній документ · {dateLabel(data.latest)}</p>}
      <Link className="dash-link" to={'/sales/business-analytics?tab=invoices&year=' + data.through.slice(0, 4)}>Звірка документів за рік</Link>
      <footer><span />{dateRange(data.start, data.through)}</footer>
      <div className="dash-period-matrix" aria-hidden="true" />
    </section>
  )
}

export function DocumentKpis({ data }: { data: DocumentSales }) {
  return <KpiTiles items={metrics.map(({ field, title, icon, format }) => ({
    label: title, icon, now: data.current[field], before: data.previous[field],
    value: format(data.current[field]), prior: format(data.previous[field]), inverse: field === 'returned',
  }))} />
}
