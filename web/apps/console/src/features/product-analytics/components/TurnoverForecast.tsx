import { Button, SegmentedControl } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { readBusiness } from '../api/businessAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { AnalyticsChart } from './AnalyticsChart'
import { formatValue } from './BusinessForecast'

type Model = 'recent' | 'season' | 'scaledSeason' | 'ridge'
type Point = { month: string; value: number }
type Forecast = {
  model: Model | null
  reason: string | null
  lastDocument: string | null
  trainingMonths: number
  staleMonths: number
  history: Point[]
  projection: (Point & { low: number | null; high: number | null })[]
  validation: (Point & { actual: number })[]
  comparisons: { model: Model; mae: number; origins: number; holdoutWape: number | null }[]
  wape: number | null
  baselineWape: number | null
  mae: number | null
}
const modelNames: Record<Model, string> = {
  recent: 'Середнє за три місяці', season: 'Той самий місяць торік', ridge: 'Навчена сезонна регресія',
  scaledSeason: 'Торішній сезон із поправкою на зміну обороту',
}
const months = new Intl.DateTimeFormat('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const label = (day: string) => months.format(new Date(day + 'T00:00:00Z'))
const money = (n: number) => formatValue(n) + ' грн'
const percent = (n: number | null) => n == null ? '—' : formatValue(n * 100) + '%'
const point = (p: Point) => ({ value: p.value, label: label(p.month), axisLabel: label(p.month) })

export function TurnoverForecast() {
  const [params, setParams] = useSearchParams()
  const horizon = ['3', '6', '12'].includes(params.get('horizon') ?? '') ? params.get('horizon')! : '6'
  const result = useApiQuery('turnover-' + horizon, () => readBusiness<Forecast>('forecast', 'kind=turnover&horizon=' + horizon))
  const report = result.data
  const future = report?.projection ?? []
  return <>
    <AnalyticsCard title="Прогноз чистого обороту"
      description="Видаткові накладні та самостійні касові продажі за вирахуванням повернень покупців. Усі суми у гривнях."
      actions={<SegmentedControl aria-label="Горизонт прогнозу обороту" value={horizon}
        data={['3', '6', '12'].map(value => ({ value, label: value + ' міс.' }))}
        onChange={value => setParams({ tab: 'turnover-forecast', horizon: value })} />}>
      {result.status === 'error' || result.status === 'forbidden'
        ? <p role="alert">{result.problem?.title ?? 'Не вдалося отримати прогноз.'} <Button variant="default" onClick={result.reload}>Повторити</Button></p>
        : !report && <p role="status">Розраховуємо прогноз за історією продажів…</p>}
      {report && <>
        {report.lastDocument && <p>Останній документ продажу · {report.lastDocument}. Послідовних завершених місяців для навчання · {report.trainingMonths}.</p>}
        {report.staleMonths > 0 && <p role="status">Історія відстає на {report.staleMonths} міс. Прогноз починається одразу після останнього повного місяця з даними. Частина оцінок може стосуватися минулих дат.</p>}
        {report.reason && <p role="status">{report.reason}</p>}
        {report.model && future.length > 0 && <>
          <div className="ba-kpis"><div>Оборот за {horizon} міс.<strong>{money(future.reduce((sum, p) => sum + p.value, 0))}</strong></div>
            <div>Період прогнозу<strong>{label(future[0].month)} – {label(future[future.length - 1].month)}</strong></div></div>
          <AnalyticsChart label="Очікуваний чистий оборот" variant="forecast" format={money}
            points={future.map(p => ({ ...point(p), low: p.low ?? undefined, high: p.high ?? undefined }))} />
          <div className="ba-table"><table><thead><tr><th>Місяць</th><th>Прогноз, грн</th><th>Нижня межа, грн</th><th>Верхня межа, грн</th></tr></thead>
            <tbody>{future.map(p => <tr key={p.month}><th>{label(p.month)}</th><td>{formatValue(p.value)}</td>
              <td>{formatValue(p.low)}</td><td>{formatValue(p.high)}</td></tr>)}</tbody></table></div>
          <p>Межі розраховані за 80-м процентилем абсолютної похибки для відповідного кроку прогнозу. Прочерк означає, що для цього кроку є менше п’яти перевірок.</p>
        </>}
      </>}
    </AnalyticsCard>
    {report?.model && <AnalyticsCard title="Точність на відкладеному періоді"
      description={'Модель «' + modelNames[report.model] + '» обрано за попередніми місяцями. Останні ' + report.validation.length + ' міс. відкладено для незалежної перевірки.'}>
      <div className="ba-kpis"><div>Зважена абсолютна похибка (WAPE)<strong>{percent(report.wape)}</strong></div>
        <div>WAPE найкращої простої моделі<strong>{percent(report.baselineWape)}</strong></div>
        <div>Середня помилка за місяць<strong>{formatValue(report.mae)} грн</strong></div></div>
      <div className="ba-table"><table><thead><tr><th>Місяць</th><th>Факт, грн</th><th>Прогноз із минулого, грн</th><th>Відхилення, грн</th></tr></thead>
        <tbody>{report.validation.map(p => <tr key={p.month}><th>{label(p.month)}</th><td>{formatValue(p.actual)}</td>
          <td>{formatValue(p.value)}</td><td>{formatValue(p.value - p.actual)}</td></tr>)}</tbody></table></div>
      <details><summary>Як обрано модель</summary>
        <p>Учасники отримали однакові контрольні місяці. Для кожного старту прогнозу модель навчалася тільки на попередніх даних. Перемагає найменша середня абсолютна помилка.</p>
        <div className="ba-table"><table><thead><tr><th>Модель</th><th>Помилка при відборі, грн/міс.</th><th>Стартів</th><th>WAPE на відкладених даних</th></tr></thead>
          <tbody>{report.comparisons.map(m => <tr key={m.model}><th>{modelNames[m.model]}</th><td>{formatValue(m.mae)}</td><td>{m.origins}</td><td>{percent(m.holdoutWape)}</td></tr>)}</tbody></table></div>
      </details>
    </AnalyticsCard>}
    {report && report.history.length > 0 && <AnalyticsCard title="Фактичний оборот за завершені місяці">
      <AnalyticsChart label="Історичний оборот за документами" variant="bars" format={money} points={report.history.map(point)} />
    </AnalyticsCard>}
  </>
}
