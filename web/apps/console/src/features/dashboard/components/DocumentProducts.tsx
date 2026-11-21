import { Button, Group, Pagination, SegmentedControl, Select, TextInput } from '@mantine/core'
import { useState } from 'react'
import { DocumentLink } from '@/shared/ui/DocumentLink'
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
  const [mode, setMode] = useState('period')
  const [picked, setPicked] = useState<Product | null>(null)
  return <DashboardCard flush title={mode === 'period' ? 'Товари за чистою виручкою' : 'Валовий прибуток за товарами'}>
    <div className="dash-product-tools"><SegmentedControl aria-label="Аналіз товарів" size="xs" value={mode}
      data={[{value:'period', label:'Оборот за період'}, {value:'history', label:'Звіт про прибуток'}]}
      onChange={v => {setPicked(null); setMode(v)}} /></div>
    {mode === 'period' ? <PeriodProducts data={data} open={p => { setPicked(p); setMode('history') }} /> :
      <HistoricalProfit key={picked?.code ?? 'all'} picked={picked} clear={() => setPicked(null)} />}
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
    <p className="dash-report-note">{dateRange(data.start, data.through)} · чистий оборот <b>{formatPrice(data.current.net)}</b></p>
    <div className="dash-product-tools">
      <TextInput size="xs" aria-label="Пошук товару за період" placeholder="Назва, код або артикул" value={search}
        onChange={e => {setSearch(e.currentTarget.value); setLimit(batch)}} />
      <Select size="xs" aria-label="Сортування товарів за період" allowDeselect={false} value={order}
        data={[{value:'highest', label:'Найбільша виручка'}, {value:'lowest', label:'Найменша виручка'},
          ...(withProfit ? [{value:'profit',label:'Найбільший прибуток'}, {value:'loss',label:'Найменший прибуток'},
            {value:'margin',label:'Найвища маржа'}] : [])]}
        onChange={v => {setOrder(v ?? 'highest'); setLimit(batch)}} />
    </div>
    <p className="dash-report-note" aria-live="polite">Показано {formatAmount(visible.length)} із {formatAmount(matches.length)} · прибуток розраховано для {formatAmount(withProfit)} із {formatAmount(data.products.length)} товарів за період.</p>
    {visible.length > 0 ? <ol className="dash-rank">{visible.map((p,i) => <li key={i}>
      <span className="dash-rank-n">{i+1}</span><div className="dash-rank-main">
        {p.code ? <button className="dash-product-link" title="Відкрити звіт про прибуток цього товару" onClick={() => open(p)}>{p.name}</button> : <strong>{p.name}</strong>}
        <span className="app-cell-sub">{[p.sku, p.abc && 'Група '+p.abc].filter(Boolean).join(' · ')}</span>
        {p.cost != null && <span className="app-cell-sub">Собівартість {formatPrice(p.cost)}</span>}
        {!!p.purchaseSources?.length && <details className="dash-cost-sources"><summary>За прибутковими накладними · {p.purchaseSources.length}</summary>
          {p.purchaseSources.map(s => <DocumentLink key={s.id} id={s.id}>{s.day} · № {s.number || 'без номера'}</DocumentLink>)}
        </details>}
        {p.profit == null && p.lines != null && <span className="app-cell-sub">
          Бракує собівартості · рядків {formatAmount(p.lines - p.costedLines)} із {formatAmount(p.lines)}.
          {p.costedLines > 0 && <> Прибуток лише за оціненими рядками {formatPrice(p.coveredNet - p.coveredCost)}.</>}
        </span>}
      </div><div className="dash-rank-side">
        {p.profit != null && <><b className="app-money" data-loss={p.profit < 0 || undefined}>{formatPrice(p.profit)}</b>
          <span className="app-cell-sub">{p.purchaseSources?.length ? 'Розрах. прибуток' : 'Валовий прибуток'} · маржа {share(p.margin)}</span></>}
        <span className={p.profit == null ? 'app-money' : 'app-cell-sub'}>Виручка {formatPrice(p.net)}</span>
        <span className="app-cell-sub">{share(p.share)} обороту</span></div>
    </li>)}</ol> : <p className="dash-rank-empty">Товарів за цими умовами немає.</p>}
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
    {picked && <Group className="dash-product-tools" gap="sm"><strong>{picked.name}</strong><Button size="xs" variant="default" onClick={clear}>Усі товари</Button></Group>}
    {!picked && <div className="dash-product-tools">
      <TextInput size="xs" aria-label="Пошук у звіті про прибуток" placeholder="Назва або код" maxLength={160} value={search}
        onChange={e => {setSearch(e.currentTarget.value); setPage(1)}} />
      <Select size="xs" aria-label="Сортування товарів у звіті" allowDeselect={false} value={sort}
        data={[{value:'profit',label:'Найбільший прибуток'}, {value:'lowest',label:'Найменший прибуток'},
          {value:'margin',label:'Найвища маржа'}, {value:'sales',label:'Найбільші продажі'}]}
        onChange={v => {setSort(v ?? 'profit'); setPage(1)}} />
    </div>}
    {query.status !== 'ready' ? <PageState kind={query.status} onRetry={query.reload} /> :
      !report?.available ? <p className="dash-rank-empty">У прод-БД поки немає зведеного звіту DNTrade про валовий прибуток.</p> : <>
        <p className="dash-report-note"><b>Звіт DNTrade · {dateRange(report.start,report.through)}</b><br />
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
