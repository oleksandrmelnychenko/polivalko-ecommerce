import { DocumentLink } from '@/shared/ui/DocumentLink'
import { useDebouncedCallback } from '@mantine/hooks'
import { Button, Loader, SegmentedControl } from '@mantine/core'
import { IconAdjustmentsHorizontal, IconBuildingWarehouse, IconCategory, IconChartLine, IconChartPie, IconCoins, IconFileInvoice, IconReceiptRefund, IconRefresh, IconReportMoney, IconWallet } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { kyivDay } from '@/shared/lib/kyivTime'
import { PageHeader } from '@/shared/ui/PageHeader'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { AnalyticsChart } from '../components/AnalyticsChart'
import { AnalyticsCard } from '../components/AnalyticsCard'
import { AssortmentReport } from '../components/AssortmentReport'
import { AnnualInvoices } from '../components/AnnualInvoices'
import { WinterSales } from '../components/WinterSales'
import { SalesOffers } from '../components/SalesOffers'
import { TurnoverForecast } from '../components/TurnoverForecast'
import { BuyerMarkets } from '../components/BuyerMarkets'
import { DemandForecastReport } from '../components/DemandForecastReport'
import { formatValue as fmt } from '../components/BusinessForecast'
import {
  readBusiness,
  writeBusiness,
  type BusinessReport,
  type DocumentRow,
  type Paged,
  type Projection,
  type Run,
} from '../api/businessAnalytics'
import { nextReportParams } from '../lib/reportParams'
import './product-analytics.css'
import './business-analytics.css'

