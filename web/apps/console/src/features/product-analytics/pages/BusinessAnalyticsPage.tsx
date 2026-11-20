import { Button, SegmentedControl } from '@mantine/core'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { kyivDay } from '@/shared/lib/kyivTime'
import { PageHeader } from '@/shared/ui/PageHeader'
import { AnalyticsChart } from '../components/AnalyticsChart'
import { AnalyticsCard } from '../components/AnalyticsCard'
import { AnnualInvoices } from '../components/AnnualInvoices'
import { TurnoverForecast } from '../components/TurnoverForecast'
import { BuyerMarkets } from '../components/BuyerMarkets'
import { ForecastDetail, formatValue as fmt } from '../components/BusinessForecast'
import {
  readBusiness,
  writeBusiness,
  type BusinessReport,
  type DocumentRow,
  type Paged,
  type Projection,
  type Run,
  type Series,
} from '../api/businessAnalytics'
import './product-analytics.css'
import './business-analytics.css'

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
    <div className="ba-controls">
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
const seriesKey = (r: Series) => JSON.stringify([r.kind, r.product, r.category, r.store, r.org, r.unit])
const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']
const runLabel: Record<string, string> = {
  waiting: 'Очікує звірки',
  queued: 'У черзі',
  running: 'Триває звірка',
  ready: 'Звірено',
  error: 'Помилка звірки',
}

