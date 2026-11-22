import { Button, Loader, SegmentedControl } from '@mantine/core'
import { IconAlertCircle, IconCalendarStats, IconChartBar, IconChartLine, IconCoins, IconHistory, IconRefresh, IconScale } from '@tabler/icons-react'
import { useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { readBusiness } from '../api/businessAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { AnalyticsChart } from './AnalyticsChart'
import { formatValue } from './BusinessForecast'
import './turnover-forecast.css'

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
const monthLabel = new Intl.DateTimeFormat('uk-UA', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const dayLabel = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const label = (day: string) => monthLabel.format(new Date(day + 'T00:00:00Z'))
const money = (n: number) => formatValue(n) + ' ₴'
const percent = (n: number | null) => n == null ? '—' : formatValue(n * 100) + '%'
const point = (p: Point) => ({ value: p.value, label: label(p.month), axisLabel: p.month.slice(5, 7) + '/' + p.month.slice(2, 4) })
const horizons = ['3', '6', '12'].map(value => ({ value, label: value + ' міс.' }))

function Validation({ report, model }: { report: Forecast; model: Model }) {
  return <AnalyticsCard title={<MetricLabel icon={IconScale}>Перевірка точності</MetricLabel>}
    description={`Модель «${modelNames[model]}». Контрольний період — ${report.validation.length} міс.`}>
    <dl className="turnover-accuracy">
      <div><dt>Похибка моделі (WAPE)</dt><dd>{percent(report.wape)}</dd></div>
      <div><dt>Похибка базової моделі (WAPE)</dt><dd>{percent(report.baselineWape)}</dd></div>
      <div><dt>Середня абсолютна похибка за місяць</dt><dd>{report.mae == null ? '—' : money(report.mae)}</dd></div>
    </dl>
    <div className="turnover-scroll" tabIndex={0} role="region" aria-label="Перевірка за місяцями"><table>
      <thead><tr><th scope="col">Місяць</th><th scope="col">Факт, ₴</th><th scope="col">Прогноз, ₴</th><th scope="col">Відхилення, ₴</th></tr></thead>
      <tbody>{report.validation.map(p => <tr key={p.month}><th scope="row">{label(p.month)}</th><td>{formatValue(p.actual)}</td>
        <td>{formatValue(p.value)}</td><td>{formatValue(p.value - p.actual)}</td></tr>)}</tbody>
    </table></div>
    <details className="turnover-method"><summary>Як обрано модель</summary>
      <p>Моделі порівнюємо за середньою абсолютною похибкою на однакових місяцях. Останні контрольні місяці відкладаємо для окремої перевірки.</p>
      <div className="turnover-scroll" tabIndex={0} role="region" aria-label="Порівняння моделей"><table>
        <thead><tr><th scope="col">Модель</th><th scope="col">Похибка відбору, ₴/міс.</th><th scope="col">Стартів</th><th scope="col">Контрольна WAPE</th></tr></thead>
        <tbody>{report.comparisons.map(m => <tr key={m.model}><th scope="row">{modelNames[m.model]}{m.model === model && <small>Обрана модель</small>}</th>
          <td>{formatValue(m.mae)}</td><td>{m.origins}</td><td>{percent(m.holdoutWape)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </AnalyticsCard>
}

export function TurnoverForecast() {
  const [params, setParams] = useSearchParams()
  const horizon = horizons.find(h => h.value === params.get('horizon'))?.value ?? '6'
  const result = useApiQuery('turnover-' + horizon, () => readBusiness<Forecast>('forecast', 'kind=turnover&horizon=' + horizon))
  const failed = result.status === 'error' || result.status === 'forbidden'
  const report = failed ? undefined : result.data
  const future = report?.projection ?? []
  const first = future.at(0)
  const last = future.at(-1)

  return <div className="turnover-report">
    <AnalyticsCard title={<MetricLabel icon={IconCalendarStats}>Прогноз чистого обороту</MetricLabel>}
      description="Продажі за накладними й окремими чеками з урахуванням повернень."
      actions={<SegmentedControl aria-label="Горизонт прогнозу обороту" value={horizon} data={horizons}
        onChange={value => {
          const next = new URLSearchParams(params)
          next.set('horizon', value)
          setParams(next)
        }} />}>
      {report?.lastDocument && <div className="turnover-source">
        <span>Останній документ <time dateTime={report.lastDocument}>{dayLabel.format(new Date(report.lastDocument + 'T00:00:00Z'))}</time></span>
        <span>Історія для прогнозу <b>{report.trainingMonths} міс.</b></span>
      </div>}
      {report && report.staleMonths > 0 && <p className="turnover-state" role="status"><IconHistory size={17} />
        Історія відстає на {report.staleMonths} міс. Прогноз починається після останнього повного місяця з даними.</p>}
      {failed ? <div className="turnover-state" role="alert"><IconAlertCircle size={18} />{result.problem?.title ?? 'Не вдалося отримати прогноз.'}
        <Button size="xs" radius="xl" variant="default" leftSection={<IconRefresh size={14} />} onClick={result.reload}>Повторити</Button></div>
        : !report ? <p className="turnover-state" role="status"><Loader size={16} />Розраховуємо прогноз на {horizon} міс.…</p>
        : report.reason && <p className="turnover-state" role="status">{report.reason}</p>}
    </AnalyticsCard>
    {first && last && <>
      <div className="ba-overview-metrics turnover-metrics">
        <div className="pa-card"><MetricLabel icon={IconCoins}>Прогноз за {horizon} міс.</MetricLabel>
          <strong>{money(future.reduce((sum, p) => sum + p.value, 0))}</strong><span>{label(first.month)} – {label(last.month)}</span></div>
        <div className="pa-card"><MetricLabel icon={IconChartLine}>Перший місяць прогнозу</MetricLabel>
          <strong>{money(first.value)}</strong><span>{label(first.month)}</span></div>
      </div>
      <AnalyticsCard title={<MetricLabel icon={IconChartLine}>Очікуваний оборот за місяцями</MetricLabel>}
        description="Лінія показує прогноз. Затінена область — межі за 80-м процентилем історичної абсолютної похибки. Для меж потрібно п’ять перевірок відповідного кроку. Прогноз і межі не опускаються нижче нуля, якщо в історії не було місяця з від’ємним оборотом.">
        <AnalyticsChart key={horizon} label="Очікуваний чистий оборот" variant="forecast" format={money}
          points={future.map(p => ({ ...point(p), low: p.low ?? undefined, high: p.high ?? undefined }))} />
      </AnalyticsCard>
    </>}
    {report?.model && <Validation report={report} model={report.model} />}
    {report && report.history.length > 0 && <AnalyticsCard title={<MetricLabel icon={IconChartBar}>Фактичний оборот</MetricLabel>}
      description={label(report.history[0].month) + ' – ' + label(report.history[report.history.length - 1].month)}>
      <AnalyticsChart label="Оборот за завершені місяці" variant="bars" format={money} points={report.history.map(point)} />
    </AnalyticsCard>}
  </div>
}
