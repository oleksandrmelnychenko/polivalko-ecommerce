import { Button, SegmentedControl } from '@mantine/core'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { kyivDay } from '@/shared/lib/kyivTime'
import { readBusiness } from '../api/businessAnalytics'
import { AnalyticsCard } from './AnalyticsCard'
import { formatValue } from './BusinessForecast'
import shapes from './ukraineRegions.json'
import './buyer-markets.css'

type Period = { count: number; returns: number; amount: number; lastPurchase: string | null }
type Region = Period & { code: string; name: string }
type Geography = { unknown: Period; regions: Region[] }
type Source = 'documents' | 'registered' | 'online'
type Metric = 'count' | 'amount'
type Markets = Record<Source, Geography> & {
  year: number; partnerCount: number; matches: number; excluded: number; unlinked: Period
  partners: (Period & { id: string; name: string })[]
}
const sourceNames: Record<Source, string> = { documents: 'Доставка за документами', registered: 'Адреса контрагента', online: 'Доставка вебзамовлень' }
const descriptions: Record<Source, string> = {
  documents: 'Область доставки у видатковій накладній або самостійному касовому чеку. Повернення зменшують оборот.',
  registered: 'Продажі за областю з картки контрагента. Ця адреса може відрізнятися від місця доставки.',
  online: 'Оплачені, відвантажені, готові до видачі та завершені вебзамовлення. Область визначає довідник населених пунктів Нової пошти. Сума замовлень включає повернення.',
}
const metricLabel = (value: number, metric: Metric) => formatValue(value) + (metric === 'amount' ? ' грн' : '')
const colors = ['#d7ebe7', '#98d0bf', '#56af93', '#238267', '#10553e']

function RegionalMap({ data, source, metric }: { data: Geography; source: Source; metric: Metric }) {
  const [selected, setSelected] = useState<string | null>(null)
  const recorded = data.regions.filter(r => r.count || r.returns)
  const ranking = recorded.filter(r => r[metric] > 0).sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'uk'))
  const peak = ranking[0]?.[metric] ?? 0
  const active = data.regions.find(r => r.code === selected) ?? ranking[0]
  const known = recorded.reduce((sum, r) => sum + r.count, 0)
  const total = known + data.unknown.count
  const leaders = ranking.filter(r => r[metric] === peak)
  const paths: Record<string, string> = shapes
  return <>
    <p>{descriptions[source]}</p>
    <div className="ba-kpis"><div>Продажів із відомою областю<strong>{formatValue(known)} із {formatValue(total)}</strong></div>
      <div>{metric === 'count' ? 'Найбільше покупок' : 'Найбільша сума'}<strong>{leaders.length ? leaders.map(r => r.name).join(', ') : 'Бракує даних'}</strong></div></div>
    <div className="ba-market-map">
      <svg viewBox="0 0 1000 669" aria-label="Карта покупок за областями України" role="group">
        {data.regions.map(r => {
          const color = r[metric] > 0 && peak ? colors[Math.min(4, Math.floor(5*r[metric]/peak))] : r.amount < 0 && metric === 'amount' ? '#a26154' : '#e9edef'
          return <path key={r.code} d={paths[r.code]} fill={color} stroke={selected === r.code ? '#162e27' : '#fff'}
            strokeWidth={selected === r.code ? 2.4 : 1} tabIndex={0} role="button" aria-pressed={selected === r.code}
            aria-label={r.name + ' · ' + metricLabel(r[metric], metric)} onClick={() => setSelected(r.code)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(r.code) } }}>
            <title>{r.name} · {metricLabel(r[metric], metric)}</title></path>
        })}
      </svg>
      <div aria-live="polite" className="ba-market-region">
        {active ? <><strong>{active.name}</strong><span>{formatValue(active.count)} покупок</span>
          <span>{formatValue(active.amount)} грн</span></> : <strong>Область покупки невідома</strong>}
      </div>
    </div>
    <p className="ba-map-legend"><span>Менше</span>{colors.map(c => <i style={{ background: c }} key={c} />)}<span>Більше</span>
      <i style={{ background: '#e9edef' }} /><span>Без додатного значення</span>
      {metric === 'amount' && <><i style={{ background: '#a26154' }} /><span>Від’ємний оборот</span></>}</p>
    {!known && <p role="status">{total ? 'У вибраних продажах немає підтвердженої області. Лідера визначити неможливо.' : 'За цей рік у вибраному джерелі немає покупок.'}</p>}
    <p>Регіон невідомий · {formatValue(data.unknown.count)} покупок · {formatValue(data.unknown.amount)} грн.</p>
    {recorded.length > 0 && <div className="ba-table"><table><thead><tr><th>Область</th><th>Покупок</th><th>Сума, грн</th></tr></thead>
      <tbody>{[...recorded].sort((a,b) => b[metric]-a[metric]).map(r => <tr key={r.code}>
        <th><button onClick={() => setSelected(r.code)}>{r.name}</button></th><td>{formatValue(r.count)}</td><td>{formatValue(r.amount)}</td></tr>)}</tbody></table></div>}
    <small>Межі областей · <a href="https://simplemaps.com/svg/country/ua" target="_blank" rel="noreferrer">Simplemaps</a></small>
  </>
}

