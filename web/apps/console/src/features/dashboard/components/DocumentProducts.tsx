import { Button, Pagination, Select, TextInput } from '@mantine/core'
import { IconArrowLeft, IconChartBar, IconChartPie, IconChevronDown, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { PurchaseInvoices } from './PurchaseInvoices'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { TableChip } from '@/shared/ui/TableChip'
import { dateRange, formatAmount, formatPrice } from '@/shared/lib/salesFormat'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { DashboardState } from './DashboardSkeleton'
import { getProductProfit, type DocumentSales } from '../api/dashboardApi'
import { CalculationInfo } from './CalculationInfo'
import { DashboardCard } from './DashboardCard'
import { ProductReportDetails, ProductReportOverview } from './ProductReportOverview'

type Product = DocumentSales['products'][number]
const batch = 10
const percent = new Intl.NumberFormat('uk-UA', { style: 'percent', maximumFractionDigits: 2 })
const share = (n: number | null) => {
  if (n == null) return '—'
  if (n !== 0 && Math.abs(n) < .0001) return n > 0 ? '< 0,01 %' : 'між −0,01 % і 0 %'
  return percent.format(n)
}

export function DocumentProducts({ data }: { data: DocumentSales }) {
  const [opened, setOpened] = useState(false)
  const [picked, setPicked] = useState<Product | null>(null)
  function openProfit(product: Product | null) {
    setPicked(product)
    setOpened(true)
  }
  return <DashboardCard flush className="dash-product-report report-card" title="Продажі товарів"
    aside={<button type="button" className="report-action" aria-label="Звіт про прибуток" title="Звіт про прибуток"
      aria-haspopup="dialog" onClick={() => openProfit(null)}><IconChartBar size={19} aria-hidden="true" /></button>}>
    <PeriodProducts data={data} open={openProfit} />
    <AppEditorModal opened={opened} onClose={() => setOpened(false)} size="standard" className="dash-profit-modal"
      title={<MetricLabel icon={IconChartBar}>Валовий прибуток за товарами</MetricLabel>}>
      <div className="dash-product-report dash-profit-panel">
        <HistoricalProfit key={picked ? JSON.stringify([picked.account, picked.code]) : 'all'} picked={picked} clear={() => setPicked(null)} />
      </div>
    </AppEditorModal>
  </DashboardCard>
}

function PeriodProducts({ data, open }: { data: DocumentSales; open: (p: Product) => void }) {
  const [limit, setLimit] = useState(batch)
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState(data.products.some(p => p.profit != null) ? 'profit' : 'highest')
  const term = search.trim().toLowerCase()
  const withProfit = data.products.filter(p => p.profit != null).length
  const matches = data.products.filter(p => [p.name, p.sku, p.code].some(s => s?.toLowerCase().includes(term)))
  if (order === 'lowest') matches.reverse()
  const metric = order === 'margin' ? 'margin' : 'profit'
  if (['profit', 'loss', 'margin'].includes(order)) matches.sort((a,b) => {
    const left = a[metric], right = b[metric]
    if (left == null || right == null) return Number(left == null) - Number(right == null)
    return order === 'loss' ? left - right : right - left
  })
  const visible = matches.slice(0,limit)
  return <>
    <ProductReportOverview value={formatPrice(data.products.reduce((net, product) => net + product.net, 0))}
      label={data.incompleteProducts ? 'Чиста виручка за підтвердженими товарними рядками' : 'Чиста виручка від продажу товарів'}
      period={dateRange(data.start, data.through)}
      groups={[{ label: 'З відомим прибутком', count: withProfit },
        { label: 'Без оцінки прибутку', count: data.products.length - withProfit }]} />
    <ProductReportDetails label="Продажі за товарами">
    <div className="dash-products-period dash-with-info"><span>{dateRange(data.start, data.through)}</span>
      <CalculationInfo title="Як розраховано показники продажів">
        <section><strong>Як розраховано собівартість і прибуток</strong>
          <p>Беремо собівартість із рядка продажу. Якщо її немає, використовуємо закупівельну ціну останнього дня надходження на цей склад для тієї самої організації, товару й одиниці. Ціна дорівнює сумі товарних рядків у гривнях, поділеній на кількість. У день продажу враховуємо лише накладні з відомим ранішим часом.</p>
          <p>Повернення сторнує вартість відповідної кількості з первісного продажу. Прибуток дорівнює чистій виручці мінус собівартість, маржа — його частка в додатній чистій виручці. Використано суми товарних рядків із документів. Оцінка за ціною надходження може відрізнятися від облікового списання партій. Товари з неповними даними показано в кінці рейтингу прибутку.</p>
        </section>
        <section><strong>Як розраховано частку та групу ABC</strong>
          <p>Частка дорівнює виручці товару після повернень, поділеній на весь чистий оборот за вибрані дні. За нульового або від’ємного обороту частка невизначена.</p>
          <p>Для ABC товари впорядковано за додатною виручкою. Група A формує перші 80 %, B — наступні 15 %, C — решту. Товар на межі та товари з однаковою виручкою входять до групи, з якої почали відлік.</p>
        </section>
      </CalculationInfo>
    </div>
    <div className="dash-product-tools">
      <TextInput size="sm" radius="xl" leftSection={<IconSearch size={16} />} aria-label="Пошук товару за період" placeholder="Назва, код або артикул" value={search}
        onChange={e => {setSearch(e.currentTarget.value); setLimit(batch)}} />
      <Select size="sm" radius="xl" aria-label="Сортування товарів за період" allowDeselect={false} value={order}
        data={[{value:'highest', label:'Найбільша виручка'}, {value:'lowest', label:'Найменша виручка'},
          ...(withProfit ? [{value:'profit',label:'Найбільший прибуток'}, {value:'loss',label:'Найменший прибуток'},
            {value:'margin',label:'Найвища маржа'}] : [])]}
        onChange={v => {setOrder(v ?? 'highest'); setLimit(batch)}} />
    </div>
    <div className="dash-product-count" aria-live="polite"><span>Показано <b>{formatAmount(visible.length)} із {formatAmount(matches.length)}</b></span>
      <span>З відомим прибутком <b>{formatAmount(withProfit)} із {formatAmount(data.products.length)}</b></span></div>
    {visible.length > 0 ? <ol className="report-tiles" aria-label="Продажі товарів за період">
      {visible.map((p, i) => <li className="report-tile" key={JSON.stringify([p.account, p.code, p.sku, p.name])}>
        <header className="report-tile-head">
          <h3>{p.code ? <button className="dash-product-link" aria-haspopup="dialog" title="Відкрити звіт про прибуток цього товару" onClick={() => open(p)}>{p.name}</button> : p.name}</h3>
          <div className="report-tile-meta"><span>№ {i + 1}</span>{p.sku && <span>Арт. {p.sku}</span>}{p.abc && <span>Група {p.abc}</span>}</div>
        </header>
        <div className="report-tile-metric">
          <span className="report-metric-label">Виручка</span>
          <div className="report-metric-line">
            <strong>{formatPrice(p.net)}</strong>
            {p.share != null && <TableChip tone="product" value={share(p.share) + ' обороту'} />}
          </div>
        </div>
        <details className="report-tile-details">
          <summary aria-label={`Деталі продажів · ${p.name}`} title="Деталі продажів"><IconChevronDown size={17} aria-hidden="true" /></summary>
          <div className="report-tile-body">
            <dl className="report-tile-facts">
              <div><dt>Прибуток</dt><dd data-loss={p.profit != null && p.profit < 0 || undefined}>{p.profit == null ? '—' : formatPrice(p.profit)}</dd>
                {!!p.purchaseSources?.length && p.profit != null && <dd className="app-cell-sub">розрахунковий</dd>}</div>
              <div><dt>Маржа</dt><dd data-loss={p.margin != null && p.margin < 0 || undefined}>{share(p.margin)}</dd></div>
              {p.cost != null && <div><dt>Собівартість</dt><dd>{formatPrice(p.cost)}</dd></div>}
              {p.share == null && <div><dt>Частка обороту</dt><dd>—</dd></div>}
            </dl>
            {!!p.purchaseSources?.length && <PurchaseInvoices invoices={p.purchaseSources} />}
            {p.profit == null && p.lines != null && <span className="app-cell-sub">
              Бракує собівартості · рядків {formatAmount(p.lines - p.costedLines)} із {formatAmount(p.lines)}.
              {p.costedLines > 0 && <> Прибуток лише за оціненими рядками {formatPrice(p.coveredNet - p.coveredCost)}.</>}
            </span>}
          </div>
        </details>
      </li>)}
    </ol> : <p className="dash-rank-empty">Товарів за цими умовами немає.</p>}
    {matches.length > batch && <div className="dash-rank-actions">
      {visible.length < matches.length && <Button variant="default" size="xs" onClick={() => setLimit(limit + batch)}>Показати ще {Math.min(batch, matches.length-limit)}</Button>}
      {limit > batch && <Button variant="subtle" size="xs" onClick={() => setLimit(batch)}>Згорнути</Button>}
    </div>}
    {data.incompleteProducts > 0 && <p className="dash-report-note">Документів із нерозподіленою між товарами сумою · {formatAmount(data.incompleteProducts)}.</p>}
    </ProductReportDetails>
  </>
}

function HistoricalProfit({ picked, clear }: { picked: Product | null; clear: () => void }) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('profit')
  const [search, setSearch] = useState('')
  const params = new URLSearchParams({page:String(page), sort, search})
  if (picked?.code) {params.set('code',picked.code); params.set('account',picked.account)}
  const query = useApiQuery('product-profit?' + params, () => getProductProfit(params))
  const report = query.data
  const totals = report?.available && <section className="dash-profit-totals">
    <header><h3>Загалом у звіті DNTrade</h3><span>{dateRange(report.start, report.through)}</span></header>
    <dl>
      <div><dt>Продажі</dt><dd>{formatPrice(report.net)}</dd></div>
      <div><dt>Валовий прибуток</dt><dd>{formatPrice(report.profit)}</dd></div>
      <div><dt>Товарів</dt><dd>{formatAmount(report.total)}</dd></div>
      <div><dt>Збиткових товарів</dt><dd>{formatAmount(report.lossCount)}</dd></div>
    </dl>
  </section>
  return <>
    {picked && <header className="dash-profit-product-head">
      <div><h3>{picked.name}</h3><small>Код {picked.code}</small></div>
      <Button size="xs" radius="xl" variant="default" leftSection={<IconArrowLeft size={14} />} onClick={clear}>Усі товари</Button>
    </header>}
    {!picked && <div className="dash-product-tools">
      <TextInput size="sm" radius="xl" leftSection={<IconSearch size={16} />} aria-label="Пошук у звіті про прибуток" placeholder="Назва або код" maxLength={160} value={search}
        onChange={e => {setSearch(e.currentTarget.value); setPage(1)}} />
      <Select size="sm" radius="xl" aria-label="Сортування товарів у звіті" allowDeselect={false} value={sort}
        data={[{value:'profit',label:'Найбільший прибуток'}, {value:'lowest',label:'Найменший прибуток'},
          {value:'margin',label:'Найвища маржа'}, {value:'sales',label:'Найбільші продажі'}]}
        onChange={v => {setSort(v ?? 'profit'); setPage(1)}} />
    </div>}
    {query.status !== 'ready' ? <DashboardState kind={query.status} onRetry={query.reload} /> :
      !report?.available ? <p className="dash-rank-empty">Звіт DNTrade про валовий прибуток ще недоступний.</p> : <>
        {!picked && totals}
        {report.rows.length > 0 && <ol className="dash-profit-rows" data-selected={picked ? true : undefined}>
          {report.rows.map((p,i) => <li key={p.code}>
            {!picked && <div className="dash-profit-identity"><span className="dash-invoice-count">{(page-1)*25+i+1}</span>
              <div><strong>{p.name}</strong><small>Код {p.code}</small></div></div>}
            <div className="dash-profit-amount"><span>Валовий прибуток</span>
              <strong data-loss={p.profit < 0 || undefined}>{formatPrice(p.profit)}</strong></div>
            <dl className="dash-finance-chips">
              <div className="dash-revenue-chip"><dt>Продажі</dt><dd>{formatPrice(p.net)}</dd></div>
              <div><dt>Закупівля</dt><dd>{formatPrice(p.cost)}</dd></div>
              <div data-margin={p.margin ? (p.margin > 0 ? 'positive' : 'negative') : undefined}><dt>Маржа</dt><dd>{share(p.margin)}</dd></div>
              <div className="dash-turnover-share-chip"><dt><IconChartPie size={13} aria-hidden="true" />Частка продажів</dt><dd>{share(p.share)}</dd></div>
            </dl>
          </li>)}</ol>}
        {report.matches === 0 && <p className="dash-rank-empty">{picked ? 'У цьому звіті немає рядка з таким кодом товару й джерелом обліку.' : 'За пошуком товарів немає.'}</p>}
        {picked && totals}
        {report.matches > 25 && <div className="dash-product-tools"><Pagination size="sm" siblings={0} total={Math.ceil(report.matches/25)} value={page} onChange={setPage} /></div>}
      </>}
  </>
}
