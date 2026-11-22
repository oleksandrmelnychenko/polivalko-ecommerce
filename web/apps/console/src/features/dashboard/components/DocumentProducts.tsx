import { Button, Group, Pagination, Select, TextInput } from '@mantine/core'
import { IconChartBar, IconChartPie, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { PurchaseInvoices } from './PurchaseInvoices'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { dateRange, formatAmount, formatPrice } from '@/shared/lib/salesFormat'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageState } from '@/shared/ui/PageState'
import { getProductProfit, type DocumentSales } from '../api/dashboardApi'
import { DashboardCard } from './DashboardCard'

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
  return <DashboardCard flush className="dash-product-report" title={<><IconChartBar aria-hidden="true" />Продажі товарів</>}
    aside={<Button size="xs" radius="xl" variant="default" aria-haspopup="dialog" onClick={() => openProfit(null)}>Звіт про прибуток</Button>}>
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
    <p className="dash-products-period">{dateRange(data.start, data.through)}</p>
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
    {visible.length > 0 ? <table className="dash-sales-table" aria-label="Продажі товарів за період">
      <thead><tr><th scope="col">Товар</th><th scope="col">Виручка</th><th scope="col">Прибуток</th><th scope="col">Маржа</th></tr></thead>
      {visible.map((p, i) => <tbody key={JSON.stringify([p.account, p.code, p.sku, p.name])}>
        <tr className="dash-sales-values">
          <th scope="row">
            {p.code ? <button className="dash-product-link" aria-haspopup="dialog" title="Відкрити звіт про прибуток цього товару" onClick={() => open(p)}>{p.name}</button> : p.name}
            <div className="dash-product-meta"><span>№ {i + 1}</span>{p.sku && <span className="dash-product-sku">{p.sku}</span>}{p.abc && <span className="dash-abc">Група {p.abc}</span>}</div>
          </th>
          <td><span className="dash-mobile-label" aria-hidden="true">Виручка</span>{formatPrice(p.net)}</td>
          <td data-loss={p.profit != null && p.profit < 0 || undefined}><span className="dash-mobile-label" aria-hidden="true">Прибуток</span><strong>{p.profit == null ? "—" : formatPrice(p.profit)}</strong>
            {!!p.purchaseSources?.length && p.profit != null && <small>розрахунковий</small>}</td>
          <td><span className="dash-mobile-label" aria-hidden="true">Маржа</span>{share(p.margin)}</td>
        </tr>
        <tr><td colSpan={4} className="dash-sales-context">
          <dl className="dash-finance-chips">
            {p.cost != null && <div><dt>Собівартість</dt><dd>{formatPrice(p.cost)}</dd></div>}
            <div className="dash-turnover-share-chip"><dt><IconChartPie size={13} aria-hidden="true" />Частка обороту</dt><dd>{share(p.share)}</dd></div>
          </dl>
          {!!p.purchaseSources?.length && <PurchaseInvoices invoices={p.purchaseSources} />}
          {p.profit == null && p.lines != null && <span className="app-cell-sub">
            Бракує собівартості · рядків {formatAmount(p.lines - p.costedLines)} із {formatAmount(p.lines)}.
            {p.costedLines > 0 && <> Прибуток лише за оціненими рядками {formatPrice(p.coveredNet - p.coveredCost)}.</>}
          </span>}
        </td></tr>
      </tbody>)}
    </table> : <p className="dash-rank-empty">Товарів за цими умовами немає.</p>}
    {matches.length > batch && <div className="dash-rank-actions">
      {visible.length < matches.length && <Button variant="default" size="xs" onClick={() => setLimit(limit + batch)}>Показати ще {Math.min(batch, matches.length-limit)}</Button>}
      {limit > batch && <Button variant="subtle" size="xs" onClick={() => setLimit(batch)}>Згорнути</Button>}
    </div>}
    <details className="dash-report-note"><summary>Як розраховано собівартість і прибуток</summary>
      <p>Беремо собівартість із рядка продажу. Якщо її немає, використовуємо закупівельну ціну останнього дня надходження на цей склад для тієї самої організації, товару й одиниці. Ціна дорівнює сумі товарних рядків у гривнях, поділеній на кількість. У день продажу враховуємо лише накладні з відомим ранішим часом.</p>
      <p>Повернення сторнує вартість відповідної кількості з первісного продажу. Прибуток дорівнює чистій виручці мінус собівартість, маржа — його частка в додатній чистій виручці. Використано суми товарних рядків із документів. Оцінка за ціною надходження може відрізнятися від облікового списання партій. Товари з неповними даними показано в кінці рейтингу прибутку.</p>
    </details>
    {data.incompleteProducts > 0 && <p className="dash-report-note">Документів із нерозподіленою між товарами сумою · {formatAmount(data.incompleteProducts)}.</p>}
    <details className="dash-report-note"><summary>Як розраховано частку та групу ABC</summary>
      <p>Частка дорівнює виручці товару після повернень, поділеній на весь чистий оборот за вибрані дні. За нульового або від’ємного обороту частка невизначена.</p>
      <p>Для ABC товари впорядковано за додатною виручкою. Група A формує перші 80 %, B — наступні 15 %, C — решту. Товар на межі та товари з однаковою виручкою входять до групи, з якої почали відлік.</p>
    </details>
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
  return <>
    {picked && <Group className="dash-product-tools" gap="sm"><strong>{picked.name}</strong><Button size="xs" radius="xl" variant="default" onClick={clear}>Усі товари</Button></Group>}
    {!picked && <div className="dash-product-tools">
      <TextInput size="sm" radius="xl" leftSection={<IconSearch size={16} />} aria-label="Пошук у звіті про прибуток" placeholder="Назва або код" maxLength={160} value={search}
        onChange={e => {setSearch(e.currentTarget.value); setPage(1)}} />
      <Select size="sm" radius="xl" aria-label="Сортування товарів у звіті" allowDeselect={false} value={sort}
        data={[{value:'profit',label:'Найбільший прибуток'}, {value:'lowest',label:'Найменший прибуток'},
          {value:'margin',label:'Найвища маржа'}, {value:'sales',label:'Найбільші продажі'}]}
        onChange={v => {setSort(v ?? 'profit'); setPage(1)}} />
    </div>}
    {query.status !== 'ready' ? <PageState kind={query.status} onRetry={query.reload} /> :
      !report?.available ? <p className="dash-rank-empty">У прод-БД поки немає зведеного звіту DNTrade про валовий прибуток.</p> : <>
        <p className="dash-report-note"><b>Загалом у звіті DNTrade · {dateRange(report.start,report.through)}</b><br />
          Продажі {formatPrice(report.net)} · валовий прибуток {formatPrice(report.profit)}. Товарів {formatAmount(report.total)}, з них збиткових {formatAmount(report.lossCount)}.</p>
        <ol className="dash-rank">{report.rows.map((p,i) => <li key={p.code}><span className="dash-rank-n">{(page-1)*25+i+1}</span>
          <div className="dash-rank-main"><strong>{p.name}</strong><span className="app-cell-sub">Код {p.code} · {share(p.share)} продажів</span>
            <span className="app-cell-sub">Продажі {formatPrice(p.net)} · закупівля {formatPrice(p.cost)}</span></div>
          <div className="dash-rank-side"><b className="app-money" data-loss={p.profit < 0 || undefined}>{formatPrice(p.profit)}</b>
            <span className="app-cell-sub">Маржа {share(p.margin)}</span></div></li>)}</ol>
        {report.matches === 0 && <p className="dash-rank-empty">{picked ? 'У цьому звіті немає рядка з таким кодом товару й джерелом обліку.' : 'За пошуком товарів немає.'}</p>}
        {report.matches > 25 && <div className="dash-product-tools"><Pagination size="sm" total={Math.ceil(report.matches/25)} value={page} onChange={setPage} /></div>}
        <p className="dash-report-note">Маржа — валовий прибуток у відсотках від продажів товару за дати звіту. Операційні витрати бізнесу обліковуються окремо.</p>
      </>}
  </>
}
