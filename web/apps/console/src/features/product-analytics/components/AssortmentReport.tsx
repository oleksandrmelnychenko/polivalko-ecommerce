import { SegmentedControl } from '@mantine/core'
import { IconBox, IconCalendarStats, IconCoins, IconFileInvoice, IconReceiptRefund } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { cleanProductName } from '@/shared/lib/cleanProductName'
import { MetricLabel } from '@/shared/ui/MetricCard'
import type { BusinessReport } from '../api/businessAnalytics'
import { formatValue as fmt } from './BusinessForecast'
import './assortment-report.css'

const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']
const columns = ['Товар', 'Артикул', 'Одиниця', 'Продано', 'Повернено', 'Середня ціна, грн', 'Оборот, грн', 'Прибуток, грн']
const metrics = [
  { field: 'net', label: 'Чистий оборот', icon: IconCoins },
  { field: 'returns', label: 'Сума повернень', icon: IconReceiptRefund },
  { field: 'documents', label: 'Документів', icon: IconFileInvoice },
] as const

type Props = {
  report: BusinessReport
  loading: boolean
  selectedProduct: string | null
  selectProduct: (id: string) => void
  search: ReactNode
  pager: ReactNode
}

export function AssortmentReport({ report, loading, selectedProduct, selectProduct, search, pager }: Props) {
  const [mode, setMode] = useState<'months' | 'indices'>('months')
  const categoryNames = new Map(report.options.category.map(c => [c.value, c.label]))
  const rows = report.heatmap
  const hasValues = rows.some(row => row[mode].some(value => value != null))

  return <div className="assortment-report" aria-busy={loading}>
    {loading && <p className="assortment-updating" role="status">Оновлюємо звіт…</p>}
    <div className="ba-kpis ba-overview-metrics">
      {metrics.map(({ field, label, icon }) => <div key={field} className="pa-card">
        <MetricLabel icon={icon}>{label}</MetricLabel>
        <strong>{fmt(report.summary[field])}{field !== 'documents' && report.summary[field] != null && <small>₴</small>}</strong>
      </div>)}
    </div>

    <section className="pa-card" aria-labelledby="seasonality-title">
      <header className="assortment-header">
        <h2 id="seasonality-title"><MetricLabel icon={IconCalendarStats}>Сезонність за категоріями</MetricLabel></h2>
        <SegmentedControl aria-label="Показник сезонності" value={mode}
          onChange={value => setMode(value === 'indices' ? 'indices' : 'months')}
          data={[{ value: 'months', label: 'Оборот, грн' }, { value: 'indices', label: 'Сезонний індекс' }]} />
      </header>
      {mode === 'months' ? <div className="assortment-legend">
        <span>Оборот у межах категорії; якщо період довший за рік — у середньому за рік</span>
        <span><i className="assortment-scale" aria-hidden="true"><i /><i /><i /></i>Від меншого до більшого</span>
        <span><i className="assortment-negative" aria-hidden="true" />Від’ємний</span>
        <span>— Немає даних</span>
      </div> : <p className="assortment-caption">Індекс 100 відповідає середньому місяцю. Для розрахунку потрібно щонайменше два завершені роки з даними за всі 12 місяців.</p>}
      {hasValues ? <div className="assortment-scroll assortment-heat" role="region" tabIndex={0} aria-labelledby="seasonality-title">
        <table><thead><tr><th scope="col">Категорія</th>{months.map(month => <th key={month} scope="col">{month}</th>)}</tr></thead>
          <tbody>{rows.map(row => {
            const peak = Math.max(1, ...row[mode].map(value => Math.abs(value ?? 0)))
            return <tr key={row.category}>
              <th scope="row">{categoryNames.get(row.category) ?? row.category}
                {mode === 'indices' && <small>Повних років · {row.years}</small>}</th>
              {row[mode].map((value, i) => {
                const intensity = mode === 'months' ? Math.abs(value ?? 0) / peak : Math.min(1, Math.abs(value ?? 0) / 200)
                const tone = value == null || value === 0 ? undefined : (value < 0 ? '166 61 73' : '17 144 98')
                return <td key={months[i]}><span data-missing={value == null || undefined}
                  style={tone ? { backgroundColor: 'rgb(' + tone + ' / ' + (0.05 + intensity * 0.32) + ')' } : undefined}>
                  {fmt(value)}</span></td>
              })}
            </tr>
          })}</tbody>
        </table>
      </div> : <p className="assortment-empty">{mode === 'indices' ? 'Недостатньо повних років для сезонного індексу.' : 'За вибраний період немає даних про оборот категорій.'}</p>}
    </section>

    <section className="pa-card" aria-labelledby="assortment-products-title">
      <header className="assortment-header">
        <h2 id="assortment-products-title"><MetricLabel icon={IconBox}>Товари за чистим оборотом</MetricLabel></h2>
        <div className="assortment-search">{search}</div>
      </header>
      {report.products.rows.length ? <div className="assortment-scroll assortment-products" tabIndex={0} role="region" aria-labelledby="assortment-products-title">
        <table><thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{report.products.rows.map(p => <tr key={JSON.stringify([p.id, p.unit])} data-selected={p.id === selectedProduct || undefined}>
            <th scope="row"><button type="button" onClick={() => selectProduct(p.id)}>{cleanProductName(p.name)}</button></th>
            <td>{p.sku || '—'}</td><td>{p.unit || '—'}</td><td>{fmt(p.sold)}</td><td>{fmt(p.returned)}</td>
            <td>{fmt(p.price)}</td><td className="assortment-net">{fmt(p.net)}</td><td>{fmt(p.profit)}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="assortment-empty">За цими фільтрами товарів немає.</p>}
      <footer className="assortment-footer"><span>Позицій у списку · <b>{fmt(report.products.total)}</b></span>{pager}</footer>
    </section>
  </div>
}
