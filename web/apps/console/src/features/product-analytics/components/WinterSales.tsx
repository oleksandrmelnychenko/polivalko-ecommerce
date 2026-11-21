import { Button, Select } from '@mantine/core'
import { Link, useSearchParams } from 'react-router-dom'
import { useRegister } from '@/shared/api/accounting'
import { kyivDay } from '@/shared/lib/kyivTime'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { readBusiness } from '../api/businessAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { OfferLedger, uah, type Offer } from './SalesOffers'

type Cohort = { count: number; ticket: number | null; actual: number | null; known: number; estimate: number | null; estimated: number }
type Week = { start: string; end: string; kit: Cohort; soil: Cohort }
type Season = { weeks: Week[]; through: string; marginThrough: string | null }
const difference = (a: number | null, b: number | null) => a == null || b == null ? '—' : uah(a-b)

function CohortRow({ name, group }: { name: string; group: Cohort }) {
  return <tr><th scope="row">{name}</th><td>{group.count}</td><td>{uah(group.ticket)}</td>
    <td>{uah(group.actual)} ({group.known}/{group.count})</td><td>{uah(group.estimate)} ({group.estimated}/{group.count})</td></tr>
}

export function WinterSales() {
  const [params,setParams] = useSearchParams()
  const today = kyivDay(new Date())
  const current = Number(today.slice(0,4)) - (Number(today.slice(5,7)) < 11 ? 1 : 0)
  const value = Number(params.get('season'))
  const year = Number.isInteger(value) && value >= 2000 && value <= current ? value : current
  const result = useApiQuery('winter-' + year + today, () => readBusiness<Season>('winter', 'year=' + year))
  const weeks = result.data?.weeks ?? []
  const week = weeks.find(w => w.start === params.get('week')) ?? weeks[0]
  function change(field: string, value: string) {
    const next = new URLSearchParams(params)
    if (field === 'season') next.delete('week')
    next.set(field,value)
    setParams(next)
  }
  const offers = useRegister<Offer[]>('offers?from=' + (week?.start ?? '') + '&to=' + (week?.end ?? ''), !!week)
  const rows = (offers.data ?? []).filter(o => o.focus === 'irrigation')
  const shipped = rows.filter(o => o.shipments > 0)
  return <div className="winter-stack">
    <div className="ba-controls">
      <Select label="Зимовий сезон" value={String(year)} allowDeselect={false}
        data={Array.from({ length: Math.max(1,current-2023+1) },(_,i) => ({value:String(current-i),label:(current-i) + '/' + (current-i+1)}))}
        onChange={v => v && change('season',v)} />
      <Select label="Тиждень" value={week?.start ?? null} allowDeselect={false} data={weeks.map(w => ({value:w.start,label:w.start + ' — ' + w.end}))}
        onChange={v => v && change('week',v)} />
    </div>
    {!week ? <p role="status">{result.isFetching ? 'Завантажуємо тижні…' : result.problem?.title ?? 'Немає даних.'}
      {!result.isFetching && <Button variant="default" onClick={result.reload}>Повторити</Button>}</p> : <>
      <AnalyticsCard title="Розсада · середній чек і валовий прибуток на покупку"
        description="Порівнюємо всю суму покупки ґрунту з горщиком або насінням та покупки ґрунту без цих доповнень. Склад кошика визначається за категоріями товарних рядків.">
        <div className="ba-table"><table><thead><tr><th>Тип покупки</th><th>Покупки</th><th>Середній чек</th>
          <th>Прибуток за собівартістю</th><th>Оцінка прибутку</th></tr></thead><tbody>
          <CohortRow name="З комплектом" group={week.kit} /><CohortRow name="Без комплекту" group={week.soil} />
          <tr><th scope="row">Різниця на покупку</th><td>—</td><td>{difference(week.kit.ticket,week.soil.ticket)}</td>
            <td>{difference(week.kit.actual,week.soil.actual)}</td><td>{difference(week.kit.estimate,week.soil.estimate)}</td></tr>
        </tbody></table></div>
        <p>У дужках — кількість повністю оцінених чеків із усіх покупок групи. Суми на момент продажу, до наступних повернень.
          {result.data?.marginThrough && ' Для оцінки відсутньої собівартості використано історичну маржу кожного товару зі звіту до ' + result.data.marginThrough + '.'}
          {' '}Різниця описує кошики покупців. Вплив самої акції потребує порівняння з контрольною групою.</p>
      </AnalyticsCard>
      <details className="pa-card"><summary>Динаміка комплектів за всі тижні сезону</summary>
        <div className="ba-table"><table><thead><tr><th>Період</th><th>Комплекти / покупки ґрунту</th>
          <th>Середній чек усіх покупок ґрунту</th><th>Різниця чека</th><th>Різниця прибутку за собівартістю</th></tr></thead>
          <tbody>{weeks.map(w => {
            const count = w.kit.count + w.soil.count
            const avg = count ? ((w.kit.ticket ?? 0)*w.kit.count + (w.soil.ticket ?? 0)*w.soil.count)/count : null
            return <tr key={w.start}><th scope="row">{w.start} — {w.end}</th><td>{w.kit.count} / {count}</td><td>{uah(avg)}</td>
              <td>{difference(w.kit.ticket,w.soil.ticket)}</td><td>{difference(w.kit.actual,w.soil.actual)}</td></tr>
          })}</tbody>
        </table></div>
      </details>
      <AnalyticsCard title="Розрахунки поливу → відвантаження" description="Розрахунки згруповано за тижнем видачі. Прив’язані проведені накладні враховуються й у наступних тижнях.">
        {offers.data ? <>
          <p>Видано <b>{rows.length}</b> · з відвантаженням <b>{shipped.length}</b> · конверсія <b>{rows.length ? Math.round(100*shipped.length/rows.length) + '%' : '—'}</b>
            {' '}· за накладними <b>{uah(shipped.reduce((sum,o) => sum+o.shipped,0))}</b></p>
          <OfferLedger rows={rows} changed={offers.reload} />
        </> : <p role="status">{offers.isFetching ? 'Завантаження розрахунків…' : 'Не вдалося прочитати реєстр розрахунків.'}
          {!offers.isFetching && <button onClick={offers.reload}>Повторити</button>}</p>}
        <Link to="?tab=offers">Відкрити пропозиції для контрагентів</Link>
      </AnalyticsCard>
    </>}
  </div>
}