export function BuyerMarkets() {
  const [params, setParams] = useSearchParams()
  const latest = Number(kyivDay(new Date()).slice(0, 4))
  const chosen = Number(params.get('year') ?? latest)
  const year = Number.isInteger(chosen) && chosen >= 1900 && chosen <= latest ? chosen : latest
  const [source, setSource] = useState<Source>('documents')
  const [metric, setMetric] = useState<Metric>('count')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const args = new URLSearchParams({ analysis: 'markets', year: String(year), page: String(page), search })
  const query = useApiQuery('markets-' + args, () => readBusiness<Markets>('documents', args.toString()))
  const data = query.data
  return <>
    <AnalyticsCard title="Географія покупок" actions={<label>Рік <input type="number" min={1900} max={latest}
      defaultValue={year} key={year} onBlur={e => { const v = e.currentTarget.valueAsNumber
        if (Number.isInteger(v) && v >= 1900 && v <= latest) { setPage(1); setParams({ tab: 'markets', year: String(v) }) } }} /></label>}>
      <div className="ba-controls"><SegmentedControl aria-label="Джерело регіону" value={source} onChange={v => setSource(v as Source)}
        data={Object.entries(sourceNames).map(([value, label]) => ({ value, label }))} />
        <SegmentedControl aria-label="Показник карти" value={metric} onChange={v => setMetric(v as Metric)}
          data={[{ value: 'count', label: 'Кількість покупок' }, { value: 'amount', label: 'Сума, грн' }]} /></div>
      {data ? <RegionalMap key={source + year} data={data[source]} source={source} metric={metric} />
        : query.status === 'loading' ? <p role="status">Читаємо реєстр продажів…</p>
          : <p role="alert">{query.problem?.title ?? 'Не вдалося завантажити карту.'} <Button variant="default" onClick={query.reload}>Повторити</Button></p>}
    </AnalyticsCard>
    <AnalyticsCard title="Покупки контрагентів" description="Рейтинг за чистим оборотом проведених документів у гривні. Картка відкривається у реєстрі обліку.">
      <label>Пошук контрагента <input type="search" value={search} maxLength={120} onChange={e => { setSearch(e.target.value); setPage(1) }} /></label>
      {data && <><p>Контрагентів із документами · {formatValue(data.partnerCount)}. Без прив’язки до картки · {formatValue(data.unlinked.count)} покупок на {formatValue(data.unlinked.amount)} грн чистого обороту.</p>
        {data.excluded > 0 && <p>Документи з непідтвердженою сумою, валютою або статусом · {formatValue(data.excluded)}.</p>}
        <div className="ba-table"><table><thead><tr><th>Контрагент</th><th>Покупок</th><th>Повернень</th><th>Чистий оборот, грн</th><th>Остання покупка</th></tr></thead>
          <tbody>{data.partners.map(p => <tr key={p.id}><th><Link to={'/accounting/partners/' + p.id}>{p.name}</Link></th><td>{formatValue(p.count)}</td>
            <td>{formatValue(p.returns)}</td><td>{formatValue(p.amount)}</td><td>{p.lastPurchase ?? '—'}</td></tr>)}</tbody></table></div>
        {!data.matches && <p>За цим пошуком контрагентів із продажами не знайдено.</p>}
        {data.matches > 25 && <div className="ba-controls"><Button variant="default" disabled={page <= 1} onClick={() => setPage(page-1)}>Назад</Button>
          <span>{page} / {Math.ceil(data.matches/25)}</span><Button variant="default" disabled={page*25 >= data.matches} onClick={() => setPage(page+1)}>Далі</Button></div>}</>}
    </AnalyticsCard>
  </>
}