export function BusinessAnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState('')
  const [metric, setMetric] = useState<'net' | 'profit'>('net')
  const [seasonMetric, setSeasonMetric] = useState<'months' | 'indices'>('months')
  const [showDocs, setShowDocs] = useState(false)
  const [docPage, setDocPage] = useState(1)
  const { can } = usePermissions()
  const tab = params.get('tab') ?? 'overview'
  const usesReport = tab !== 'invoices' && tab !== 'turnover-forecast' && tab !== 'markets'
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
    const p = new URLSearchParams(params)
    if (!('page' in changes)) p.delete('page')
    if (tab === 'markets' && changes.tab && changes.tab !== tab) {
      for (const name of ['region', 'source', 'metric']) p.delete(name)
      if (changes.tab !== 'invoices') p.delete('year')
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value) p.set(key, value)
      else p.delete(key)
    }
    setParams(p)
    setDocPage(1)
    setSelected('')
  }
  const r = report.data
  const f = forecast.data
  const view = tab === 'forecast' ? f : r
  const query = tab === 'forecast' ? forecast : report
  const label = (key: 'store' | 'org' | 'category', id: string) =>
    view?.options?.[key].find((x) => x.value === id)?.label ?? id
  const changePage = (n: number) => update({ page: String(n) })
  const active = f?.rows.find((row) => seriesKey(row) === selected) ?? f?.rows.find(row => row.weeks.length) ?? f?.rows[0]
  const title = 'Бізнес-аналітика'
  const yearValue =
    r &&
    r.start.endsWith('-01-01') &&
    (r.end.endsWith('-12-31') || r.end === r.asOf) &&
    r.start.slice(0, 4) === r.end.slice(0, 4)
      ? r.start.slice(0, 4)
      : ''
  return (
    <>
      <PageHeader title={title} heading={<h1>{title}</h1>} />
      <div className="pa-page ba-page">
        <div className="pa-report">
          <div className="ba-controls">
            <SegmentedControl
              aria-label="Розділ аналітики"
              value={tab}
              onChange={(value) => update({ tab: value, horizon: '' })}
              data={[
                { value: 'overview', label: 'Оборот і прибуток' },
                ...(can(PermissionKeys.Accounting.View) ? [{ value: 'invoices', label: 'Звірка накладних' }] : []),
                ...(can(PermissionKeys.Accounting.View) ? [{ value: 'markets', label: 'Контрагенти й карта' }] : []),
                { value: 'assortment', label: 'Товари й сезонність' },
                { value: 'turnover-forecast', label: 'Прогноз обороту' },
                { value: 'forecast', label: 'Попит і закупівлі' },
              ]}
            />
            {usesReport && <Button
              variant="default"
              disabled={status.data?.state === 'running' || status.data?.state === 'queued'}
              onClick={async () => {
                try {
                  await writeBusiness('refresh')
                  setMessage('Запит на звірку прийнято')
                  reloadStatus()
                  if (tab === 'forecast') forecast.reload()
                  else report.reload()
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : 'Помилка оновлення')
                }
              }}
            >
              Звірити з виробничою БД
            </Button>}
          </div>
          {tab === 'invoices' && (can(PermissionKeys.Accounting.View)
            ? <AnnualInvoices /> : <p>Для звірки потрібен доступ до реєстру накладних.</p>)}
          {tab === 'turnover-forecast' && <TurnoverForecast />}
          {tab === 'markets' && (can(PermissionKeys.Accounting.View)
            ? <BuyerMarkets /> : <p>Для перегляду географії та продажів контрагентів потрібен доступ до обліку.</p>)}
          {usesReport && <p role="status">
            {status.data
              ? [
                  runLabel[status.data.state],
                  status.data.updated &&
                    new Date(status.data.updated).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
                  status.data.error,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : ''}{' '}
            {message}
          </p>}
          {!view && usesReport && (
            <p role="status">
              {query.status === 'loading'
                ? (tab === 'forecast' ? 'Навчаємо моделі за виробничими документами…' : 'Завантаження аналітики…')
                : (query.problem?.title ?? 'Не вдалося завантажити виробничий звіт')}
            </p>
          )}
          {view && usesReport && (
            <>
              <div className="pa-filters ba-controls">
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
                {tab !== 'overview' && (
                  <label>
                    Пошук товару
                    <input
                      value={params.get('search') ?? ''}
                      maxLength={120}
                      onChange={(e) => update({ search: e.target.value })}
                    />
                  </label>
                )}
                {params.get('product') && (
                  <Button variant="default" onClick={() => update({ product: '' })}>
                    Скинути вибір товару
                  </Button>
                )}
              </div>
              {tab === 'overview' && r && (
                <>
                  <div className="ba-kpis">
                    {[
                      ['Продажі', fmt(r.summary.gross) + ' грн'],
                      ['Повернення', fmt(r.summary.returns) + ' грн'],
                      ['Чистий оборот', fmt(r.summary.net) + ' грн'],
                      ['Валовий прибуток за відомою собівартістю', fmt(r.summary.profit) + ' грн'],
                      [
                        'Частка суми з відомою собівартістю',
                        fmt(r.summary.coverage == null ? null : r.summary.coverage * 100) + '%',
                      ],
                    ].map(([h, v]) => (
                      <div className="pa-card" key={h}>
                        <span>{h}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                  <AnalyticsCard
                    title="Оборот і прибуток за місяцями"
                    description="Зелений стовпчик показує вибраний період, сірий — ті самі дати попереднього року. Суми у гривнях."
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
                    <Grid headings={['Місяць', 'Оборот, грн', 'Рік тому, грн', 'Зміна, грн', 'Валовий прибуток, грн']}>
                      {r.months.map((m) => (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td>{fmt(m.current?.net)}</td>
                          <td>{fmt(m.previous?.net)}</td>
                          <td>{fmt(m.current && m.previous ? m.current.net - m.previous.net : null)}</td>
                          <td>{fmt(m.current?.profit)}</td>
                        </tr>
                      ))}
                    </Grid>
                  </AnalyticsCard>
                  <div className="ba-pair">
                    {(['category', 'store'] as const).map((k, i) => (
                      <AnalyticsCard key={k} title={i ? 'Оборот за складами' : 'Оборот за категоріями'}>
                        <Grid headings={[i ? 'Склад' : 'Категорія', 'Оборот, грн', 'Документи']}>
                          {r.contributions[k].map((v) => (
                            <tr key={v.id}>
                              <td>
                                <button onClick={() => update({ [k]: v.id })}>{label(k, v.id)}</button>
                              </td>
                              <td>{fmt(v.net)}</td>
                              <td>{v.documents}</td>
                            </tr>
                          ))}
                        </Grid>
                      </AnalyticsCard>
                    ))}
                  </div>
                  <AnalyticsCard
                    title="Історія та повнота документів"
                    description="Кількість місяців із документами за всю історію вибраних товарів і складів. Пропуски в завантаженні можуть впливати на оборот та прогноз."
                  >
                    <Grid headings={['Рік', 'Склад', 'Місяці з даними', 'Документи', 'З розбіжностями', 'Оборот, грн']}>
                      {r.coverage.map((x) => (
                        <tr key={x.year + x.store}>
                          <td>{x.year}</td>
                          <td>{label('store', x.store)}</td>
                          <td>{x.months} / 12</td>
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
              {tab === 'assortment' && r && (
                <>
                  <AnalyticsCard
                    title="Сезонність за категоріями"
                    description={
                      seasonMetric === 'months'
                        ? 'Чистий оборот у гривнях за календарним місяцем у вибраному періоді.'
                        : '100 відповідає середньому місяцю року. Індекс охоплює закриті роки до кінця вибраного періоду, щонайменше два роки з документами в кожному місяці.'
                    }
                  >
                    <SegmentedControl
                      aria-label="Показник сезонності"
                      value={seasonMetric}
                      onChange={(v) => setSeasonMetric(v === 'indices' ? 'indices' : 'months')}
                      data={[
                        { value: 'months', label: 'Оборот, грн' },
                        { value: 'indices', label: 'Сезонний індекс' },
                      ]}
                    />
                    <Grid headings={['Категорія', ...months]}>
                      {r.heatmap.map((row) => {
                        const values = row[seasonMetric]
                        const peak = Math.max(1, ...values.map((v) => Math.abs(v ?? 0)))
                        return (
                          <tr key={row.category}>
                            <td>
                              {label('category', row.category)}
                              {seasonMetric === 'indices' && ' · років ' + row.years}
                            </td>
                            {values.map((v, i) => (
                              <td
                                key={i}
                                style={{
                                  backgroundColor:
                                    v == null
                                      ? undefined
                                      : 'rgba(23,128,90,' + (0.05 + (Math.abs(v) / peak) * 0.35) + ')',
                                }}
                              >
                                {fmt(v)}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </Grid>
                  </AnalyticsCard>
                  <AnalyticsCard title="Товари за чистим оборотом">
                    <Grid
                      headings={[
                        'Товар',
                        'Артикул',
                        'Одиниця',
                        'Продано',
                        'Повернено',
                        'Середня ціна, грн',
                        'Оборот, грн',
                        'Прибуток, грн',
                      ]}
                    >
                      {r.products.rows.map((p) => (
                        <tr key={p.id + p.unit}>
                          <td>
                            <button onClick={() => update({ product: p.id })}>{p.name}</button>
                          </td>
                          <td>{p.sku}</td>
                          <td>{p.unit || 'од. товару'}</td>
                          <td>{fmt(p.sold)}</td>
                          <td>{fmt(p.returned)}</td>
                          <td>{fmt(p.price)}</td>
                          <td>{fmt(p.net)}</td>
                          <td>{fmt(p.profit)}</td>
                        </tr>
                      ))}
                    </Grid>
                    {!r.products.total && <p>За цими фільтрами товарів немає.</p>}
                    <Pager {...r.products} change={changePage} />
                  </AnalyticsCard>
                </>
              )}
              {tab === 'forecast' && (
                <AnalyticsCard
                  title="Попит і потреба в закупівлі"
                  description={
                    'Факт до ' +
                    view.asOf +
                    '. Результати перевірено на послідовних історичних періодах. Межі показують історичний розкид помилки.'
                  }
                >
                  <SegmentedControl
                    aria-label="Горизонт прогнозу"
                    value={params.get('kind') ?? 'sku'}
                    onChange={(v) => update({ kind: v, product: '' })}
                    data={[
                      { value: 'sku', label: 'Товари · 4 тижні' },
                      { value: 'category', label: 'Категорії · 13 тижнів' },
                    ]}
                  />
                  {f ? (
                    <>
                      {f.coverage && <p>Рядів із прогнозом · {fmt(f.coverage.ready)} з {fmt(f.total)}.
                        {' '}Навчену регресію обрано для {fmt(f.coverage.regression)}, модель нерегулярного попиту для {fmt(f.coverage.intermittent)}.</p>}
                      <Grid
                        headings={['Товар або категорія', 'Організація', 'Склад', 'Одиниця', 'Прогноз', 'До закупівлі', 'Підстава']}
                      >
                        {f.rows.map((m) => (
                          <tr key={seriesKey(m)}>
                            <td>
                              <button onClick={() => setSelected(seriesKey(m))}>{m.name}</button>
                            </td>
                            <td>{label('org', m.org)}</td>
                            <td>{label('store', m.store)}</td>
                            <td>{m.unit || 'од. товару'}</td>
                            <td>{fmt(m.weeks.length ? m.weeks.reduce((a, w) => a + w.value, 0) : null)}</td>
                            <td>{fmt(m.purchase?.order)}</td>
                            <td>{m.reason ?? m.purchase?.reason ?? 'Розраховано'}</td>
                          </tr>
                        ))}
                      </Grid>
                      {!f.total && <p>Немає рядів для прогнозу за цими фільтрами.</p>}
                      <Pager {...f} change={changePage} />
                      {active && (
                        <ForecastDetail
                          key={seriesKey(active)}
                          row={active}
                          start={f.start}
                          edit={can(PermissionKeys.Accounting.Edit) && status.data?.policiesWritable === true}
                          saved={forecast.reload}
                        />
                      )}
                      {active?.kind === 'sku' && active.reason && (
                        <Button
                          variant="default"
                          onClick={() =>
                            update({
                              kind: 'category',
                              category: active.category,
                              org: active.org,
                              store: active.store,
                              product: '',
                              search: '',
                            })
                          }
                        >
                          Переглянути прогноз категорії на цьому складі
                        </Button>
                      )}
                    </>
                  ) : (
                    <p>{forecast.problem?.title ?? 'Завантаження прогнозу…'}</p>
                  )}
                </AnalyticsCard>
              )}
              {tab !== 'forecast' && can(PermissionKeys.Accounting.View) && (
                <AnalyticsCard title="Звірка з документами">
                  <Button variant="default" onClick={() => setShowDocs(!showDocs)}>
                    {showDocs ? 'Згорнути документи' : 'Показати документи'}
                  </Button>
                  {showDocs &&
                    (docs.data ? (
                      <>
                        <Grid
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
                                  <Link to={'/accounting/documents/' + d.id}>{d.number}</Link>
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
                        </Grid>
                        <Pager {...docs.data} change={setDocPage} />
                      </>
                    ) : (
                      <p>{docs.problem?.title ?? 'Завантаження документів…'}</p>
                    ))}
                </AnalyticsCard>
              )}
            </>
          )}
          {!view && usesReport && query.status !== 'loading' && (
            <Button
              variant="default"
              onClick={() => {
                query.reload()
                reloadStatus()
              }}
            >
              Повторити завантаження
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
