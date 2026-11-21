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
const decisionText = {
  covered: 'Запасу вистачає', 'no-demand': 'Немає додатних продажів після повернень',
  sales: 'Бракує підтверджених продажів', units: 'Звірити одиниці продажу й залишку',
  price: 'Перевірити ціну й рентабельність', cost: 'Уточнити собівартість', reserves: 'Звірити непокриті резерви',
}

function formatShare(value: number) {
  if (value > 0 && value < 0.0001) return '< 0,01 %'
  if (value < 0 && value > -0.0001) return 'між −0,01 % і 0 %'
  return percent.format(value)
}

export function StockTurnover({ days }: { days: number }) {
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState({ page: 1, pageDays: days, stock: 'all', search: '', cover: '14', sort: 'purchase' })
  const search = useDebouncedCallback((value: string) => {
    setFilters(current => ({ ...current, search: value.trim(), page: 1 }))
  }, 300)
  const params = new URLSearchParams({
    days: String(days), page: String(filters.pageDays === days ? filters.page : 1), stock: filters.stock, search: filters.search,
    coverDays: filters.cover, sort: filters.sort,
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
            { value: 'buy', label: report ? `До закупівлі · ${numberFormat.format(report.buyCount)}` : 'До закупівлі' },
            { value: 'out', label: report ? `Немає · ${numberFormat.format(report.outCount)}` : 'Немає' },
            { value: 'low', label: report ? `Мало · ${numberFormat.format(report.lowCount)}` : 'Мало' },
          ]}
          onChange={value => setFilters(current => ({ ...current, stock: value ?? 'all', page: 1 }))} />
        <Select size="sm" radius="xl" label="Запас на" allowDeselect={false} value={filters.cover}
          data={[{ value: '7', label: '7 днів' }, { value: '14', label: '14 днів' }, { value: '30', label: '30 днів' }]}
          onChange={value => setFilters(current => ({ ...current, cover: value ?? '14', page: 1 }))} />
        <Select size="sm" radius="xl" label="Сортування" allowDeselect={false} value={filters.sort}
          data={[{ value: 'purchase', label: 'Черга закупівель' }, { value: 'turnover', label: 'За оборотом' }]}
          onChange={value => setFilters(current => ({ ...current, sort: value ?? 'purchase', page: 1 }))} />
      </div>
      {report ? <>
        <details className="dash-report-note">
          <summary>Позицій до закупівлі · {numberFormat.format(report.buyCount)}. Як розраховано</summary>
          <p>Темп — продана кількість за {days} днів після повернень, поділена на {days}. Від потреби на {report.coverDays} днів віднімаємо доступний залишок після резервів. Штучні товари округлюємо вгору до цілої штуки.</p>
          <p>Першими в черзі йдуть товари з найбільшим очікуваним валовим прибутком від поповнення. Для цього беремо оборот товару за період, його маржу й кількість днів, на які бракує запасу. Розрахунок припускає той самий темп продажів. Поставки в дорозі слід врахувати окремо.</p>
        </details>
        <div className="dash-product-count" aria-live="polite"><span>Показано <b>{report.rows.length ? numberFormat.format((report.page - 1) * report.pageSize + 1) + '–' + numberFormat.format((report.page - 1) * report.pageSize + report.rows.length) : '0'} із {numberFormat.format(report.matches)}</b></span>
          <span>До {numberFormat.format(report.threshold)} од. після резервів</span></div>
        {report.rows.length > 0 ? <>
          <ul className="dash-rank">{report.rows.map(item => <li key={item.id}>
            <div className="dash-rank-main">
              <Link to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
              <div className="dash-product-meta">{item.sku && <span className="dash-product-sku">{item.sku}</span>}
                <TableChip tone={item.available <= 0 ? 'danger' : 'warning'} value={`Доступно ${numberFormat.format(item.available)}`} /></div>
              <span className="app-cell-sub">Залишок {numberFormat.format(item.onHand)} · резерв {numberFormat.format(item.reserved)}</span>
              {item.dailyRate != null && <span className="app-cell-sub">Темп {item.dailyRate > 0 && item.dailyRate < 0.001 ? '< 0,001' : numberFormat.format(item.dailyRate)} {item.unit || 'од.'}/день
                {item.stockDays != null && ` · запас на ${numberFormat.format(Math.round(item.stockDays * 10) / 10)} дн.`}</span>}
              {item.dailyRate !== 0 && <span className="app-cell-sub">Маржа {item.margin == null ? 'невідома' : formatShare(item.margin)}</span>}
              {item.purchaseStatus === 'buy'
                ? <><strong>Закупити {numberFormat.format(item.buyQuantity)} {item.unit}</strong>
                    <span className="app-cell-sub">Очікуваний валовий прибуток від поповнення · {formatPrice(item.priorityProfit)}</span></>
                : <><span className="app-cell-sub">{decisionText[item.purchaseStatus]}</span>
                    {item.need != null && item.need > 0 && <span className="app-cell-sub">Розрахункова потреба · {numberFormat.format(item.need)} {item.unit || 'од.'}</span>}</>}
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
            onPageChange={page => setFilters(current => ({ ...current, page, pageDays: days }))} />
        </div>}
      </> : <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={reload}
        description={problemMessage(query.problem, 'Не вдалося завантажити залишки й оборот товарів.')} />}
    </DashboardCard>
  )
}
