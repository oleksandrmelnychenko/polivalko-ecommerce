import { Button, SegmentedControl } from '@mantine/core'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { kyivDay } from '@/shared/lib/kyivTime'
import { readBusiness } from '../api/businessAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
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

export function AnnualInvoices() {
  const [params, setParams] = useSearchParams()
  const [series, setSeries] = useState('all')
  const last = Number(kyivDay(new Date()).slice(0, 4)) - 1
  const year = params.get('year') ?? String(last)
  const result = useApiQuery('invoices-' + year, () => readBusiness<Annual>('documents', 'year=' + encodeURIComponent(year)))
  const report = result.data
  return (
    <AnalyticsCard title="Оборот за документами продажу"
      description="Суми у гривні звіряються з товарними рядками. Чек, пов’язаний із проведеною видатковою накладною, враховується один раз. Повернення покупців зменшують оборот.">
      <div className="ba-controls">
        <label>Рік <input type="number" min={1900} max={last} defaultValue={year} key={year}
          onBlur={e => {
            const value = e.currentTarget.valueAsNumber
            if (Number.isInteger(value) && value >= 1900 && value <= last) {
              setParams({ tab: 'invoices', year: String(value) })
            }
          }} /></label>
        <Button variant="default" onClick={result.reload} disabled={result.status === 'loading'}>Звірити ще раз</Button>
        <Link to={'?tab=overview&from=' + year + '-01-01&to=' + year + '-12-31'}>Перейти до аналізу товарів</Link>
        <Link to="?tab=turnover-forecast">Відкрити прогноз обороту</Link>
      </div>
      {result.status === 'error' || result.status === 'forbidden'
        ? <p role="alert">{result.problem?.title ?? 'Не вдалося прочитати накладні.'}</p>
        : !report && <p role="status">Читаємо накладні за {year} рік…</p>}
      {report && <>
        <p role="status">{!report.total.documents && !report.total.lineDocuments && !report.total.cashDocuments
          ? 'За цей рік проведених документів продажу не знайдено.'
          : report.total.discrepancies + report.total.cashDiscrepancies
            ? 'Потребують перевірки ' + formatValue(report.total.discrepancies + report.total.cashDiscrepancies) + ' документів. Нижче наведено відомі суми.'
            : 'Суми всіх відібраних документів збігаються з товарними рядками.'}</p>
        <SegmentedControl aria-label="Показник графіка" value={series} onChange={setSeries}
          data={[{ value: 'all', label: 'Чистий оборот' }, { value: 'sales', label: 'Видаткові накладні' },
            { value: 'cash', label: 'Касові продажі' }, { value: 'returns', label: 'Повернення' }]} />
        <AnalyticsChart label="Оборот за документами, грн" variant="bars" format={formatValue}
          points={report.months.map((m, i) => ({ axisLabel: months[i], label: months[i] + ' ' + year,
            value: series === 'sales' ? m.sales : series === 'cash' ? m.cash : series === 'returns' ? m.returns : m.documentNet }))} />
        <div className="ba-table"><table>
          <thead><tr>{['Період', 'Документів', 'Видаткові, грн', 'Чеки, грн', 'Повернення, грн', 'Чистий оборот, грн', 'За рядками, грн', 'Різниця, грн', 'Документів із розбіжністю'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{[...report.months, report.total].map((m, i) => <tr key={i}>
            <th>{months[i] ?? 'За рік'}</th><td>{formatValue(m.documents + m.cashDocuments)}</td>
            <td>{formatValue(m.sales)}</td><td>{formatValue(m.cash)}</td><td>{formatValue(m.returns)}</td>
            <td>{formatValue(m.documentNet)}</td><td>{formatValue(m.documentLineNet)}</td>
            <td>{formatValue(m.documentNet == null || m.documentLineNet == null ? null : m.documentLineNet - m.documentNet)}</td>
            <td>{formatValue(m.discrepancies + m.cashDiscrepancies)}</td>
          </tr>)}</tbody>
        </table></div>
        {report.issues.length > 0 && <><h3>Документи для перевірки · перші {report.issues.length}</h3>
          <ul>{report.issues.map(item => <li key={item.id}>
            {item.inRegister ? <Link to={'/accounting/documents/' + item.id}>{item.number}</Link> : item.number}
            {' · ' + item.day + ' · у реєстрі ' + formatValue(item.header) + ' грн · у рядках ' + formatValue(item.lines) + ' грн'}
            {' · ' + item.reason}
          </li>)}</ul></>}
      </>}
    </AnalyticsCard>
  )
}
