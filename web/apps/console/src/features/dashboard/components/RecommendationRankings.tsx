import { Button, Group, NativeSelect, SegmentedControl } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPercent, formatPrice } from '@/shared/lib/salesFormat'
import type { RecommendationGroup, RecommendationPeriod } from '../api/dashboardApi'
import { CalculationInfo } from './CalculationInfo'

const dimensions = [{ value: 'customers', label: 'Клієнти' }, { value: 'products', label: 'Товари' }]
const metrics = [{ value: 'turnover', label: 'Найбільший оборот' }, { value: 'profit', label: 'Найбільший валовий прибуток' },
  { value: 'conversionRate', label: 'Найвища конверсія' }]
export type RankingOptions = { dimension: 'customers' | 'products'; metric: 'turnover' | 'profit' | 'conversionRate' }
export const defaultRanking: RankingOptions = { dimension: 'customers', metric: 'turnover' }

function compareRows(a: RecommendationGroup, b: RecommendationGroup, metric: RankingOptions['metric']) {
  const x = metric === 'profit' && !a.invoices ? null : a[metric]
  const y = metric === 'profit' && !b.invoices ? null : b[metric]
  if (x === null && y !== null) return 1
  if (y === null && x !== null) return -1
  return (y ?? 0) - (x ?? 0) || (metric === 'conversionRate' ? b.offered - a.offered : 0) ||
    b.turnover - a.turnover || a.name.localeCompare(b.name, 'uk') || a.id.localeCompare(b.id)
}

export function RecommendationRankings({ period, options, onChange }: {
  period: RecommendationPeriod; options: RankingOptions; onChange: (value: RankingOptions) => void
}) {
  const [limit, setLimit] = useState(20)
  const { dimension, metric } = options
  const customers = dimension === 'customers'
  const source = period[dimension]
  const rows = source ? [...source].sort((a,b) => compareRows(a,b,metric)) : []
  return <section aria-label="Рейтинг за рекомендаціями">
    <h3 className="dash-with-info">Рейтинг за {period.days} днів
      <CalculationInfo title="Як розраховано рейтинг">
        <p>Конверсія — частка зроблених за період пропозицій, за якими вже провели накладну. Під відсотком показано кількість продажів із цих пропозицій.</p>
        <p>Оборот і валовий прибуток враховують пов’язані накладні за днем їх проведення. Продаж за давнішою пропозицією може дати оборот навіть за відсутності нових пропозицій.</p>
      </CalculationInfo>
    </h3>
    <Group gap="sm" my="xs">
      <SegmentedControl aria-label="Групування рейтингу" data={dimensions} value={dimension}
        onChange={value => { setLimit(20); onChange({ ...options, dimension: value === 'products' ? 'products' : 'customers' }) }} />
      <NativeSelect aria-label="Сортування рейтингу" data={metrics} value={metric}
        onChange={event => { setLimit(20); onChange({ ...options, metric: event.currentTarget.value as RankingOptions['metric'] }) }} />
    </Group>
    {!source ? <p role="status">Показники рейтингу тимчасово недоступні.</p> : !rows.length ?
      <p>За цей період немає пропозицій або проведених накладних з рекомендацій.</p> :
      <div className="rec-results-scroll"><table aria-label={customers ? 'Рейтинг клієнтів' : 'Рейтинг товарів'}>
        <thead><tr><th>{customers ? 'Клієнт' : 'Товар'}</th><th>Конверсія</th><th>Оборот</th><th>Валовий прибуток</th></tr></thead>
        <tbody>{rows.slice(0,limit).map(row => <tr key={row.id}>
          <th scope="row"><Link to={(customers ? '/accounting/partners/' : '/catalog/products/') + row.id}>{row.name}</Link>
            {row.sku && <small>{row.sku}</small>}</th>
          <td>{row.conversionRate === null ? '—' : formatPercent(row.conversionRate)}
            <small>{row.offered ? row.sold + ' із ' + row.offered : 'Без нових пропозицій'}</small></td>
          <td>{formatPrice(row.turnover)}<small>{row.invoices} накл.</small></td>
          <td>{row.profit !== null ? formatPrice(row.profit) : row.priced ? 'Неповні дані' : 'Собівартість невідома'}
            {row.profit === null && row.priced > 0 && <small>{formatPrice(row.coveredProfit)} за {row.priced} із {row.invoices} накл.</small>}
            {row.estimated > 0 && <small>За ціною закупівлі · {row.estimated} накл.</small>}</td>
        </tr>)}</tbody>
      </table></div>}
    {rows.length > limit && <Button size="xs" variant="default" onClick={() => setLimit(n => n + 20)}>Показати ще</Button>}
  </section>
}
