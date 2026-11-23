import { Button } from '@mantine/core'
import { IconChevronDown, IconFileText } from '@tabler/icons-react'
import { useState } from 'react'
import { dateLabel, formatPrice } from '@/shared/lib/salesFormat'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import type { RecommendationPeriod, RecommendationResultsReport } from '../api/dashboardApi'
import { RecommendationRankings, type RankingOptions } from './RecommendationRankings'
import { CalculationInfo } from './CalculationInfo'

function ProfitNotes({ period }: { period: RecommendationPeriod }) {
  return <>
    {period.profit === null && <small>{period.priced ? formatPrice(period.coveredProfit) + ' за ' + period.priced + ' із ' + period.invoices + ' накл.' : 'Собівартість невідома'}</small>}
    {period.estimated > 0 && <small>За ціною закупівлі · {period.estimated} накл.</small>}
  </>
}

export function RecommendationResults({ report, days, ranking, onRanking }: {
  report: RecommendationResultsReport; days: number; ranking: RankingOptions; onRanking: (options: RankingOptions) => void
}) {
  const [limit, setLimit] = useState(20)
  const selected = report.periods.find(p => p.days === days)
  const invoices = selected ? report.invoices.filter(i => (i.soldDay ?? i.day) >= selected.start) : []
  return <div className="rec-results">
    <section>
      <h3 className="dash-with-info">Від пропозиції до продажу
        <CalculationInfo title="Як рахуються пропозиції та погодження">
          <p>Періоди до {dateLabel(report.through)} включно, за датою пропозиції. Погодження враховується і після зняття резерву.</p>
        </CalculationInfo>
        {selected && <TableChip value={days + ' днів'} />}
      </h3>
      {selected && <dl className="rec-result-metrics">
        <div><dt>Зроблено пропозицій</dt><dd>{selected.offered}</dd></div>
        <div><dt>Погоджено</dt><dd>{selected.accepted}</dd></div>
        <div><dt>Дійшли до продажу</dt><dd>{selected.sold}</dd></div>
      </dl>}
      <details open={!selected}><summary>Порівняти періоди <IconChevronDown size={16} aria-hidden="true" /></summary>
      <div className="rec-results-scroll"><table aria-label="Пропозиції за періодами">
        <thead><tr><th>Період</th><th>Зробили</th><th>Погодили</th><th>Дійшли до продажу</th></tr></thead>
        <tbody>{report.periods.map(p => <tr key={p.days} data-selected={p.days === days}>
          <th scope="row">{p.days} днів</th><td>{p.offered}</td><td>{p.accepted}</td><td>{p.sold}</td>
        </tr>)}</tbody>
      </table></div></details>
    </section>
    <section>
      <h3 className="dash-with-info">Продажі з рекомендацій
        <CalculationInfo title="За якою датою враховано продажі">
          <p>За днем проведення видаткової накладної, включно з продажами за давнішими пропозиціями. Дата на самій накладній може бути іншою: чернетку створюють під час погодження, а проводять під час відвантаження.</p>
        </CalculationInfo>
        {selected && <TableChip value={days + ' днів'} />}
      </h3>
      {selected && <dl className="rec-result-metrics">
        <div><dt>Накладних</dt><dd>{selected.invoices}</dd></div>
        <div><dt>Оборот</dt><dd>{formatPrice(selected.turnover)}</dd></div>
        <div><dt>Валовий прибуток</dt><dd>{selected.profit !== null ? formatPrice(selected.profit) : 'Неповні дані'}<ProfitNotes period={selected} /></dd></div>
      </dl>}
      <details open={!selected}><summary>Порівняти періоди <IconChevronDown size={16} aria-hidden="true" /></summary>
      <div className="rec-results-scroll"><table aria-label="Оборот і валовий прибуток з рекомендацій">
        <thead><tr><th>Період</th><th>Накладних</th><th>Оборот</th><th>Валовий прибуток{' '}
          <CalculationInfo title="Як визначено собівартість для валового прибутку">
            <p>Валовий прибуток тут оцінковий. Накладні з рекомендацій не містять власної собівартості, тому беремо ціну останньої прибуткової накладної того самого товару, організації та складу до дати накладної. Якщо такої накладної немає, вона того самого дня або не пройшла перевірку, собівартість невідома і прибуток не показуємо.</p>
          </CalculationInfo>
        </th></tr></thead>
        <tbody>{report.periods.map(p => <tr key={p.days} data-selected={p.days === days}>
          <th scope="row">{p.days} днів</th><td>{p.invoices}</td><td>{formatPrice(p.turnover)}</td>
          <td>{p.profit !== null ? formatPrice(p.profit) : 'Неповні дані'}
            <ProfitNotes period={p} />
          </td>
        </tr>)}</tbody>
      </table></div></details>
      {invoices.length > 0 && <details>
        <summary><IconFileText size={15} aria-hidden="true" />Проведені накладні за {days} днів <TableChip value={invoices.length} /><IconChevronDown size={16} aria-hidden="true" /></summary>
        <div className="rec-results-scroll"><table aria-label="Накладні з рекомендацій">
          <thead><tr><th>Накладна</th><th>Оборот</th><th>Валовий прибуток</th></tr></thead>
          <tbody>{invoices.slice(0,limit).map(i => <tr key={i.id}>
            <th scope="row"><DocumentLink id={i.id}>{i.number}</DocumentLink>
              <small>{i.soldDay && i.soldDay !== i.day ? `Проведено ${dateLabel(i.soldDay)} · дата накладної ${dateLabel(i.day)}` : dateLabel(i.day)}</small></th>
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
