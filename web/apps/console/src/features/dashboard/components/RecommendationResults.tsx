import { Button } from '@mantine/core'
import { useState } from 'react'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import type { RecommendationResultsReport } from '../api/dashboardApi'
import { RecommendationRankings, type RankingOptions } from './RecommendationRankings'
import { CalculationInfo } from './CalculationInfo'

export function RecommendationResults({ report, days, ranking, onRanking }: {
  report: RecommendationResultsReport; days: number; ranking: RankingOptions; onRanking: (options: RankingOptions) => void
}) {
  const [limit, setLimit] = useState(20)
  const selected = report.periods.find(p => p.days === days)
  const invoices = selected ? report.invoices.filter(i => i.day >= selected.start) : []
  return <div className="rec-results">
    <section>
      <h3 className="dash-with-info">Від пропозиції до продажу
        <CalculationInfo title="Як рахуються пропозиції та погодження">
          <p>Періоди до {dateLabel(report.through)} включно, за датою пропозиції. Погодження враховується і після зняття резерву.</p>
        </CalculationInfo>
      </h3>
      <div className="rec-results-scroll"><table aria-label="Пропозиції за періодами">
        <thead><tr><th>Період</th><th>Зробили</th><th>Погодили</th><th>Дійшли до продажу</th></tr></thead>
        <tbody>{report.periods.map(p => <tr key={p.days} data-selected={p.days === days}>
          <th scope="row">{p.days} днів</th><td>{p.offered}</td><td>{p.accepted}</td><td>{p.sold}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
    <section>
      <h3 className="dash-with-info">Продажі з рекомендацій
        <CalculationInfo title="За якою датою враховано продажі">
          <p>За датою проведеної видаткової накладної, включно з продажами за давнішими пропозиціями.</p>
        </CalculationInfo>
      </h3>
      <div className="rec-results-scroll"><table aria-label="Оборот і валовий прибуток з рекомендацій">
        <thead><tr><th>Період</th><th>Накладних</th><th>Оборот</th><th>Валовий прибуток{' '}
          <CalculationInfo title="Як визначено собівартість для валового прибутку">
            <p>Собівартість беремо з рядка продажу або оцінюємо за прибутковими накладними того самого товару, організації та складу до дати продажу.</p>
          </CalculationInfo>
        </th></tr></thead>
        <tbody>{report.periods.map(p => <tr key={p.days} data-selected={p.days === days}>
          <th scope="row">{p.days} днів</th><td>{p.invoices}</td><td>{formatPrice(p.turnover)}</td>
          <td>{p.profit !== null ? formatPrice(p.profit) : 'Неповні дані'}
            {p.profit === null && <small>{p.priced ? formatPrice(p.coveredProfit) + ' за ' + p.priced + ' із ' + p.invoices + ' накл.' : 'Собівартість невідома'}</small>}
            {p.estimated > 0 && <small>За ціною закупівлі · {p.estimated} накл.</small>}
          </td>
        </tr>)}</tbody>
      </table></div>
      {invoices.length > 0 && <details>
        <summary>Проведені накладні за {days} днів · {invoices.length}</summary>
        <div className="rec-results-scroll"><table aria-label="Накладні з рекомендацій">
          <thead><tr><th>Накладна</th><th>Оборот</th><th>Валовий прибуток</th></tr></thead>
          <tbody>{invoices.slice(0,limit).map(i => <tr key={i.id}>
            <th scope="row"><DocumentLink id={i.id}>{i.number}</DocumentLink><small>{dateLabel(i.day)}</small></th>
            <td>{formatPrice(i.turnover)}</td><td>{i.profit === null ? 'Собівартість невідома' : formatPrice(i.profit)}
              {i.estimated && <small>За ціною закупівлі</small>}</td>
          </tr>)}</tbody>
        </table></div>
        {invoices.length > limit && <Button size="xs" variant="default" onClick={() => setLimit(n => n + 20)}>Показати ще</Button>}
      </details>}
    </section>
    {selected && <RecommendationRankings period={selected} options={ranking} onChange={onRanking} />}
  </div>
}
