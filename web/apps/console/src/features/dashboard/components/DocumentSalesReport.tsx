import { SegmentedControl } from '@mantine/core'
import { IconCash, IconReceiptRefund, IconShoppingBag, IconWallet } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnalyticsChart } from '@/shared/ui/AnalyticsChart'
import { axisDate, dateLabel, dateRange, formatAmount, formatPrice } from '@/shared/lib/salesFormat'
import { MetricTile } from '@/shared/ui/MetricCard'
import type { DocumentSales } from '../api/dashboardApi'
import { DashboardCard } from './DashboardCard'
import { DeltaChip } from './DeltaChip'

const metrics = [
  { field: 'net', title: 'Чистий оборот', icon: IconWallet, format: formatPrice },
  { field: 'purchases', title: 'Покупки', icon: IconShoppingBag, format: formatAmount },
  { field: 'gross', title: 'Продажі до повернень', icon: IconCash, format: formatPrice },
  { field: 'returned', title: 'Сума повернень', icon: IconReceiptRefund, format: formatPrice },
] as const

export function DocumentSalesReport({ data }: { data: DocumentSales }) {
  const [measure, setMeasure] = useState('net')
  const turnover = measure === 'net'
  return <>
    <ul className="dash-kpis" aria-label="Продажі за документами обліку">
      {metrics.map(({ field, title, icon, format }) => (
        <MetricTile key={field} label={title} icon={icon}>
          <div className="dash-kpi-amount"><strong className="dash-kpi-value">{format(data.current[field])}</strong>
            <DeltaChip current={data.current[field]} previous={data.previous[field]} inverse={field === 'returned'} /></div>
          <span className="dash-kpi-prior">Попередні {data.days} днів · {format(data.previous[field])}</span>
        </MetricTile>
      ))}
    </ul>
    <div className="dash-grid is-even">
      <DashboardCard title="Продажі за документами" aside={<SegmentedControl size="xs" aria-label="Показник за днями"
        value={measure} data={[{ value: 'net', label: 'Оборот' }, { value: 'purchases', label: 'Покупки' }]} onChange={setMeasure} />}>
        <p className="dash-muted">{dateRange(data.start, data.through)}{data.latest && ' · останній документ ' + dateLabel(data.latest)}</p>
        <AnalyticsChart variant="bars" label={turnover ? 'Чистий оборот за день' : 'Покупки за день'}
          points={data.byDay.map(d => ({ label: dateLabel(d.day), axisLabel: axisDate(d.day), value: turnover ? d.net : d.purchases }))}
          format={turnover ? formatPrice : formatAmount} />
        <p className="dash-muted">Окремих чеків · {formatAmount(data.current.receipts)}. Видаткових накладних · {formatAmount(data.current.invoices)}.
          {' '}Повернень · {formatAmount(data.current.refunds)}.</p>
        <Link className="dash-link" to={'/sales/business-analytics?tab=invoices&year=' + data.through.slice(0, 4)}>Звірка документів за рік</Link>
      </DashboardCard>
      <DashboardCard title="Товари за чистою виручкою" aside={<span className="dash-muted">за цей період</span>}>
        {data.products.length ? <ol className="dash-rank">{data.products.map((p, i) => <li key={i}>
          <span className="dash-rank-n">{i + 1}</span><span className="dash-rank-main"><strong>{p.name}</strong>
            <span className="app-cell-sub">{p.sku}</span></span><span className="app-money">{formatPrice(p.net)}</span>
        </li>)}</ol> : <p className="dash-muted">За ці дати немає товарів із додатною чистою виручкою.</p>}
        {data.incompleteProducts > 0 && <p role="status">До товарного рейтингу ввійшли документи зі звіреними рядками.
          {' '}Потребують перевірки · {formatAmount(data.incompleteProducts)}.</p>}
      </DashboardCard>
    </div>
    {data.excluded > 0 && <p role="status">Документів із непідтвердженою сумою або статусом · {formatAmount(data.excluded)}.</p>}
  </>
}
