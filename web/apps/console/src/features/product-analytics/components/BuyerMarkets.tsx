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
type Settlement = Period & { code: string; name: string; x: number; y: number }
type Region = Period & { code: string; name: string; settlements: Settlement[] }
type Geography = { unknown: Period; regions: Region[]; withAddress: number }
type Source = 'documents' | 'registered' | 'online'
type Metric = 'count' | 'amount'
type Markets = Record<Source, Geography> & {
  year: number; partnerCount: number; matches: number; excluded: number; unlinked: Period
  partners: (Period & { id: string; name: string })[]
}
const sourceNames: Record<Source, string> = { documents: 'Доставка за документами', registered: 'Адреса контрагента', online: 'Доставка вебзамовлень' }
const descriptions: Record<Source, string> = {
  documents: 'Місце доставки з документа продажу або пов’язаного замовлення. Повернення зменшують оборот.',
  registered: 'Продажі за областю з картки контрагента. Ця адреса може відрізнятися від місця доставки.',
  online: 'Оплачені, відвантажені, готові до видачі та завершені вебзамовлення. Місце доставки визначає довідник Нової пошти. Сума відображає вартість замовлень до вирахування повернень.',
}
const metricLabel = (value: number, metric: Metric) => formatValue(value) + (metric === 'amount' ? ' грн' : '')
const colors = ['#d7ebe7', '#98d0bf', '#56af93', '#238267', '#10553e']

const paths: Record<string, { path: string; bounds: number[] }> = shapes

function SettlementMap({ region, metric }: { region: Region; metric: Metric }) {
  const [selected, setSelected] = useState('')
  const points = [...(region.settlements ?? [])].sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'uk') || a.code.localeCompare(b.code))
  const plotted = points.filter(p => p[metric] > 0)
  const peak = plotted[0]?.[metric] ?? 0
  const active = points.find(p => p.code === selected) ?? plotted[0]
  const known = points.reduce((totals, p) => ({ count: totals.count + p.count, amount: totals.amount + p.amount }), { count: 0, amount: 0 })
  const { path, bounds } = paths[region.code]
  const maxRadius = Math.min(bounds[2], bounds[3]) * .045
  return <>
    <div className="ba-kpis"><div>Покупок у регіоні<strong>{formatValue(region.count)}</strong></div>
      <div>Сума у регіоні<strong>{formatValue(region.amount)} грн</strong></div>
      <div>Покупок із визначеним населеним пунктом<strong>{formatValue(known.count)} із {formatValue(region.count)}</strong></div></div>
    <div className="ba-market-map ba-locality-map">
      <svg viewBox={bounds.join(' ')} aria-label={'Населені пункти · ' + region.name} role="group">
        <path d={path} fill="#e8f3ed" stroke="#82a695" strokeWidth={1.3} vectorEffect="non-scaling-stroke" fillRule="evenodd" />
        {plotted.map(p => <circle key={p.code} cx={p.x} cy={p.y} r={maxRadius * Math.sqrt(p[metric] / peak)}
          fill={active?.code === p.code ? '#075942' : '#249574'} fillOpacity={.76} stroke="#fff" strokeWidth={1}
          vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-pressed={active?.code === p.code}
          aria-label={p.name + ' · ' + metricLabel(p[metric], metric)} onClick={() => setSelected(p.code)}
          onFocus={() => setSelected(p.code)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(p.code) } }}>
          <title>{p.name} · {metricLabel(p[metric], metric)}</title></circle>)}
      </svg>
      <div className="ba-market-region" aria-live="polite">
        {active && <><strong>{active.name}</strong><span>{formatValue(active.count)} покупок · {formatValue(active.returns)} повернень</span>
          <span>{formatValue(active.amount)} грн</span></>}
        {peak > 0 ? <span>Площа круга відповідає {metric === 'count' ? 'кількості покупок' : 'сумі у гривнях'}. Найбільший круг · {metricLabel(peak, metric)}.</span>
          : <span>{points.length ? 'У визначених населених пунктах немає додатного значення для цього показника.'
            : region.count || region.returns ? 'Область відома, але в цих продажах не вдалося визначити населений пункт.'
              : 'У цьому джерелі за вибраний рік немає продажів із підтвердженою прив’язкою до регіону.'}</span>}
      </div>
    </div>
    {points.length > 0 && <div className="ba-table"><table><thead><tr><th>Населений пункт</th><th>Покупок</th><th>Повернень</th><th>Сума, грн</th></tr></thead>
      <tbody>{points.map(p => <tr key={p.code}><th><button type="button" aria-pressed={active?.code === p.code} onClick={() => setSelected(p.code)}>{p.name}</button></th>
        <td>{formatValue(p.count)}</td><td>{formatValue(p.returns)}</td><td>{formatValue(p.amount)}</td></tr>)}</tbody></table></div>}
    <p>Область відома, населений пункт не визначено · {formatValue(region.count - known.count)} покупок · {formatValue(region.amount - known.amount)} грн.</p>
  </>
}