function ProductSearch({ value, onSearch, placeholder }: { value: string; onSearch: (value: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value)
  const [previous, setPrevious] = useState(value)
  const search = useDebouncedCallback(onSearch, 300)
  if (previous !== value) {
    setPrevious(value)
    setText(value)
  }
  return (
    <label>Пошук товару
      <input type="search" placeholder={placeholder} value={text} maxLength={120} onChange={(event) => {
        setText(event.currentTarget.value)
        search(event.currentTarget.value)
      }} onKeyDown={(event) => { if (event.key === 'Enter') search.flush() }} />
    </label>
  )
}

function Grid({ headings, children }: { headings: string[]; children: ReactNode }) {
  return (
    <div className="ba-table">
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
function Pager({ total, page, change }: { total: number; page: number; change: (n: number) => void }) {
  return total > 40 || page > 1 ? (
    <div className="ba-controls ba-pager">
      <Button variant="default" disabled={page <= 1} onClick={() => change(page - 1)}>
        Назад
      </Button>
      <span>
        {page} / {Math.max(1, Math.ceil(total / 40))}
      </span>
      <Button variant="default" disabled={page * 40 >= total} onClick={() => change(page + 1)}>
        Далі
      </Button>
    </div>
  ) : null
}
const runLabel: Record<string, string> = {
  waiting: 'Очікує звірки',
  queued: 'У черзі',
  running: 'Триває звірка',
  ready: 'Звірено',
  error: 'Помилка звірки',
}

const kpiDefinitions = [
  { key: 'gross', title: 'Продажі', icon: IconWallet },
  { key: 'returns', title: 'Повернення', icon: IconReceiptRefund },
  { key: 'net', title: 'Чистий оборот', icon: IconCoins },
  { key: 'profit', title: 'Валовий прибуток за відомою собівартістю', icon: IconReportMoney },
  { key: 'coverage', title: 'Частка суми з відомою собівартістю', icon: IconChartPie },
] as const

export function BusinessAnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const [metric, setMetric] = useState<'net' | 'profit'>('net')
  const [showDocs, setShowDocs] = useState(false)
  const [docPage, setDocPage] = useState(1)
  const reportTabs = useRef<HTMLDivElement>(null)
  const { can } = usePermissions()
  const tab = params.get('tab') ?? 'overview'
  useEffect(() => {
    const nav = reportTabs.current
    if (!nav) return
    function revealActive() {
      const active = nav?.querySelector('label[data-active]')
      if (!nav || !active) return
      const strip = nav.getBoundingClientRect()
      const item = active.getBoundingClientRect()
      if (item.left < strip.left + 5) nav.scrollLeft += item.left - strip.left - 5
      else if (item.right > strip.right - 5) nav.scrollLeft += item.right - strip.right + 5
    }
    revealActive()
    const observer = new ResizeObserver(revealActive)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [tab])
  const usesReport = !['invoices', 'turnover-forecast', 'markets', 'winter', 'offers'].includes(tab)
  const period = new URLSearchParams(params)
  for (const name of ['tab', 'kind', 'page', 'year', 'horizon']) period.delete(name)
  const reportParams = new URLSearchParams(period)
  if (tab === 'assortment') reportParams.set('page', params.get('page') ?? '1')
  const forecastParams = new URLSearchParams(params)
  for (const name of ['tab', 'from', 'to']) forecastParams.delete(name)
  const docParams = new URLSearchParams(period)
  docParams.set('page', String(docPage))
  const status = useApiQuery('business-run', () => readBusiness<Run>('status'))
  // Hosted instances build the same business day at different wall-clock times.
  const updated = status.data?.policiesWritable ? status.data.updated ?? '' : kyivDay(new Date())
  const reportKey = reportParams.toString()
  const report = useApiQuery(reportKey + updated, () => readBusiness<BusinessReport>('report', reportKey), {
    keepPrevious: true,
    enabled: usesReport && tab !== 'forecast',
  })
  const forecastKey = forecastParams.toString()
  const forecast = useApiQuery(forecastKey + updated, () => readBusiness<Projection>('forecast', forecastKey), {
    enabled: tab === 'forecast',
    keepPrevious: true,
  })
  const docKey = docParams.toString()
  const docs = useApiQuery(docKey + updated, () => readBusiness<Paged<DocumentRow>>('documents', docKey), {
    enabled: showDocs && can(PermissionKeys.Accounting.View) && tab !== 'forecast' && usesReport,
  })
  const reloadStatus = status.reload
  useEffect(() => {
    const interval = setInterval(
      reloadStatus,
      status.data?.state === 'running' || status.data?.state === 'queued' ? 3000 : 30000,
    )
    return () => clearInterval(interval)
  }, [reloadStatus, status.data?.state])

  function update(changes: Record<string, string>) {
    setParams(nextReportParams(params, tab, changes))
    setDocPage(1)
  }
  const assortment = tab === 'assortment'
  const reportFailed = report.status === 'error' || report.status === 'forbidden'
  const r = reportFailed ? undefined : report.data
  const f = forecast.data
  const view = tab === 'forecast' ? f : r
  const query = tab === 'forecast' ? forecast : report
  const label = (key: 'store' | 'org' | 'category', id: string) =>
    view?.options?.[key].find((x) => x.value === id)?.label ?? id
  const changePage = (n: number) => update({ page: String(n) })
  const title = 'Бізнес-аналітика'
  async function refresh() {
    try {
      await writeBusiness('refresh')
      setMessage('Запит на звірку прийнято')
      reloadStatus()
      if (tab === 'forecast') forecast.reload()
      else report.reload()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Помилка оновлення')
    }
  }
  const yearValue =
    r &&
    r.start.endsWith('-01-01') &&
    (r.end.endsWith('-12-31') || r.end === r.asOf) &&
    r.start.slice(0, 4) === r.end.slice(0, 4)
      ? r.start.slice(0, 4)
      : ''
  const runStatus = (status.data || message) && (
    <p role="status" className="ba-run-state" data-state={status.data?.state}>
      {[
        status.data && runLabel[status.data.state],
        status.data?.updated && new Date(status.data.updated).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
        status.data?.error,
        message,
      ].filter(Boolean).join(' · ')}
    </p>
  )
  return (
    <>
      <PageHeader title={title} actions={usesReport && (
        <Button radius="xl" variant="default" leftSection={<IconRefresh size={16} stroke={1.7} />}
          disabled={status.data?.state === 'running' || status.data?.state === 'queued'} onClick={refresh}>
          Звірити з виробничою БД
        </Button>
      )} />
      <div className="pa-page ba-page" data-report-content={usesReport || undefined} data-assortment={assortment || undefined}>
        <div className="pa-report">
          <div className="ba-report-tabs" ref={reportTabs}>
            <SegmentedControl
              aria-label="Розділ аналітики"
              className="page-mode-switch"
              value={tab}
              onChange={(value) => update({ tab: value, horizon: '' })}
              data={[
                { value: 'overview', label: 'Оборот і прибуток' },
                ...(can(PermissionKeys.Accounting.View) ? [{ value: 'invoices', label: 'Звірка накладних' }] : []),
                ...(can(PermissionKeys.Accounting.View) ? [{ value: 'markets', label: 'Контрагенти й карта' }] : []),
                ...(can(PermissionKeys.Accounting.View) ? [{ value: 'winter', label: 'Зимові продажі' },
                  { value: 'offers', label: 'Пропозиції' }] : []),
                { value: 'assortment', label: 'Товари й сезонність' },
                { value: 'turnover-forecast', label: 'Прогноз обороту' },
                { value: 'forecast', label: 'Попит і закупівлі' },
              ]}
            />
          </div>
          {tab === 'invoices' && (can(PermissionKeys.Accounting.View)
            ? <AnnualInvoices /> : <p>Для звірки потрібен доступ до реєстру накладних.</p>)}
          {tab === 'winter' && (can(PermissionKeys.Accounting.View) ? <WinterSales /> : <p>Потрібен доступ до обліку.</p>)}
          {tab === 'offers' && (can(PermissionKeys.Accounting.View) ? <SalesOffers /> : <p>Потрібен доступ до обліку.</p>)}
          {tab === 'turnover-forecast' && <TurnoverForecast />}
          {tab === 'markets' && (can(PermissionKeys.Accounting.View)
            ? <BuyerMarkets /> : <p>Для перегляду географії та продажів контрагентів потрібен доступ до обліку.</p>)}
          {usesReport && !assortment && runStatus}
          {!view && usesReport && (
            <section className="pa-card ba-report-feedback">
              <div role={query.isFetching ? 'status' : 'alert'}>
                {query.isFetching ? <><Loader size={16} />{tab === 'forecast' ? 'Навчаємо моделі за виробничими документами…' : 'Завантаження аналітики…'}</>
                  : <MetricLabel icon={IconFileInvoice}>{query.problem?.title ?? 'Не вдалося завантажити виробничий звіт'}</MetricLabel>}
              </div>
              {!query.isFetching && <Button variant="default" size="xs" leftSection={<IconRefresh size={15} />}
                onClick={() => { query.reload(); reloadStatus() }}>Повторити завантаження</Button>}
            </section>
          )}
          {view && usesReport && (
            <>
              <div className="pa-filters ba-controls">
                {assortment && <div className="assortment-filter-head">
                  <MetricLabel icon={IconAdjustmentsHorizontal}>Фільтри звіту</MetricLabel>
                  {runStatus}
                  {['from', 'to', 'org', 'store', 'category', 'product', 'search'].some(key => params.has(key)) &&
                    <Button size="xs" variant="default" onClick={() => update({ from: '', to: '', org: '', store: '', category: '', product: '', search: '' })}>Скинути фільтри</Button>}
                </div>}
                {tab !== 'forecast' && r && (
                  <>
                    <label>
                      Рік
                      <select
                        value={yearValue}
                        onChange={(e) => {
                          const y = e.target.value
                          if (y === 'all') update({ from: r.options.years.at(-1) + '-01-01', to: r.asOf })
                          else if (y)
                            update({ from: y + '-01-01', to: y === r.asOf.slice(0, 4) ? r.asOf : y + '-12-31' })
                        }}
                      >
                        <option value="">Вибраний період</option>
                        {r.options.years.length > 0 && <option value="all">Уся історія</option>}
                        {r.options.years.map((y) => (
                          <option key={y}>{y}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Від
                      <input
                        type="date"
                        value={params.get('from') ?? r.start}
                        max={r.end}
                        onChange={(e) => update({ from: e.target.value })}
                      />
                    </label>
                    <label>
                      До
                      <input
                        type="date"
                        value={params.get('to') ?? r.end}
                        min={r.start}
                        max={r.asOf}
                        onChange={(e) => update({ to: e.target.value })}
                      />
                    </label>
                  </>
                )}
                {(['org', 'store', 'category'] as const).map((k, i) => (
                  <label key={k}>
                    {['Організація', 'Склад', 'Категорія'][i]}
                    <select value={params.get(k) ?? ''} onChange={(e) => update({ [k]: e.target.value, product: '' })}>
                      <option value="">Усі</option>
                      {view.options?.[k].map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {tab !== 'overview' && !assortment && (
                  <ProductSearch key={tab} value={params.get('search') ?? ''} onSearch={(search) => update({ search })} />
                )}
                {params.get('product') && (
                  <Button variant="default" onClick={() => update({ product: '' })}>
                    Скинути вибір товару
                  </Button>
                )}
              </div>
              {tab === 'overview' && r && (
                <>
                  {/* The previous figures stay on screen while a new selection loads; say that they are being replaced. */}
                  {report.isFetching && <section className="pa-card ba-report-feedback">
                    <div role="status"><Loader size={16} />Оновлюємо показники за новим вибором…</div></section>}
                  <div className="ba-kpis ba-overview-metrics">
                    {kpiDefinitions.map(({ key, title: label, icon }) => {
                      const value = r.summary[key]
                      return (
                        <div className="pa-card" key={key}>
                          <MetricLabel icon={icon}>{label}</MetricLabel>
                          <strong>{fmt(key === 'coverage' && value != null ? value * 100 : value)}
                            {value != null && <small>{key === 'coverage' ? '%' : '₴'}</small>}
                          </strong>
                        </div>
                      )
                    })}
                  </div>
                  <AnalyticsCard
                    title={<MetricLabel icon={IconChartLine}>Оборот і прибуток за місяцями</MetricLabel>}
                    description="Зелений стовпчик показує вибраний період, сірий — ті самі дати попереднього року. Суми у гривнях. Прибуток пораховано лише за рядками з відомою собівартістю; яку частку суми вони становлять у кожному місяці, видно в таблиці."
                  >
                    <SegmentedControl
                      aria-label="Показник графіка"
                      value={metric}
                      data={[
                        { value: 'net', label: 'Чистий оборот' },
                        { value: 'profit', label: 'Валовий прибуток' },
                      ]}
                      onChange={(v) => setMetric(v === 'profit' ? 'profit' : 'net')}
                    />
                    <AnalyticsChart
                      label="Порівняння з попереднім роком у гривнях"
                      variant="bars"
                      format={fmt}
                      points={r.months.map((m) => ({
                        label: m.month,
                        axisLabel: m.month,
                        value: m.current?.[metric] ?? null,
                        previous: m.previous?.[metric] ?? null,
                      }))}
                    />
                    <Grid headings={['Місяць', 'Оборот, грн', 'Рік тому, грн', 'Зміна, грн', 'Валовий прибуток за відомою собівартістю, грн', 'Собівартість відома, % суми']}>
                      {r.months.map((m) => (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td>{fmt(m.current?.net)}</td>
                          <td>{fmt(m.previous?.net)}</td>
                          <td>{fmt(m.current && m.previous ? m.current.net - m.previous.net : null)}</td>
                          <td>{fmt(m.current?.profit)}</td>
                          <td>{fmt(m.current?.coverage == null ? null : m.current.coverage * 100)}</td>
                        </tr>
                      ))}
                    </Grid>
                  </AnalyticsCard>
                  <div className="ba-pair">
                    {(['category', 'store'] as const).map((k, i) => (
                      <AnalyticsCard key={k} title={<MetricLabel icon={i ? IconBuildingWarehouse : IconCategory}>{i ? 'Оборот за складами' : 'Оборот за категоріями'}</MetricLabel>}>
                        {r.contributions[k].length === 0 ? <p role="status">За вибраний період продажів немає.</p> : <Grid headings={[i ? 'Склад' : 'Категорія', 'Оборот, грн', 'Документи']}>
                          {r.contributions[k].map((v) => (
                            <tr key={v.id}>
                              <td>
                                <button onClick={() => update({ [k]: v.id })}>{label(k, v.id)}</button>
                              </td>
                              <td>{fmt(v.net)}</td>
                              <td>{v.documents}</td>
                            </tr>
                          ))}
                        </Grid>}
                      </AnalyticsCard>
                    ))}
                  </div>
                  <AnalyticsCard
                    title={<MetricLabel icon={IconFileInvoice}>Історія та повнота документів</MetricLabel>}
                    description="Кількість місяців із документами за всю історію вибраних товарів і складів. Пропуски в завантаженні можуть впливати на оборот та прогноз."
                  >
                    <Grid headings={['Рік', 'Склад', 'Місяці з даними', 'Документи', 'З розбіжностями', 'Оборот, грн']}>
                      {r.coverage.map((x) => (
                        <tr key={x.year + x.store}>
                          <td>{x.year}</td>
                          <td>{label('store', x.store)}</td>
                          <td>{x.months} / {x.expected ?? 12}</td>
                          <td>{x.documents}</td>
                          <td>{x.mismatches}</td>
                          <td>{fmt(x.net)}</td>
                        </tr>
                      ))}
                    </Grid>
                    <p>
                      За всю базу · пов’язані чеки {r.diagnostics.linkedReceipts ?? 0} · збіги з інтернет-магазином{' '}
                      {r.diagnostics.linkedWebLines ?? 0} · непідтверджені документи{' '}
                      {r.diagnostics.unverifiedDocuments ?? 0} · некоректні рядки {r.diagnostics.invalidLines ?? 0}
                    </p>
                  </AnalyticsCard>
                </>
              )}
              {assortment && r && (
                <AssortmentReport report={r} loading={report.isFetching} selectedProduct={params.get('product')}
                  selectProduct={product => update({ product })} pager={<Pager {...r.products} change={changePage} />}
                  search={<ProductSearch value={params.get('search') ?? ''} onSearch={search => update({ search })} placeholder="Назва або артикул…" />} />
              )}
              {tab === 'forecast' && f && (
                <DemandForecastReport
                  forecast={f}
                  kind={params.get('kind') ?? 'sku'}
                  loading={forecast.isFetching}
                  error={forecast.status === 'error' || forecast.status === 'forbidden'}
                  reload={forecast.reload}
                  edit={can(PermissionKeys.Accounting.Edit) && status.data?.policiesWritable === true}
                  update={update}
                />
              )}
              {tab !== 'forecast' && can(PermissionKeys.Accounting.View) && (
                <AnalyticsCard title={<MetricLabel icon={IconFileInvoice}>Звірка з документами</MetricLabel>} actions={
                  <Button variant="default" aria-expanded={showDocs} onClick={() => setShowDocs(!showDocs)}>
                    {showDocs ? 'Згорнути документи' : 'Показати документи'}
                  </Button>
                }>
                  {showDocs &&
                    (docs.data ? (
                      <>
                        {!docs.data.rows.length && <p role="status">Документів за цими фільтрами немає.</p>}
                        {docs.data.rows.length > 0 && <Grid
                          headings={[
                            'Документ',
                            'Дата',
                            'Оборот вибраних позицій, грн',
                            'Сума документа, грн',
                            'Розбіжність усіх рядків, грн',
                          ]}
                        >
                          {docs.data.rows.map((d) => (
                            <tr key={d.id}>
                              <td>
                                {d.origin === 'accounting' ? (
                                  <DocumentLink id={d.id}>{d.number}</DocumentLink>
                                ) : (
                                  d.number
                                )}
                              </td>
                              <td>{d.day}</td>
                              <td>{fmt(d.selected)}</td>
                              <td>{fmt(d.recorded)}</td>
                              <td>{fmt(d.difference)}</td>
                            </tr>
                          ))}
                        </Grid>}
                        <Pager {...docs.data} change={setDocPage} />
                      </>
                    ) : (
                      docs.status === 'loading' ? <p role="status">Завантаження документів…</p> :
                        <p role="alert">{docs.problem?.title ?? 'Не вдалося завантажити документи.'}{' '}
                          <Button size="xs" variant="default" onClick={docs.reload}>Повторити</Button></p>
                    ))}
                </AnalyticsCard>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
