import { Button } from '@mantine/core'
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
}
type Annual = {
  year: number
  total: Period
  months: Period[]
  issues: { id: string; number: string; day: string; header: number | null; lines: number | null; inRegister: boolean }[]
}
const months = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру']

export function AnnualInvoices() {
  const [params, setParams] = useSearchParams()
  const last = Number(kyivDay(new Date()).slice(0, 4)) - 1
  const year = params.get('year') ?? String(last)
  const result = useApiQuery('invoices-' + year, () => readBusiness<Annual>('documents', 'year=' + encodeURIComponent(year)))
  const report = result.data
  return (
    <AnalyticsCard title="Оборот за видатковими накладними й поверненнями"
      description="Звірка охоплює видаткові накладні та всі повернення покупців у гривні. Касові продажі входять до загального огляду обороту.">
      <div className="ba-controls">
        <label>Рік <input type="number" min={1900} max={last} defaultValue={year} key={year}
          onBlur={e => {
            const value = e.currentTarget.valueAsNumber
            if (Number.isInteger(value) && value >= 1900 && value <= last) {
              setParams({ tab: 'invoices', year: String(value) })
            }
          }} /></label>
        <Button variant="default" onClick={result.reload} disabled={result.status === 'loading'}>Звірити ще раз</Button>
        <Link to={'?tab=overview&from=' + year + '-01-01&to=' + year + '-12-31'}>Оборот з урахуванням чеків</Link>
      </div>
      {result.status === 'error' || result.status === 'forbidden'
        ? <p role="alert">{result.problem?.title ?? 'Не вдалося прочитати накладні.'}</p>
        : !report && <p role="status">Читаємо накладні за {year} рік…</p>}
      {report && <>
        <p role="status">{!report.total.documents && !report.total.lineDocuments
          ? 'За цей рік проведених видаткових накладних і повернень не знайдено.'
          : report.total.discrepancies
            ? 'Потребують перевірки ' + formatValue(report.total.discrepancies) + ' документів. Нижче наведено відомі суми.'
            : 'Суми всіх відібраних документів збігаються з товарними рядками.'}</p>
        <AnalyticsChart label="Чистий оборот за накладними, грн" variant="bars" format={formatValue}
          points={report.months.map((m, i) => ({ axisLabel: months[i], label: months[i] + ' ' + year, value: m.net }))} />
        <div className="ba-table"><table>
          <thead><tr>{['Період', 'Документів', 'Продажі, грн', 'Повернення, грн', 'Чистий оборот, грн', 'За рядками, грн', 'Різниця, грн', 'Документів із розбіжністю'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{[...report.months, report.total].map((m, i) => <tr key={i}>
            <th>{months[i] ?? 'За рік'}</th><td>{formatValue(m.documents)}</td>
            <td>{formatValue(m.documents ? m.sales : null)}</td><td>{formatValue(m.documents ? m.returns : null)}</td>
            <td>{formatValue(m.net)}</td><td>{formatValue(m.lineNet)}</td>
            <td>{formatValue(m.difference)}</td><td>{formatValue(m.discrepancies)}</td>
          </tr>)}</tbody>
        </table></div>
        {report.issues.length > 0 && <><h3>Документи для перевірки · перші {report.issues.length}</h3>
          <ul>{report.issues.map(item => <li key={item.id}>
            {item.inRegister ? <Link to={'/accounting/documents/' + item.id}>{item.number}</Link> : item.number}
            {' · ' + item.day + ' · у реєстрі ' + formatValue(item.header) + ' грн · у рядках ' + formatValue(item.lines) + ' грн'}
          </li>)}</ul></>}
      </>}
    </AnalyticsCard>
  )
}
