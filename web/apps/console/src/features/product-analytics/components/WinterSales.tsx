import { Button, Select } from '@mantine/core'
import { IconArrowRight, IconChartBar, IconChevronDown, IconFileInvoice, IconPercentage, IconPlant, IconSend, IconTruck, IconWallet } from '@tabler/icons-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRegister } from '@/shared/api/accounting'
import { kyivDay } from '@/shared/lib/kyivTime'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { MetricLabel, MetricTile } from '@/shared/ui/MetricCard'
import { readBusiness } from '../api/businessAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { OfferLedger, uah, type Offer } from './SalesOffers'

type Cohort = { count: number; ticket: number | null; actual: number | null; known: number; estimate: number | null; estimated: number }
type Shipment = { id: string; number: string | null; day: string; amount: number; profit: number | null; estimated: boolean }
type StatisticalOffers = {
  issued: number; converted: number; shipments: number; turnover: number; profit: number | null
  costed: number; estimated: number; unknownBasis: number
  offers: { id: string; partner: string; day: string; focus: string; invoices: Shipment[] }[]
}
type Week = { start: string; end: string; kit: Cohort; soil: Cohort; statOffers?: StatisticalOffers }
type Season = { weeks: Week[]; through: string; marginThrough: string | null }
const difference = (a: number | null, b: number | null) => a == null || b == null ? '—' : uah(a-b)
const dates = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const weekLabel = (week: Week) => dates.formatRange(new Date(week.start), new Date(week.end))

function CohortRow({ name, group }: { name: string; group: Cohort }) {
  return <tr><th scope="row">{name}</th><td>{group.count}</td><td>{uah(group.ticket)}</td>
    <td>{uah(group.actual)} <small className="winter-coverage" title="Оцінено чеків із усіх покупок">{group.known}/{group.count}</small></td>
    <td>{uah(group.estimate)} <small className="winter-coverage" title="Оцінено чеків із усіх покупок">{group.estimated}/{group.count}</small></td></tr>
}

