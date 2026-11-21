import { Button, Loader, SegmentedControl } from '@mantine/core'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { kyivDay } from '@/shared/lib/kyivTime'
import { readBusiness } from '../api/businessAnalytics'
import { IconFileInvoice, IconMap2, IconMapPin, IconReceipt2, IconSearch, IconShoppingBag, IconTrophy, IconUsers, IconWallet } from '@tabler/icons-react'
import { MetricLabel, MetricTile, MetricTrack } from '@/shared/ui/MetricCard'
import { formatValue } from './BusinessForecast'
import shapes from './ukraineRegions.json'
import './buyer-markets.css'

type Period = { count: number; returns: number; amount: number; lastPurchase: string | null }
type Settlement = Period & { code: string; name: string; x: number; y: number }
type Region = Period & { code: string; name: string; settlements: Settlement[] }
type Geography = { unknown: Period; regions: Region[]; withAddress: number }
type Source = 'combined' | 'documents' | 'registered' | 'online'
type Metric = 'count' | 'amount'
type Markets = Record<Source, Geography> & {
  year: number; partnerCount: number; matches: number; excluded: number; unlinked: Period
  partners: (Period & { id: string; name: string })[]
  shipmentLinks?: { ttn: number; number: number; ref: number; ambiguous: number; mapped: number; mappedByRegion: Record<string, number> }
}
const sourceNames: Record<Source, string> = { combined: 'Доставка або адреса покупця', documents: 'Доставка за документами', registered: 'Адреса контрагента', online: 'Доставка вебзамовлень' }
const descriptions: Record<Source, string> = {
  combined: 'Для кожної покупки спочатку враховано місце доставки. Якщо регіон доставки невідомий, використано адресу контрагента. Кожна покупка входить до підсумку один раз.',
  documents: 'Місце доставки з відправлення, накладної або пов’язаного замовлення. Повернення зменшують оборот.',
  registered: 'Продажі за областю з картки контрагента. Ця адреса може відрізнятися від місця доставки.',
  online: 'Оплачені, відвантажені, готові до видачі та завершені вебзамовлення. Місце доставки визначає довідник Нової пошти. Сума відображає вартість замовлень до вирахування повернень.',
}
const metricLabel = (value: number, metric: Metric) => formatValue(value) + (metric === 'amount' ? ' грн' : '')
const colors = ['#d7ebe7', '#98d0bf', '#56af93', '#238267', '#10553e']

const paths: Record<string, { path: string; bounds: number[] }> = shapes

function bestCoveredSource(data: Markets | undefined, regionCode: string): Source {
  const sources: Source[] = ['combined', 'documents', 'registered', 'online']
  let best: Source = 'documents'
  let bestMapped = -1
  let bestKnown = -1
  for (const source of sources) {
    if (!data?.[source]) continue
    const regions = data[source].regions.filter(r => !regionCode || r.code === regionCode)
    const known = regions.reduce((sum, r) => sum + r.count, 0)
    const mapped = regions.reduce((sum, r) => sum + (r.settlements ?? []).reduce((n, p) => n + p.count, 0), 0)
    if (mapped > bestMapped || (mapped === bestMapped && known > bestKnown)) {
      best = source
      bestMapped = mapped
      bestKnown = known
    }
  }
  return best
}

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
    <ul className="market-stats" aria-label="Показники регіону">
      <MetricTile icon={IconShoppingBag} label="Покупок у регіоні"><strong>{formatValue(region.count)}</strong></MetricTile>
      <MetricTile icon={IconWallet} label="Сума у регіоні"><strong>{formatValue(region.amount)} грн</strong></MetricTile>
      <MetricTile icon={IconMapPin} label="Покупок із визначеним населеним пунктом"><strong>{formatValue(known.count)} із {formatValue(region.count)}</strong></MetricTile>
    </ul>
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

