import { Button, Loader, SegmentedControl } from '@mantine/core'
import { IconArrowUpRight, IconCalendarStats, IconChartBar, IconChartLine, IconCheckbox, IconCoins, IconFileInvoice, IconListCheck, IconRefresh, IconTable } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { ReportYears } from './ReportYears'
import { readBusiness } from '../api/businessAnalytics'
import { MetricLabel } from '@/shared/ui/MetricCard'
import './annual-invoices.css'
import { AnalyticsChart } from './AnalyticsChart'
import { formatValue } from './BusinessForecast'

type Period = {
  documents: number
  lineDocuments: number
  discrepancies: number
  sales: number | null
  returns: number | null
  net: number | null
  lineNet: number | null
  difference: number | null
  cash: number | null
  cashDocuments: number
  cashDiscrepancies: number
  documentNet: number | null
  documentLineNet: number | null
}
type Annual = {
  year: number
  total: Period
  months: Period[]
  issues: { id: string; number: string; day: string; header: number | null; lines: number | null; inRegister: boolean; reason: string }[]
}
const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']


const chartSeries = [
  { value: 'documentNet', label: 'Чистий оборот' },
  { value: 'sales', label: 'Видаткові накладні' },
  { value: 'cash', label: 'Касові продажі' },
  { value: 'returns', label: 'Повернення' },
] as const
const columns = ['Період', 'Документів', 'Видаткові, грн', 'Чеки, грн', 'Повернення, грн', 'Чистий оборот, грн', 'За рядками, грн', 'Різниця, грн', 'Документів із розбіжністю']

function PeriodRow({ name, period }: { name: string; period: Period }) {
  const difference = period.documentNet == null || period.documentLineNet == null ? null : period.documentLineNet - period.documentNet
  return <tr>
    <th scope="row">{name}</th>
    {[period.documents + period.cashDocuments, period.sales, period.cash, period.returns, period.documentNet, period.documentLineNet,
      difference, period.discrepancies + period.cashDiscrepancies].map((value, i) => <td key={columns[i + 1]}>{formatValue(value)}</td>)}
  </tr>
}

export function AnnualInvoices() {
  return <ReportYears report="invoices">{(year, years) => <InvoiceReport year={year} years={years} />}</ReportYears>
}

function InvoiceReport({ year, years }: { year: number; years: number[] }) {
  const [, setParams] = useSearchParams()
  const [series, setSeries] = useState<(typeof chartSeries)[number]['value']>('documentNet')
  const result = useApiQuery('invoices-' + year, () => readBusiness<Annual>('documents', 'year=' + year))
  const failed = result.status === 'error' || result.status === 'forbidden'
  const report = failed ? undefined : result.data
  const total = report?.total
  const count = total ? total.documents + total.cashDocuments : 0
  const issues = total ? total.discrepancies + total.cashDiscrepancies : 0
  const empty = total && !count && !total.lineDocuments

  return (
    <div className="annual-invoices">
      <section className="pa-card annual-toolbar" aria-labelledby="annual-title">
        <header>
          <h2 id="annual-title"><MetricLabel icon={IconFileInvoice}>Оборот за документами продажу</MetricLabel></h2>
          <div className="annual-links">
            <Button component={Link} to={`?tab=assortment&from=${year}-01-01&to=${year}-12-31`} variant="default" size="xs" rightSection={<IconArrowUpRight size={14} />}>Аналіз товарів</Button>
            <Button component={Link} to="?tab=turnover-forecast" variant="default" size="xs" rightSection={<IconArrowUpRight size={14} />}>Прогноз обороту</Button>
          </div>
        </header>
        <div className="annual-controls">
          <label>Рік <select value={year} onChange={(event) => setParams({ tab: 'invoices', year: event.currentTarget.value })}>
            {years.map(value => <option key={value}>{value}</option>)}
          </select></label>
          <Button variant="default" leftSection={<IconRefresh size={15} />} disabled={result.isFetching} onClick={result.reload}>Звірити ще раз</Button>
        </div>
        <p className="annual-status" role={failed ? 'alert' : 'status'}>
          {result.isFetching ? <><Loader size={14} />Звіряємо документи за {year} рік…</> :
            failed ? (result.problem?.title ?? 'Не вдалося прочитати накладні.') :
            empty ? 'За цей рік проведених документів продажу не знайдено.' :
            issues ? `Документів для перевірки — ${formatValue(issues)}. У звіті наведено відомі суми.` :
            <><IconCheckbox size={16} />Суми документів збігаються з товарними рядками.</>}
        </p>
      </section>
      {report && total && !empty && <>
        <div className="ba-overview-metrics annual-metrics">
          <div className="pa-card"><MetricLabel icon={IconCoins}>Чистий оборот</MetricLabel><strong>{formatValue(total.documentNet)}{total.documentNet != null && <small>₴</small>}</strong></div>
          <div className="pa-card"><MetricLabel icon={IconCalendarStats}>Документів за рік</MetricLabel><strong>{formatValue(count)}</strong></div>
          <div className="pa-card"><MetricLabel icon={IconListCheck}>Із розбіжностями</MetricLabel><strong>{formatValue(issues)}</strong></div>
        </div>
        <section className="pa-card annual-chart">
          <header><h3><MetricLabel icon={IconChartLine}>Оборот за місяцями</MetricLabel></h3>
            <SegmentedControl aria-label="Показник графіка" value={series} onChange={setSeries} data={[...chartSeries]} />
          </header>
          <AnalyticsChart label="Оборот за документами, грн" variant="bars" format={formatValue}
            points={report.months.map((period, i) => ({ axisLabel: months[i], label: months[i] + ' ' + year, value: period[series] }))} />
        </section>
        <section className="pa-card">
          <header><h3><MetricLabel icon={IconTable}>Звірка за місяцями</MetricLabel></h3>
            <details className="annual-method"><summary>Як рахуємо</summary><p>Суми у гривні звіряються з товарними рядками. Чек, пов’язаний із проведеною видатковою накладною, враховується один раз. Повернення покупців зменшують оборот.</p></details>
          </header>
          <div className="annual-scroll" role="region" aria-label="Звірка за місяцями" tabIndex={0}><table>
            <thead><tr>{columns.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{report.months.map((period, i) => <PeriodRow key={i} period={period} name={months[i]} />)}</tbody>
            <tfoot><PeriodRow period={total} name="За рік" /></tfoot>
          </table></div>
        </section>
        {report.issues.length > 0 && <section className="pa-card">
          <header><h3><MetricLabel icon={IconChartBar}>Документи для перевірки</MetricLabel></h3><span>Показано {formatValue(report.issues.length)}</span></header>
          <ul className="annual-issues">{report.issues.map(item => <li key={item.id}>
            <div>{item.inRegister ? <Button component={Link} to={'/accounting/documents/' + encodeURIComponent(item.id)} size="xs" variant="default" rightSection={<IconArrowUpRight size={14} />}>{item.number}</Button> : <strong>{item.number}</strong>}
              <time dateTime={item.day}>{item.day}</time></div>
            <div><span>У реєстрі <b>{formatValue(item.header)} грн</b></span><span>За рядками <b>{formatValue(item.lines)} грн</b></span></div>
            <p>{item.reason}</p>
          </li>)}</ul>
        </section>}
      </>}
    </div>
  )
}
