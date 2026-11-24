import { SegmentedControl } from '@mantine/core'
import { IconCash, IconReceipt, IconReceiptRefund, IconShoppingBag, IconSparkles, IconWallet } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { dateLabel, dateRange, formatAmount, formatPrice } from '@/shared/lib/salesFormat'
import type { DocumentSales } from '../api/dashboardApi'
import type { Metric } from '../lib/insights'
import { DashboardCard } from './DashboardCard'
import { KpiTiles } from './KpiList'
import { RevenueChart } from './RevenueChart'

const receiptShare = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 1 })

const metrics = [
  { field: 'net', title: 'Чистий оборот', icon: IconWallet, format: formatPrice },
  { field: 'purchases', title: 'Покупки', icon: IconShoppingBag, format: formatAmount },
  { field: 'gross', title: 'Продажі до повернень', icon: IconCash, format: formatPrice },
  { field: 'returned', title: 'Сума повернень', icon: IconReceiptRefund, format: formatPrice },
] as const

export function DocumentSalesFeatures({ data, metric, onMetric }: { data: DocumentSales; metric: Metric; onMetric: (value: Metric) => void }) {
  const turnover = metric === 'revenue'
  return (
    <DashboardCard className="dash-chart-card" title={turnover ? 'Чистий оборот по днях' : 'Покупки по днях'}
      aside={<SegmentedControl size="xs" aria-label="Показник графіка" value={metric}
        data={[{ value: 'revenue', label: 'Оборот' }, { value: 'orders', label: 'Покупки' }]}
        onChange={value => onMetric(value === 'orders' ? 'orders' : 'revenue')} />}>
      <RevenueChart documents metric={metric} days={data.byDay.map(d => ({ date: d.day, count: d.purchases, amount: d.net }))} />
    </DashboardCard>
  )
}

export function DocumentPeriodSummary({ data }: { data: DocumentSales }) {
  return (
    <section className="dash-feature-card dash-period">
      <h2><IconSparkles aria-hidden="true" />Підсумок періоду</h2>
      <div className="dash-receipt-share">
        <span><IconReceipt size={16} aria-hidden="true" />Покупки за окремими чеками</span>
        {data.current.purchases > 0 ? <strong>{formatAmount(data.current.receipts)} із {formatAmount(data.current.purchases)} · {receiptShare.format(data.current.receipts / data.current.purchases)}</strong> : <strong>Покупок немає</strong>}
      </div>
      <p className="dash-document-counts">Видаткових накладних — <strong>{formatAmount(data.current.invoices)}</strong>,
        повернень — <strong>{formatAmount(data.current.refunds)}</strong>.</p>
      {data.latest && <p className="dash-muted">Останній документ · {dateLabel(data.latest)}</p>}
      <Link className="dash-link" to={'/analytics/business?tab=invoices&year=' + data.through.slice(0, 4)}>Звірка документів за рік</Link>
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