function StatisticalOfferResults({ group }: { group: StatisticalOffers }) {
  const partial = group.costed < group.shipments
  return <AnalyticsCard title={<MetricLabel icon={IconSend}>Пропозиції за статистикою продажів</MetricLabel>}
    description="За тижнем видачі пропозиції. Оборот і валовий прибуток включають повну суму прив’язаних видаткових накладних, зокрема пізніших тижнів, до повернень.">
    <ul className="winter-metrics">
      <MetricTile icon={IconSend} label="Видано пропозицій"><strong>{group.issued}</strong></MetricTile>
      <MetricTile icon={IconTruck} label="Пропозицій з відвантаженням"><strong>{group.converted}</strong></MetricTile>
      <MetricTile icon={IconFileInvoice} label="Оборот за накладними"><strong>{uah(group.turnover)}</strong></MetricTile>
      <MetricTile icon={IconWallet} label={partial ? 'Прибуток за оціненими накладними' : 'Валовий прибуток'}><strong>{uah(group.profit)}</strong></MetricTile>
    </ul>
    {group.shipments > 0 && <p>Собівартість визначено для {group.costed} із {group.shipments} накладних.
      {group.estimated > 0 && ' Для ' + group.estimated + ' накладних використано ціни попередніх закупівель.'}</p>}
    {group.unknownBasis > 0 && <p>За цей тиждень є пропозиції без збереженого способу підбору ({group.unknownBasis}). Їх виключено з показників.</p>}
    {group.offers.length ? <div className="ba-table"><table>
      <thead><tr><th>Контрагент і дата видачі</th><th>Відвантаження</th><th>Оборот</th><th>Валовий прибуток</th></tr></thead>
      <tbody>{group.offers.map(offer => {
        const label = <>{offer.partner}<br /><small>{dates.format(new Date(offer.day))} · {offer.focus === 'irrigation' ? 'Полив' : 'Асортимент'} · {offer.id.slice(0,8)}</small></>
        return offer.invoices.length ? offer.invoices.map((invoice,index) => <tr key={invoice.id}>
          {index === 0 && <th scope="row" rowSpan={offer.invoices.length}>{label}</th>}
          <td>{invoice.number || invoice.id.slice(0,8)} · {dates.format(new Date(invoice.day))}</td>
          <td>{uah(invoice.amount)}</td><td>{uah(invoice.profit)}{invoice.estimated && ' (оцінка)'}</td>
        </tr>) : <tr key={offer.id}><th scope="row">{label}</th><td>Очікує відвантаження</td><td>—</td><td>—</td></tr>
      })}</tbody></table></div> : <p>За цей тиждень немає зареєстрованих пропозицій зі статистичним підбором.</p>}
  </AnalyticsCard>
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
  return <div className="winter-stack winter-sales">
    <div className="winter-filters pa-card">
      <Select radius="xl" label="Зимовий сезон" value={String(year)} allowDeselect={false}
        data={Array.from({ length: Math.max(1,current-2023+1) },(_,i) => ({value:String(current-i),label:(current-i) + '/' + (current-i+1)}))}
        onChange={v => v && change('season',v)} />
      <Select radius="xl" label="Тиждень" disabled={!weeks.length} value={week?.start ?? null} allowDeselect={false} data={weeks.map(w => ({value:w.start,label:weekLabel(w)}))}
        onChange={v => v && change('week',v)} />
    </div>
    {!week ? <p className="pa-card winter-status" role="status">{result.isFetching ? 'Завантажуємо тижні…' : result.problem?.title ?? 'За цей сезон даних немає.'}
      {!result.isFetching && <Button variant="default" onClick={result.reload}>Повторити</Button>}</p> : <>
      <AnalyticsCard title={<MetricLabel icon={IconPlant}>Розсада · середній чек і прибуток на покупку</MetricLabel>}
        description="Комплект — це покупка ґрунту разом із горщиком або насінням. Порівнюємо повну суму чеків.">
        <div className="ba-table"><table><thead><tr><th>Тип покупки</th><th>Покупки</th><th>Середній чек</th>
          <th>Прибуток за собівартістю</th><th>Оцінка прибутку</th></tr></thead><tbody>
          <CohortRow name="З комплектом" group={week.kit} /><CohortRow name="Без комплекту" group={week.soil} />
          <tr className="winter-difference"><th scope="row">Різниця на покупку</th><td>—</td><td>{difference(week.kit.ticket,week.soil.ticket)}</td>
            <td>{difference(week.kit.actual,week.soil.actual)}</td><td>{difference(week.kit.estimate,week.soil.estimate)}</td></tr>
        </tbody></table></div>
        <details className="winter-method"><summary>Як розраховано показники</summary><p>Дріб біля суми показує кількість повністю оцінених чеків із усіх покупок групи. Суми на момент продажу, до наступних повернень.
          {result.data?.marginThrough && ' Для оцінки відсутньої собівартості використано історичну маржу кожного товару зі звіту до ' + result.data.marginThrough + '.'}
          {' '}Різниця описує кошики покупців. Вплив самої акції потребує порівняння з контрольною групою.</p></details>
      </AnalyticsCard>
      <details className="pa-card winter-history"><summary><MetricLabel icon={IconChartBar}>Динаміка комплектів за тижнями</MetricLabel><IconChevronDown size={16} aria-hidden="true" /></summary>
        <div className="ba-table"><table><thead><tr><th>Період</th><th>Комплекти / покупки ґрунту</th>
          <th>Середній чек усіх покупок ґрунту</th><th>Різниця чека</th><th>Різниця прибутку за собівартістю</th></tr></thead>
          <tbody>{weeks.map(w => {
            const count = w.kit.count + w.soil.count
            const avg = count ? ((w.kit.ticket ?? 0)*w.kit.count + (w.soil.ticket ?? 0)*w.soil.count)/count : null
            return <tr key={w.start}><th scope="row">{weekLabel(w)}</th><td>{w.kit.count} / {count}</td><td>{uah(avg)}</td>
              <td>{difference(w.kit.ticket,w.soil.ticket)}</td><td>{difference(w.kit.actual,w.soil.actual)}</td></tr>
          })}</tbody>
        </table></div>
      </details>
      {week.statOffers && <StatisticalOfferResults group={week.statOffers} />}
      <AnalyticsCard title={<MetricLabel icon={IconTruck}>Розрахунки поливу й відвантаження</MetricLabel>} description="За тижнем видачі розрахунку. Враховано також прив’язані накладні наступних тижнів."
        actions={<Button component={Link} to="?tab=offers" radius="xl" variant="default" size="xs" rightSection={<IconArrowRight size={15} />}>Пропозиції для контрагентів</Button>}>
        {offers.data ? <>
          <ul className="winter-metrics">
            <MetricTile icon={IconSend} label="Видано розрахунків"><strong>{rows.length}</strong></MetricTile>
            <MetricTile icon={IconFileInvoice} label="З відвантаженням"><strong>{shipped.length}</strong></MetricTile>
            <MetricTile icon={IconPercentage} label="Конверсія"><strong>{rows.length ? Math.round(100*shipped.length/rows.length) + '%' : '—'}</strong></MetricTile>
            <MetricTile icon={IconWallet} label="За накладними"><strong>{uah(shipped.reduce((sum,o) => sum+o.shipped,0))}</strong></MetricTile>
          </ul>
          <div className="winter-ledger"><OfferLedger rows={rows} changed={() => { offers.reload(); result.reload() }} /></div>
        </> : <p className="winter-status" role="status">{offers.isFetching ? 'Завантаження розрахунків…' : 'Не вдалося прочитати реєстр розрахунків.'}
          {!offers.isFetching && <Button variant="default" radius="xl" onClick={offers.reload}>Повторити</Button>}</p>}
      </AnalyticsCard>
    </>}
  </div>
}
