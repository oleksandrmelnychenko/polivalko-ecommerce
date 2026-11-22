import { Select, TextInput } from '@mantine/core'
import { IconChartPie, IconPackage, IconSearch } from '@tabler/icons-react'
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
import { SupplierOrders } from './SupplierOrders'
import { BudgetBySupplier, ReceiptPrice } from './SupplierPurchases'

const percent = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 2 })
const decisionText = {
  covered: 'Докупити 0 · запасу вистачає', 'no-demand': 'Докупити 0 · немає додатних продажів після повернень',
  sales: 'Бракує підтверджених продажів', units: 'Звірити одиниці продажу й залишку',
  price: 'Перевірити ціну й рентабельність', cost: 'Уточнити собівартість', reserves: 'Звірити непокриті резерви',
  incoming: 'Докупити 0 · потребу покриває поставка', 'supply-review': 'Уточнити поставку перед закупівлею',
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
        <small>{dateRange(report.start, report.through)}</small>
        {report.periodNet <= 0 && <small>Частка доступна за додатного загального обороту.</small>}
        {report.unknownCount > 0 && <small>Товарів без підтвердженого обороту · {numberFormat.format(report.unknownCount)}. У підсумку враховано лише підтверджені суми.</small>}
      </div>}
      <div className="dash-product-tools dash-stock-filters">
        <TextInput size="sm" radius="xl" label="Пошук товару" leftSection={<IconSearch size={16} />} aria-label="Пошук товарів із малим залишком" placeholder="Назва або артикул" maxLength={120} value={draft}
          onChange={event => { const value = event.currentTarget.value; setDraft(value); search(value) }} />
        <Select size="sm" radius="xl" label="Доступність" aria-label="Доступність товарів" allowDeselect={false} value={filters.stock}
          data={[
            { value: 'all', label: report ? `Усі · ${numberFormat.format(report.total)}` : 'Усі' },
            { value: 'buy', label: report ? `До закупівлі · ${numberFormat.format(report.buyCount)}` : 'До закупівлі' },
            { value: 'ordered', label: report ? `Із замовленнями · ${numberFormat.format(report.withOrders)}` : 'Із замовленнями' },
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
        {report.supplierBudget && <BudgetBySupplier budget={report.supplierBudget} count={report.buyCount} year={report.through.slice(0, 4)} />}
        <details className="dash-report-note">
          <summary>Позицій до закупівлі · {numberFormat.format(report.buyCount)}. Як розраховано</summary>
          <p>Темп — продана кількість за {days} днів після повернень, поділена на {days}. Від потреби на {report.coverDays} днів віднімаємо доступний залишок після резервів. Штучні товари округлюємо вгору до цілої штуки.</p>
          <p>Поставку враховуємо з планової дати, після вирахування вже прийнятої кількості. Для товару з прив’язаним складом враховуємо його склад та організацію, для решти — замовлення бізнесу. Якщо строк або стан потребує уточнення, показуємо діапазон потреби. Чергу сортуємо за очікуваним валовим прибутком від кількості, якої бракуватиме навіть у разі надходження цих замовлень.</p>
        </details>
        <div className="dash-product-count" aria-live="polite"><span>Показано <b>{report.rows.length ? numberFormat.format((report.page - 1) * report.pageSize + 1) + '–' + numberFormat.format((report.page - 1) * report.pageSize + report.rows.length) : '0'} із {numberFormat.format(report.matches)}</b></span>
          <span>До {numberFormat.format(report.threshold)} од. після резервів</span></div>
        {report.rows.length > 0 ? <>
          <ul className="dash-rank">{report.rows.map(item => <li key={item.id}>
            <div className="dash-rank-main">
              <Link to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link>
              <div className="dash-product-meta">{item.sku && <span className="dash-product-sku">{item.sku}</span>}
                <TableChip tone={item.available <= 0 ? 'danger' : 'warning'} value={`Доступно ${numberFormat.format(item.available)}`} /></div>
            </div>
            <div className="dash-rank-side">
              {item.net == null ? <span className="app-cell-sub">Оборот невідомий</span> : <div className="dash-product-result">
                <span>Чистий оборот</span>
                <strong className="app-money">{formatPrice(item.net)}</strong>
              </div>}
            </div>
            <div className="dash-stock-details">
              <dl className="dash-finance-chips">
                <div><dt>Залишок</dt><dd>{numberFormat.format(item.onHand)}</dd></div>
                <div className="dash-reserve-chip"><dt>Резерв</dt><dd>{numberFormat.format(item.reserved)}</dd></div>
                <div className="dash-turnover-share-chip">
                  <dt><IconChartPie size={13} aria-hidden="true" />Частка обороту</dt>
                  <dd>{item.share == null ? '—' : formatShare(item.share)}</dd>
                </div>
                {item.dailyRate != null && <div><dt>Темп</dt><dd>{item.dailyRate > 0 && item.dailyRate < 0.001 ? '< 0,001' : numberFormat.format(item.dailyRate)} {item.unit || 'од.'}/день</dd></div>}
                {item.dailyRate != null && item.stockDays != null && <div><dt>Запас на</dt><dd>{numberFormat.format(Math.round(item.stockDays * 10) / 10)} дн.</dd></div>}
                {item.dailyRate !== 0 && <div data-margin={item.margin ? (item.margin > 0 ? 'positive' : 'negative') : undefined}>
                  <dt>Маржа</dt><dd>{item.margin == null ? 'невідома' : formatShare(item.margin)}</dd>
                </div>}
              </dl>
              <SupplierOrders supply={item.supply} unit={item.unit} />
              {item.supply.within > 0 && <span className="app-cell-sub">Надійде в межах плану · {numberFormat.format(item.supply.within)} {item.unit}
                {item.needBeforeIncoming != null && ' · потреба до поставок ' + numberFormat.format(item.needBeforeIncoming) + ' ' + (item.unit || '')}</span>}
              {item.purchaseStatus === 'buy'
                ? <><strong>Докупити {numberFormat.format(item.buyQuantity)} {item.unit}{item.lastPurchase?.amount != null && ' · ' + formatPrice(item.lastPurchase.amount)}</strong>
                    <span className="app-cell-sub">Очікуваний валовий прибуток від поповнення · {formatPrice(item.priorityProfit)}</span></>
                : <><span className="app-cell-sub">{decisionText[item.purchaseStatus]}</span>
                    {item.need != null && item.need > 0 && item.minimumNeed === item.need && <span className="app-cell-sub">Розрахункова потреба · {numberFormat.format(item.need)} {item.unit || 'од.'}</span>}</>}
              {item.minimumNeed != null && item.need != null && item.minimumNeed < item.need && <span className="app-cell-sub">
                Потреба · {numberFormat.format(item.minimumNeed)}–{numberFormat.format(item.need)} {item.unit || 'од.'} залежно від підтвердження поставки.</span>}
              {report.supplierBudget && <ReceiptPrice purchase={item.lastPurchase} year={report.through.slice(0, 4)} />}
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