function RegionalMap({ data, source, metric, regionCode, onRegion }: {
  data: Geography; source: Source; metric: Metric; regionCode: string; onRegion: (code: string) => void
}) {
  const recorded = data.regions.filter(r => r.count || r.returns)
  const ranking = recorded.filter(r => r[metric] > 0).sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'uk'))
  const peak = ranking[0]?.[metric] ?? 0
  const selected = data.regions.find(r => r.code === regionCode)
  const active = ranking[0]
  const known = recorded.reduce((sum, r) => sum + r.count, 0)
  const total = known + data.unknown.count
  const leaders = ranking.filter(r => r[metric] === peak)
  return <>
    <p>{descriptions[source]}</p>
    <label className="ba-map-selector">Регіон <select aria-label="Регіон карти" value={selected?.code ?? ''} onChange={e => onRegion(e.target.value)}>
      <option value="">Уся Україна</option>{data.regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></label>
    {selected ? <SettlementMap key={selected.code} region={selected} metric={metric} /> : <>
    <div className="ba-kpis"><div>Продажів із відомою областю<strong>{formatValue(known)} із {formatValue(total)}</strong></div>
      <div>{metric === 'count' ? 'Найбільше покупок' : 'Найбільша сума'}<strong>{leaders.length ? leaders.map(r => r.name).join(', ') : 'Бракує даних'}</strong></div></div>
    <div className="ba-market-map">
      <svg viewBox="-12 42 1035 706" aria-label="Карта покупок за областями України" role="group">
        {data.regions.map(r => {
          const color = r[metric] > 0 && peak ? colors[Math.min(4, Math.floor(5*r[metric]/peak))] : r.amount < 0 && metric === 'amount' ? '#a26154' : '#e9edef'
          return <path key={r.code} d={paths[r.code].path} fillRule="evenodd" fill={color} stroke="#fff"
            strokeWidth={1} tabIndex={0} role="button"
            aria-label={r.name + ' · ' + metricLabel(r[metric], metric)} onClick={() => onRegion(r.code)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRegion(r.code) } }}>
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
        <th><button onClick={() => onRegion(r.code)}>{r.name}</button></th><td>{formatValue(r.count)}</td><td>{formatValue(r.amount)}</td></tr>)}</tbody></table></div>}</>}
    {selected && data.unknown.count > 0 && <p>Ще {formatValue(data.unknown.count)} покупок у цьому джерелі за рік мають невідому область.</p>}
    {total > 0 && data.withAddress === 0 && <p>За вибраний рік у джерелі немає адреси чи населеного пункту для жодної покупки.</p>}
    <small>Геодані · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
      {' · '}<a href="https://www.geoboundaries.org/">geoBoundaries</a>{' · '}<a href="https://github.com/alexbabintsev/ua-geo">КАТОТТГ / ua-geo</a></small>
  </>
}

export function BuyerMarkets() {
  const [params, setParams] = useSearchParams()
  const latest = Number(kyivDay(new Date()).slice(0, 4))
  const chosen = Number(params.get('year') ?? latest)
  const year = Number.isInteger(chosen) && chosen >= 1900 && chosen <= latest ? chosen : latest
  const rawSource = params.get('source')
  const source: Source = rawSource === 'registered' || rawSource === 'online' ? rawSource : 'documents'
  const metric: Metric = params.get('metric') === 'amount' ? 'amount' : 'count'
  function changeParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const args = new URLSearchParams({ analysis: 'markets', year: String(year), page: String(page), search })
  const query = useApiQuery('markets-' + args, () => readBusiness<Markets>('documents', args.toString()))
  const data = query.data
  return <>
    <AnalyticsCard title="Географія покупок" actions={<label>Рік <input type="number" min={1900} max={latest}
      defaultValue={year} key={year} onBlur={e => { const v = e.currentTarget.valueAsNumber
        if (Number.isInteger(v) && v >= 1900 && v <= latest) { setPage(1); changeParam('year', String(v)) } }} /></label>}>
      <div className="ba-controls"><label>Джерело адреси<select value={source} onChange={e => changeParam('source', e.target.value)}>
        {Object.entries(sourceNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <SegmentedControl aria-label="Показник карти" value={metric} onChange={v => changeParam('metric', v)}
          data={[{ value: 'count', label: 'Кількість покупок' }, { value: 'amount', label: 'Сума, грн' }]} /></div>
      {data ? <RegionalMap key={source + year} data={data[source]} source={source} metric={metric} regionCode={params.get('region') ?? ''} onRegion={code => changeParam('region', code)} />
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
