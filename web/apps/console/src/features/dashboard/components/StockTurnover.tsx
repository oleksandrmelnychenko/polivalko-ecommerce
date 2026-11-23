import { Button, Select, TextInput } from '@mantine/core'
import { IconChevronDown, IconAdjustmentsHorizontal, IconSearch, IconShoppingCart } from '@tabler/icons-react'
import { useDebouncedCallback } from '@mantine/hooks'
import { useContext, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { problemMessage } from '@/shared/api/problem'
import { onConsoleEvent } from '@/shared/lib/events'
import { dateRange, formatPrice } from '@/shared/lib/salesFormat'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { DocumentOverlayContext } from '@/shared/ui/DocumentLink'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { getStockTurnover } from '../api/dashboardApi'
import { numberFormat } from '../lib/insights'
import { DashboardCard } from './DashboardCard'
import { ProductReportDetails, ProductReportOverview } from './ProductReportOverview'
import { CalculationInfo } from './CalculationInfo'
import { SupplierOrders } from './SupplierOrders'
import { BudgetBySupplier, ReceiptPrice } from './SupplierPurchases'
import { useSupplierBasket } from './SupplierBasket'

const percent = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 2 })
const defaultStock = 'buy'
const decisionText = {
  covered: 'Докупити 0 · запасу вистачає', 'no-demand': 'Докупити 0 · немає додатних продажів після повернень',
  sales: 'Бракує підтверджених продажів', units: 'Звірити одиниці продажу й залишку',
  price: 'Перевірити ціну й рентабельність', cost: 'Уточнити собівартість', reserves: 'Звірити непокриті резерви',
  incoming: 'Докупити 0 · потребу покриває поставка', 'supply-review': 'Уточнити поставку перед закупівлею',
  'season-review': 'Перевірити перед сезоном · поточного попиту для оцінки прибутку бракує',
}

function formatShare(value: number) {
  if (value > 0 && value < 0.0001) return '< 0,01 %'
  if (value < 0 && value > -0.0001) return 'між −0,01 % і 0 %'
  return percent.format(value)
}

type StockTurnoverProps = { days: number; purchasesOpen: boolean; openPurchases: () => void; closePurchases: () => void }

export function StockTurnover(props: StockTurnoverProps) {
  const { me } = useAuth()
  return me ? <StockReport key={me.email} account={me.email} {...props} /> : null
}

