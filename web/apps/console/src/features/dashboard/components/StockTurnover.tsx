import { Select, TextInput } from '@mantine/core'
import { IconPackage, IconSearch } from '@tabler/icons-react'
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
    <DashboardCard title={<><IconPackage aria-hidden="true" />Товари з малим залишком</>} className="dash-product-report dash-stock-impact" flush>
      {report && <div className="dash-product-summary">
        <span>Чистий оборот товарів із малим залишком</span>
        <div className="dash-product-summary-value"><strong>{report.net != null ? formatPrice(report.net) : 'Оборот невідомий'}</strong>
          {report.share != null && <span className="dash-share" title={'Частка від загального обороту ' + formatPrice(report.periodNet)}>{formatShare(report.share)} обороту</span>}</div>
        <small>{dateRange(report.start, report.through)} · загалом {formatPrice(report.periodNet)}</small>
        {report.periodNet <= 0 && <small>Частка доступна за додатного загального обороту.</small>}
        {report.unknownCount > 0 && <small>Товарів без підтвердженого обороту · {numberFormat.format(report.unknownCount)}. У підсумку враховано лише підтверджені суми.</small>}
      </div>}
      <div className="dash-product-tools">
        <TextInput size="sm" radius="xl" leftSection={<IconSearch size={16} />} aria-label="Пошук товарів із малим залишком" placeholder="Назва або артикул" maxLength={120} value={draft}
          onChange={event => { const value = event.currentTarget.value; setDraft(value); search(value) }} />
        <Select size="sm" radius="xl" aria-label="Доступність товарів" allowDeselect={false} value={filters.stock}
          data={[
            { value: 'all', label: report ? `Усі · ${numberFormat.format(report.total)}` : 'Усі' },
            { value: 'out', label: report ? `Немає · ${numberFormat.format(report.outCount)}` : 'Немає' },
            { value: 'low', label: report ? `Мало · ${numberFormat.format(report.lowCount)}` : 'Мало' },
          ]}
          onChange={value => setFilters(current => ({ ...current, stock: value ?? 'all', page: 1 }))} />
      </div>
      {report ? <>
        <div className="dash-product-count" aria-live="polite"><span>Показано <b>{report.rows.length ? numberFormat.format((report.page - 1) * report.pageSize + 1) + '–' + numberFormat.format((report.page - 1) * report.pageSize + report.rows.length) : '0'} із {numberFormat.format(report.matches)}</b></span>
          <span>До {numberFormat.format(report.threshold)} од. після резервів</span></div>
        {report.rows.length > 0 ? <>
          <ul className="dash-rank">{report.rows.map(item => <li key={item.id}>
            <div className="dash-rank-main">
              <Link to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
              <div className="dash-product-meta">{item.sku && <span className="dash-product-sku">{item.sku}</span>}
                <TableChip tone={item.available <= 0 ? 'danger' : 'warning'} value={`Доступно ${numberFormat.format(item.available)}`} /></div>
              <span className="app-cell-sub">Залишок {numberFormat.format(item.onHand)} · резерв {numberFormat.format(item.reserved)}</span>
            </div>
            <div className="dash-rank-side">
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