function RegionalMap({ data, metric, regionCode, onRegion }: {
  data: Geography; metric: Metric; regionCode: string; onRegion: (code: string) => void
}) {
  const recorded = data.regions.filter(r => r.count || r.returns)
  const ranking = recorded.filter(r => r[metric] > 0).sort((a, b) => b[metric] - a[metric] || a.name.localeCompare(b.name, 'uk'))
  const peak = ranking[0]?.[metric] ?? 0
  const selected = data.regions.find(r => r.code === regionCode)
  const known = recorded.reduce((sum, r) => sum + r.count, 0)
  const total = known + data.unknown.count
  const leaders = ranking.filter(r => r[metric] === peak)
  return <>
    {selected ? <SettlementMap key={selected.code} region={selected} metric={metric} /> : <>
    <ul className="market-stats" aria-label="Географія покупок за рік">
      <MetricTile icon={IconShoppingBag} label="Покупок за рік"><strong>{formatValue(total)}</strong></MetricTile>
      <MetricTile icon={IconMapPin} label="З відомою областю">
        <strong>{formatValue(known)}</strong>
        <MetricTrack value={known} max={total} />
      </MetricTile>
      <MetricTile icon={IconTrophy} label={metric === 'count' ? 'Найбільше покупок' : 'Найбільша сума'}>
        <strong className="market-leaders">{leaders.length ? leaders.map(r => r.name).join(', ') : '—'}</strong>
      </MetricTile>
    </ul>
    <div className="market-geography"><div className="market-figure">
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
    </div>
    <p className="ba-map-legend"><span>Менше</span>{colors.map(c => <i style={{ background: c }} key={c} />)}<span>Більше</span>
      <i style={{ background: '#e9edef' }} /><span>Без додатного значення</span>
      {metric === 'amount' && <><i style={{ background: '#a26154' }} /><span>Від’ємний оборот</span></>}</p>
    </div>
    {recorded.length > 0 && <div className="ba-table"><table><thead><tr><th>Область</th><th>Покупок</th><th>Сума, грн</th></tr></thead>
      <tbody>{[...recorded].sort((a,b) => b[metric]-a[metric]).map(r => <tr key={r.code}>
        <th><button onClick={() => onRegion(r.code)}>{r.name}</button></th><td>{formatValue(r.count)}</td><td>{formatValue(r.amount)}</td></tr>)}</tbody></table></div>}
    </div>
    {!known && <p role="status">{total ? 'У вибраних продажах немає підтвердженої області. Лідера визначити неможливо.' : 'За цей рік у вибраному джерелі немає покупок.'}</p>}
    <p>Регіон невідомий · {formatValue(data.unknown.count)} покупок · {formatValue(data.unknown.amount)} грн.</p>
    </>}
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
  const regionCode = params.get('region') ?? ''
  const metric: Metric = params.get('metric') === 'amount' ? 'amount' : 'count'
  function changeParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (key === 'year' || key === 'partnerSearch') next.delete('partnerPage')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key === 'partnerSearch' })
  }
  const search = (params.get('partnerSearch') ?? '').slice(0, 120)
  const page = Math.max(1, Math.trunc(Number(params.get('partnerPage'))) || 1)
  const args = new URLSearchParams({ analysis: 'markets', year: String(year), page: String(page), search })
  const query = useApiQuery('markets-' + args, () => readBusiness<Markets>('documents', args.toString()), { keepPrevious: true })
  const failed = query.status === 'error' || query.status === 'forbidden'
  const data = !failed && query.data?.year === year ? query.data : undefined
  const source = (rawSource === 'combined' && data?.combined) || rawSource === 'documents' || rawSource === 'registered' || rawSource === 'online'
    ? rawSource : bestCoveredSource(data, regionCode)
  const geography = data?.[source]
  return <div className="buyer-markets">
    <section className="pa-card" aria-labelledby="market-map-title">
      <header className="market-header">
        <h2 id="market-map-title"><MetricLabel icon={IconMap2}>Географія покупок</MetricLabel></h2>
        <label className="market-year">Рік <select aria-label="Рік" value={year} onChange={e => changeParam('year', e.target.value)}>
          {Array.from({ length: latest - 1899 }, (_, i) => latest - i).map(value => <option key={value}>{value}</option>)}
        </select></label>
      </header>
      <div className="market-body">
        <div className="market-controls">
          <label>Джерело адреси<select value={source} onChange={e => changeParam('source', e.target.value)}>
            {Object.entries(sourceNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Регіон<select aria-label="Регіон карти" value={geography?.regions.some(r => r.code === regionCode) ? regionCode : ''}
            disabled={!geography} onChange={e => changeParam('region', e.target.value)}>
            <option value="">Уся Україна</option>{geography?.regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select></label>
          <SegmentedControl aria-label="Показник карти" value={metric} onChange={v => changeParam('metric', v)}
            data={[{ value: 'count', label: 'Кількість покупок' }, { value: 'amount', label: 'Сума, грн' }]} />
        </div>
        {failed ? <div role="alert" className="market-status">{query.problem?.title ?? 'Не вдалося завантажити звіт.'}
          <Button size="xs" variant="default" onClick={query.reload}>Повторити</Button></div>
          : geography ? <RegionalMap key={source + year} data={geography} metric={metric} regionCode={regionCode} onRegion={code => changeParam('region', code)} />
            : <div role="status" className="market-status"><Loader size={16} />Читаємо реєстр продажів…</div>}
        {geography && <details className="market-method"><summary>Як визначено адресу</summary><p>{descriptions[source]}</p>
          {data?.shipmentLinks && (source === 'combined' || source === 'documents') && <p>
            Покупок, нанесених на карту за відправленнями · {formatValue(regionCode && paths[regionCode] ? data.shipmentLinks.mappedByRegion[regionCode] ?? 0 : data.shipmentLinks.mapped)}.
            За рік по Україні пов’язано за ТТН · {formatValue(data.shipmentLinks.ttn)}, за номером замовлення · {formatValue(data.shipmentLinks.number)},
            за ідентифікатором · {formatValue(data.shipmentLinks.ref)}.
            {data.shipmentLinks.ambiguous > 0 && <> Неоднозначних збігів · {formatValue(data.shipmentLinks.ambiguous)}.</>}
          </p>}
        </details>}
      </div>
    </section>
    <section className="pa-card" aria-labelledby="market-partners-title">
      <header className="market-header">
        <h2 id="market-partners-title"><MetricLabel icon={IconUsers}>Покупки контрагентів</MetricLabel></h2>
        <label className="market-search"><IconSearch size={16} aria-hidden="true" />
          <input type="search" aria-label="Пошук контрагента" placeholder="Знайти контрагента…" value={search} maxLength={120}
            onChange={e => changeParam('partnerSearch', e.target.value)} /></label>
      </header>
      <div className="market-body">
        {failed ? <p>Рейтинг контрагентів недоступний.</p>
          : query.isFetching || !data ? <div role="status" className="market-status"><Loader size={16} />Завантажуємо покупки…</div>
          : <>
            <ul className="market-stats" aria-label="Підсумки покупок контрагентів">
              <MetricTile icon={IconFileInvoice} label="Контрагентів із документами"><strong>{formatValue(data.partnerCount)}</strong></MetricTile>
              <MetricTile icon={IconReceipt2} label="Покупок без контрагента"><strong>{formatValue(data.unlinked.count)}</strong></MetricTile>
              <MetricTile icon={IconWallet} label="Їхній чистий оборот"><strong>{formatValue(data.unlinked.amount)} ₴</strong></MetricTile>
            </ul>
            {data.excluded > 0 && <p>Документи з непідтвердженою сумою, валютою або статусом · {formatValue(data.excluded)}.</p>}
            {data.partners.length > 0 ? <div className="ba-table"><table aria-label="Рейтинг контрагентів за чистим оборотом"><thead><tr>
              <th>Контрагент</th><th>Покупок</th><th>Повернень</th><th>Чистий оборот, грн</th><th>Остання покупка</th></tr></thead>
              <tbody>{data.partners.map(p => <tr key={p.id}><th scope="row"><Link to={'/accounting/partners/' + p.id} state={{ marketSearch: params.toString() }}>{p.name}</Link></th>
                <td>{formatValue(p.count)}</td><td>{formatValue(p.returns)}</td><td>{formatValue(p.amount)}</td><td>{p.lastPurchase ?? '—'}</td></tr>)}</tbody>
            </table></div> : <p role="status">{search ? 'За цим пошуком контрагентів не знайдено.' : 'За цей рік немає покупок із прив’язкою до контрагента.'}</p>}
            {data.matches > 25 && <nav className="market-pages" aria-label="Сторінки контрагентів">
              <Button size="xs" variant="default" disabled={page <= 1} onClick={() => changeParam('partnerPage', String(page - 1))}>Назад</Button>
              <span>{page} / {Math.ceil(data.matches / 25)}</span>
              <Button size="xs" variant="default" disabled={page * 25 >= data.matches} onClick={() => changeParam('partnerPage', String(page + 1))}>Далі</Button>
            </nav>}
          </>}
      </div>
    </section>
  </div>
}