function StockReport({ days, account, purchasesOpen, openPurchases, closePurchases }: StockTurnoverProps & { account: string }) {
  const documentOpen = useContext(DocumentOverlayContext)
  const basket = useSupplierBasket(account)
  const [draft, setDraft] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterPanel = useId()
  const [filters, setFilters] = useState({ page: 1, pageDays: days, stock: defaultStock, search: '', cover: '14', sort: 'purchase', seasonal: true })
  const changedFilters = [filters.stock !== defaultStock, filters.cover !== '14', filters.sort !== 'purchase', !filters.seasonal].filter(Boolean).length
  const search = useDebouncedCallback((value: string) => {
    setFilters(current => ({ ...current, search: value.trim(), page: 1 }))
  }, 300)
  const params = new URLSearchParams({
    days: String(days), page: String(filters.pageDays === days ? filters.page : 1), stock: filters.stock, search: filters.search,
    coverDays: filters.cover, sort: filters.sort,
  })
  if (filters.seasonal) params.set('seasonal', '1')
  const query = useApiQuery('stock-turnover?' + params, () => getStockTurnover(params))
  const { reload } = query
  useEffect(() => onConsoleEvent('summary-stale', reload), [reload])
  const report = query.status === 'ready' ? query.data : undefined
  // Counters follow the search; an older service sends only the totals of all products.
  const counts = report && (report.counts ?? { all: report.total, buy: report.buyCount, supplyReview: report.supplyReview ?? 0,
    seasonReview: report.seasonalReview ?? 0, ordered: report.withOrders, out: report.outCount, low: report.lowCount })
  const showStock = (stock: string) => setFilters(current => ({ ...current, stock, page: 1 }))
  const sources = new Map(report?.supplierBudget?.suppliers.flatMap(group => group.items.map(item => [item.id, { group, item }] as const)))
  return (
    <DashboardCard title={<span id="zakupivli">Закінчуються</span>} className="dash-product-report dash-stock-impact report-card" flush
      aside={<button type="button" className="report-action" title="Закупівлі за постачальниками"
        aria-label="Закупівлі за постачальниками" aria-haspopup="dialog" onClick={openPurchases}><IconShoppingCart size={19} aria-hidden="true" /></button>}>
      {report ? <ProductReportOverview value={report.incompleteSales ? '—' : numberFormat.format(report.buyCount)}
        label={report.incompleteSales ? 'Бракує даних для розрахунку закупівлі' : 'Товарних позицій до закупівлі'}
        period={dateRange(report.start, report.through)}
        groups={[{ label: 'Немає в наявності', count: report.outCount }, { label: 'Малий залишок', count: report.lowCount }]} />
        : <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={reload}
            description={problemMessage(query.problem, 'Не вдалося завантажити залишки й оборот товарів.')} />}
      <ProductReportDetails label="Залишки та закупівлі">
      {report && <div className="dash-product-summary">
        <span className="dash-with-info">Чистий оборот усіх товарів із малим залишком
          <CalculationInfo title="Які товари враховано в обороті">
            <p>Оборот охоплює всі товари, для яких доступно до {numberFormat.format(report.threshold)} од. після резервів, незалежно від вибраного фільтра. У підсумку враховано лише підтверджені суми.</p>
            {report.share != null && <p>Частка від загального обороту за період · {formatPrice(report.periodNet)}.</p>}
          </CalculationInfo>
        </span>
        <div className="dash-product-summary-value"><strong>{report.net != null ? formatPrice(report.net) : 'Оборот невідомий'}</strong>
          {report.share != null && <TableChip tone="product" value={formatShare(report.share) + ' обороту'} />}</div>
        <small>{dateRange(report.start, report.through)}</small>
        {report.periodNet <= 0 && <small>Частка доступна за додатного загального обороту.</small>}
        {report.unknownCount > 0 && <small>Товарів без підтвердженого обороту · {numberFormat.format(report.unknownCount)}.</small>}
      </div>}
      <div className="dash-product-tools dash-stock-search">
        <TextInput size="sm" radius="xl" leftSection={<IconSearch size={16} />} aria-label="Пошук товарів із малим залишком" placeholder="Назва або артикул" maxLength={120} value={draft}
          onChange={event => { const value = event.currentTarget.value; setDraft(value); search(value) }} />
        <Button size="sm" variant="default" radius="xl" leftSection={<IconAdjustmentsHorizontal size={16} />} aria-controls={filterPanel}
          aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}>Фільтри{changedFilters > 0 && ' · ' + changedFilters}</Button>
      </div>
      <div className="dash-product-tools dash-stock-filters" id={filterPanel} hidden={!filtersOpen}>
        <Select size="sm" radius="xl" label="Доступність" aria-label="Доступність товарів" allowDeselect={false} value={filters.stock}
          data={[
            { value: 'buy', label: counts ? `До закупівлі · ${numberFormat.format(counts.buy)}` : 'До закупівлі' },
            { value: 'supply-review', label: counts ? `Уточнити поставку · ${numberFormat.format(counts.supplyReview)}` : 'Уточнити поставку' },
            { value: 'all', label: counts ? `Усі · ${numberFormat.format(counts.all)}` : 'Усі' },
            ...(filters.seasonal ? [{ value: 'season-review', label: 'Перевірити перед сезоном' + (counts ? ' · ' + counts.seasonReview : '') }] : []),
            { value: 'ordered', label: counts ? `Із замовленнями · ${numberFormat.format(counts.ordered)}` : 'Із замовленнями' },
            { value: 'out', label: counts ? `Немає · ${numberFormat.format(counts.out)}` : 'Немає' },
            { value: 'low', label: counts ? `Мало · ${numberFormat.format(counts.low)}` : 'Мало' },
          ]}
          onChange={value => showStock(value ?? defaultStock)} />
        <Select size="sm" radius="xl" label="Запас на" allowDeselect={false} value={filters.cover}
          data={[{ value: '7', label: '7 днів' }, { value: '14', label: '14 днів' }, { value: '30', label: '30 днів' }]}
          onChange={value => setFilters(current => ({ ...current, cover: value ?? '14', page: 1 }))} />
        <Select size="sm" radius="xl" label="Сортування" allowDeselect={false} value={filters.sort}
          data={[{ value: 'purchase', label: 'За валовим прибутком' }, { value: 'turnover', label: 'За оборотом' }]}
          onChange={value => setFilters(current => ({ ...current, sort: value ?? 'purchase', page: 1 }))} />
        <Select size="sm" radius="xl" label="План попиту" allowDeselect={false} value={filters.seasonal ? 'season' : 'rate'}
          data={[{ value: 'season', label: 'З урахуванням сезону' }, { value: 'rate', label: 'За поточним темпом' }]}
          onChange={value => setFilters(current => ({ ...current, seasonal: value === 'season', stock: current.stock === 'season-review' ? defaultStock : current.stock, page: 1 }))} />
      </div>
      {report && counts ? <>
        {(report.incompleteSales ?? 0) > 0 && <p className="dash-report-note" role="status">Потребу в закупівлі не розраховано. У документах продажу
          за період ({numberFormat.format(report.incompleteSales ?? 0)}) товарні рядки не сходяться із сумою документа або їх немає, тому продажі
          за товарами не підтверджено і черга «До закупівлі» порожня. Ці документи пораховано в картці продажів за документами.</p>}
        <div className="dash-product-count dash-stock-count">
          <span className="dash-with-info">До закупівлі · <b>{numberFormat.format(counts.buy)}</b>
          {counts.supplyReview > 0 && filters.stock !== 'supply-review' && <Button size="compact-xs" variant="subtle" onClick={() => showStock('supply-review')}>
            ще {numberFormat.format(counts.supplyReview)} · уточнити поставку</Button>}
          <CalculationInfo title="Як розраховано потребу в закупівлі">
            <p>Темп — продана кількість за {days} днів після повернень, поділена на {days}. Період закінчується вчора: сьогоднішній день ще триває і занизив би темп. Від потреби на {report.coverDays} днів віднімаємо доступний залишок після резервів. Штучні товари округлюємо вгору до цілої штуки.</p>
            {report.seasonal && <p>Порівнюємо денні продажі до й після цієї календарної межі у відповідні тижні останніх трьох років. Напрям зміни має повторитися щонайменше двічі. Перевагу має історія товару. Для категорії потрібно щонайменше три товари в тих самих одиницях, які продавалися в обох періодах. Її поправка обмежена множниками 0,67–1,5. За браком історії використовуємо поточний темп.</p>}
            <p>Поставку враховуємо з планової дати, після вирахування вже прийнятої кількості. Для товару з прив’язаним складом враховуємо його склад та організацію, для решти — замовлення бізнесу. Замовлення, строк якого минув чи не вказаний або стан якого потребує звірки, у нижній межі потреби вважаємо таким, що надійде: «Докупити» показує цю нижню межу, а поруч — скільки знадобиться без такої поставки. Якщо нижня межа нульова, товар переходить у список «Уточнити поставку». Чергу сортуємо за очікуваним валовим прибутком від кількості, якої бракуватиме навіть у разі надходження цих замовлень.</p>
          </CalculationInfo>
          </span>
          <span aria-live="polite">Показано <b>{report.rows.length ? numberFormat.format((report.page - 1) * report.pageSize + 1) + '–' + numberFormat.format((report.page - 1) * report.pageSize + report.rows.length) : '0'} із {numberFormat.format(report.matches)}</b></span>
        </div>
        {report.rows.length > 0 ? <>
          <ul className="report-tiles" aria-label="Залишки товарів">{report.rows.map(item => <li key={item.id} className="report-tile">
            <header className="report-tile-head">
              <h3><Link to={'/catalog/products/' + encodeURIComponent(item.id)}>{item.name}</Link></h3>
              {item.sku && <div className="report-tile-meta">Арт. {item.sku}</div>}
            </header>
            <dl className="report-stock-level">
              <div><dt>Доступно після резервів</dt><dd>{numberFormat.format(item.available)} {item.unit || 'од.'}</dd></div>
              {item.stockDays != null && report.coverDays > 0 && <div><dt>{item.season && item.season.factor !== 1 ? 'Запас за очікуваним попитом, днів' : 'Запас у днях'}</dt>
                <dd>{item.stockDays > 0 && item.stockDays < .1 ? '< 0,1' : numberFormat.format(Math.round(item.stockDays * 10) / 10)} із {report.coverDays}</dd>
                <dd className="report-stock-meter" aria-hidden="true"><i style={{ width: Math.min(100, Math.max(0, item.stockDays / report.coverDays * 100)) + '%' }} /></dd>
              </div>}
            </dl>
            <div className="dash-stock-decision">
              {item.purchaseStatus === 'buy'
                ? <div><strong>Докупити {numberFormat.format(item.buyQuantity)} {item.unit}{item.lastPurchase?.amount != null && ' · ' + formatPrice(item.lastPurchase.amount)}</strong>
                  {item.need != null && item.minimumNeed != null && item.minimumNeed < item.need && <div className="app-cell-sub">
                    Це нижня межа. Без поставки, яку слід уточнити, знадобиться <b>{numberFormat.format(item.need)} {item.unit}</b>.</div>}
                  <div className="app-cell-sub">Очікуваний валовий прибуток · <b>{formatPrice(item.priorityProfit)}</b></div>
                  {report.supplierBudget && <ReceiptPrice purchase={item.lastPurchase} />}
                </div>
                : <span>{decisionText[item.purchaseStatus]}{item.purchaseStatus === 'supply-review' && item.need != null &&
                  <span className="app-cell-sub"> Без цієї поставки знадобиться <b>{numberFormat.format(item.need)} {item.unit || 'од.'}</b>.</span>}</span>}
              {sources.has(item.id) && (basket.picked.some(row => row.id === item.id && row.supplier === sources.get(item.id)?.group.id && row.unit === item.unit)
                ? <TableChip tone="success" value="У кошику" />
                : <Button size="compact-xs" radius="xl" color="dark" leftSection={<IconShoppingCart size={14} aria-hidden="true" />}
                  onClick={() => {
                    const source = sources.get(item.id)!
                    basket.add([{ ...source.group, items: [source.item] }])
                  }}>Додати до кошика</Button>)}
            </div>
            <SupplierOrders supply={item.supply} unit={item.unit} />
            <details className="dash-stock-breakdown">
              <summary aria-label={`Деталі закупівлі · ${item.name}`} title="Деталі закупівлі"><IconChevronDown size={17} aria-hidden="true" /></summary>
              <div className="dash-stock-breakdown-body">
                <dl className="dash-stock-facts">
                  <div><dt>На складі / у резерві</dt><dd>{numberFormat.format(item.onHand)} / {numberFormat.format(item.reserved)} {item.unit || 'од.'}</dd></div>
                  {item.season && item.season.factor !== 1 && item.dailyRate != null && item.dailyRate > 0 && <div><dt>Очікуваний попит на день · із сезонною поправкою</dt>
                    <dd>{numberFormat.format(item.dailyRate * item.season.factor)} {item.unit || 'од.'}</dd></div>}
                  {item.dailyRate != null && <div><dt>Продажі на день</dt><dd>{item.dailyRate > 0 && item.dailyRate < 0.001 ? '< 0,001' : numberFormat.format(item.dailyRate)} {item.unit || 'од.'}</dd></div>}
                  <div><dt>Чистий оборот</dt><dd>{item.net == null ? 'Невідомий' : formatPrice(item.net)}</dd></div>
                  <div><dt>Частка обороту</dt><dd>{item.share == null ? '—' : formatShare(item.share)}</dd></div>
                  {item.dailyRate !== 0 && <div data-margin={item.margin ? (item.margin > 0 ? 'positive' : 'negative') : undefined}>
                    <dt>Маржа</dt><dd>{item.margin == null ? 'невідома' : formatShare(item.margin)}</dd>
                  </div>}
                </dl>
                {item.unitSource === 'sales' && <span className="app-cell-sub">Одиницю «{item.unit}» взято з документів продажу: у звіті про залишки одиниці для цього товару немає.</span>}
                {report.seasonal && item.dailyRate != null && item.dailyRate > 0 && <p className="dash-stock-season">{item.season
                  ? `Сезонна поправка за історією ${item.season.source === 'product' ? 'товару' : 'категорії'} × ${numberFormat.format(item.season.factor)}. Враховано сезонів · ${numberFormat.format(item.season.years)}.`
                  : `Потребу визначено за продажами за ${days} днів. Історії зіставних сезонів бракує для поправки.`}</p>}
                {item.historicalDemand != null && <span className="app-cell-sub">У відповідні тижні попередніх сезонів ({item.historicalSeasons}) продавалося близько {numberFormat.format(item.historicalDemand)} {item.unit} за {report.coverDays} дн.</span>}
                {item.supply.within > 0 && <span className="app-cell-sub">Надійде в межах плану · {numberFormat.format(item.supply.within)} {item.unit}
                  {item.needBeforeIncoming != null && ' · потреба до поставок ' + numberFormat.format(item.needBeforeIncoming) + ' ' + (item.unit || '')}</span>}
                {item.purchaseStatus !== 'buy' && item.need != null && item.need > 0 && item.minimumNeed === item.need && <span className="app-cell-sub">Розрахункова потреба · {numberFormat.format(item.need)} {item.unit || 'од.'}</span>}
                {item.minimumNeed != null && item.need != null && item.minimumNeed < item.need && <span className="app-cell-sub">
                  Потреба · {numberFormat.format(item.minimumNeed)}–{numberFormat.format(item.need)} {item.unit || 'од.'} залежно від підтвердження поставки.</span>}
                {report.supplierBudget && item.purchaseStatus !== 'buy' && <ReceiptPrice purchase={item.lastPurchase} />}
              </div>
            </details>
          </li>)}</ul>
        </> : <p className="dash-rank-empty">{report.total === 0 ? 'У каталозі немає товарів із підтвердженим малим або нульовим залишком.' : 'За цими умовами товарів немає.'}</p>}
        {report.matches > report.pageSize && <div className="dash-product-tools">
          <Paginator page={report.page} pageSize={report.pageSize} totalPages={Math.ceil(report.matches / report.pageSize)}
            onPageChange={page => setFilters(current => ({ ...current, page, pageDays: days }))} />
        </div>}
      </> : null}
      </ProductReportDetails>
      <AppEditorModal opened={purchasesOpen} onClose={closePurchases} size="standard" className="dash-purchases-modal"
        overlayProps={{ backgroundOpacity: 0.25, blur: 0, style: { backdropFilter: 'none' } }}
        closeOnEscape={!documentOpen} closeOnClickOutside={!documentOpen} trapFocus={!documentOpen}
        title={<MetricLabel icon={IconShoppingCart}>Закупівлі за постачальниками</MetricLabel>}>
        {report?.supplierBudget ? <BudgetBySupplier basket={basket} budget={report.supplierBudget}
          count={report.buyCount} through={report.asOf ?? report.through} cover={report.coverDays} days={days} seasonal={!!report.seasonal} />
          : <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={reload}
              description={problemMessage(query.problem, 'Розрахунок закупівель недоступний.')} />}
      </AppEditorModal>
    </DashboardCard>
  )
}
