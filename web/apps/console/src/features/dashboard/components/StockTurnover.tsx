import { Select, TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { problemMessage } from '@/shared/api/problem'
import { onConsoleEvent } from '@/shared/lib/events'
import { dateRange, formatPrice } from '@/shared/lib/salesFormat'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getStockTurnover } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { DashboardCard } from './DashboardCard'

const percent = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 2 })

function formatShare(value: number) {
  if (value > 0 && value < 0.0001) return '< 0,01 %'
  if (value < 0 && value > -0.0001) return 'між −0,01 % і 0 %'
  return percent.format(value)
}

export function StockTurnover({ days }: { days: number }) {
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState({ page: 1, stock: 'all', search: '' })
  const search = useDebouncedCallback((value: string) => {
    setFilters(current => ({ ...current, search: value.trim(), page: 1 }))
  }, 300)
  const params = new URLSearchParams({
    days: String(days), page: String(filters.page), stock: filters.stock, search: filters.search,
  })
  const query = useApiQuery('stock-turnover?' + params, () => getStockTurnover(params))
  const { reload } = query
  useEffect(() => onConsoleEvent('summary-stale', reload), [reload])
  const report = query.status === 'ready' ? query.data : undefined
  return (
    <DashboardCard title="Закінчуються" className="dash-stock-impact" flush>
      {report && <div className="dash-stock-summary">
        <span>Чистий оборот товарів із малим залишком · {dateRange(report.start, report.through)}</span>
        {report.net != null
          ? <div><strong>{formatPrice(report.net)}</strong>
            {report.share != null && <span>{formatShare(report.share)} від обороту за період</span>}</div>
          : <div><strong>Оборот невідомий</strong></div>}
        <span>Загальний чистий оборот · {formatPrice(report.periodNet)}</span>
        {report.periodNet <= 0 && <span>Частка доступна за додатного загального обороту.</span>}
        {report.unknownCount > 0 && <span>Товарів без підтвердженого обороту · {numberFormat.format(report.unknownCount)}. Для них бракує повних рядків продажу або однозначного зв’язку з каталогом. У підсумку враховано лише підтверджені суми.</span>}
      </div>}
      <div className="dash-product-tools">
        <TextInput size="xs" aria-label="Пошук товарів із малим залишком" placeholder="Назва або артикул" maxLength={120} value={draft}
          onChange={event => { const value = event.currentTarget.value; setDraft(value); search(value) }} />
        <Select size="xs" aria-label="Доступність товарів" allowDeselect={false} value={filters.stock}
          data={[
            { value: 'all', label: report ? `Усі · ${numberFormat.format(report.total)}` : 'Усі' },
            { value: 'out', label: report ? `Немає · ${numberFormat.format(report.outCount)}` : 'Немає' },
            { value: 'low', label: report ? `Мало · ${numberFormat.format(report.lowCount)}` : 'Мало' },
          ]}
          onChange={value => setFilters(current => ({ ...current, stock: value ?? 'all', page: 1 }))} />
      </div>
      {report ? <>
        <p className="dash-report-note">До списку входять товари каталогу, для яких зараз доступно до {numberFormat.format(report.threshold)} од. після резервів. Першими йдуть товари з найбільшим чистим оборотом за вибраний період.</p>
        {report.rows.length > 0 ? <>
          <p className="dash-report-note" aria-live="polite">
            Показано {numberFormat.format((report.page - 1) * report.pageSize + 1)}–{numberFormat.format((report.page - 1) * report.pageSize + report.rows.length)} із {numberFormat.format(report.matches)}
          </p>
          <ul className="dash-rank">{report.rows.map(item => <li key={item.id}>
            <div className="dash-rank-main">
              <Link to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
              {item.sku && <span className="app-cell-sub">{item.sku}</span>}
              <span className="app-cell-sub">Залишок {numberFormat.format(item.onHand)} · резерв {numberFormat.format(item.reserved)}</span>
            </div>
            <div className="dash-rank-side">
              <TableChip tone={item.available <= 0 ? 'danger' : 'warning'} value={`Доступно ${numberFormat.format(item.available)}`} />
              {item.net == null ? <span className="app-cell-sub">Оборот невідомий</span> : <>
                <strong className="app-money">{formatPrice(item.net)}</strong>
                {item.share != null && <span className="app-cell-sub">{formatShare(item.share)} обороту</span>}
              </>}
            </div>
          </li>)}</ul>
        </> : <p className="dash-rank-empty">{report.total === 0 ? 'У каталозі немає товарів із підтвердженим малим або нульовим залишком.' : 'За цими умовами товарів немає.'}</p>}
        {report.matches > report.pageSize && <div className="dash-product-tools">
          <Paginator page={report.page} pageSize={report.pageSize} totalPages={Math.ceil(report.matches / report.pageSize)}
            onPageChange={page => setFilters(current => ({ ...current, page }))} />
        </div>}
      </> : <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={reload}
        description={problemMessage(query.problem, 'Не вдалося завантажити залишки й оборот товарів.')} />}
    </DashboardCard>
  )
}
