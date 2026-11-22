import { Button, SegmentedControl, TextInput } from '@mantine/core'
import { IconChevronDown, IconRefresh, IconSearch, IconUsers } from '@tabler/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { dateLabel, dateRange, formatPrice } from '@/shared/lib/salesFormat'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { TableChip } from '@/shared/ui/TableChip'
import { getClientRecommendations, type ClientSuggestion, type SuggestedClient } from '../api/dashboardApi'
import { numberFormat, PERIODS } from '../lib/insights'
import './client-recommendations.css'

const signals = { due: 'Час повторної покупки', season: 'Купував у цей сезон', repeat: 'Купує повторно', single: 'Уточнити потребу' }
const periods = PERIODS.map(n => ({ value: String(n), label: n + ' днів' }))
const quantityLabel = (value: number, unit: string) => numberFormat.format(value) + ' ' + unit
const views = [{ value: 'clients', label: 'За клієнтами' }, { value: 'stock', label: 'Спільні товари' }]

type Buyer = { client: SuggestedClient; item: ClientSuggestion }

function SharedStock({ clients }: { clients: SuggestedClient[] }) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(8)
  const products = new Map<string, Buyer[]>()
  for (const client of clients) {
    for (const item of client.items) {
      if (item.buyers <= 1) continue
      const buyers = products.get(item.id) ?? []
      buyers.push({ client, item })
      products.set(item.id, buyers)
    }
  }
  const term = search.trim().toLocaleLowerCase('uk')
  const groups = [...products.values()].map(buyers => {
    buyers.sort((a, b) => a.item.rank - b.item.rank)
    const product = buyers[0].item
    const shortage = buyers.some(b => b.item.quantity < b.item.requested)
    return { product, buyers, shortage }
  }).sort((a, b) => Number(b.shortage) - Number(a.shortage) || b.buyers.length - a.buyers.length ||
    a.product.name.localeCompare(b.product.name, 'uk') || a.product.id.localeCompare(b.product.id))
  const matches = groups.filter(({ product, buyers }) => [product.name, product.sku, ...buyers.map(b => b.client.name)]
    .some(value => value?.toLocaleLowerCase('uk').includes(term)))
  if (!groups.length) return <p role="status">У цьому періоді кожен рекомендований товар має одного покупця.</p>
  return <>
    <TextInput aria-label="Пошук у черзі за товаром або клієнтом" placeholder="Товар, артикул або клієнт" radius="xl"
      leftSection={<IconSearch size={16} />} value={search} onChange={event => { setSearch(event.currentTarget.value); setLimit(8) }} />
    {!matches.length && <p role="status">Збігів за цим пошуком немає.</p>}
    {matches.slice(0, limit).map(({ product, buyers, shortage }, index) => {
      const allocated = buyers.reduce((total, b) => total + b.item.quantity, 0)
      const requested = buyers.reduce((total, b) => total + b.item.requested, 0)
      return <details className="client-rec-stock" key={product.id} open={index === 0}>
        <summary><span><strong>{product.name}</strong><small>{product.sku && <>Арт. {product.sku} · </>}Покупців у черзі {buyers.length}</small></span>
          {shortage && <TableChip value="Бракує запасу" tone="warning" />}
          <IconChevronDown size={16} aria-hidden="true" /></summary>
        <div className="client-rec-stock-body">
          <dl><div><dt>Потреба</dt><dd>{quantityLabel(requested, product.unit)}</dd></div>
            <div><dt>Після резервів</dt><dd>{quantityLabel(product.available, product.unit)}</dd></div>
            <div><dt>Розподілено</dt><dd>{quantityLabel(allocated, product.unit)}</dd></div></dl>
          <ol aria-label={'Черга покупців — ' + product.name}>{buyers.map(({ client, item }) =>
            <li key={client.id}><div><Link to={'/accounting/partners/' + client.id}>{client.name}</Link>
              <strong>{quantityLabel(item.quantity, item.unit)}</strong></div>
              <small>{signals[item.signal]}{item.dueOn && <> · очікувана дата {dateLabel(item.dueOn)}</>}
                {item.seasons > 0 && <> · сезонів {item.seasons} із 2</>}
                {' · документів '}{item.purchases}{' · остання покупка '}{dateLabel(item.last)}</small>
              {item.quantity < item.requested && <small>{item.quantity ? 'Покрито частково' : 'Очікує поповнення'} · потреба {quantityLabel(item.requested, item.unit)}</small>}
            </li>)}</ol>
        </div>
      </details>
    })}
    {matches.length > limit && <Button variant="default" radius="xl" onClick={() => setLimit(n => n + 8)}>Показати ще товари</Button>}
  </>
}

function Suggestion({ item }: { item: ClientSuggestion }) {
  return <li className="client-rec-item">
    <div className="client-rec-item-title">
      <Link to={'/catalog/products/' + item.id}>{item.name}</Link>
      <TableChip tone={item.signal === 'due' ? 'success' : 'neutral'} value={signals[item.signal]} />
    </div>
    <p>{item.sku && <>Арт. {item.sku} · </>}Документів продажу з товаром — {item.purchases}. Остання покупка {dateLabel(item.last)}
      {item.interval != null && <> Звичний інтервал — {item.interval} дн.</>}
      {item.seasons > 0 && <> Купував у відповідні тижні минулих років ({item.seasons} із 2).</>}</p>
    <div className="client-rec-quantity">
      {item.quantity > 0 ? <><span>Запропонувати <b>{quantityLabel(item.quantity, item.unit)}</b> × {formatPrice(item.price)}</span>
        <strong>{formatPrice(item.amount)}</strong></> : <strong>Очікує поповнення · до пропозиції 0 {item.unit}</strong>}
    </div>
    <small>{item.buyers > 1 && <>У черзі {item.rank} із {item.buyers} · </>}
      {item.requested > item.quantity && <>Потреба {quantityLabel(item.requested, item.unit)} · </>}
      Доступно після резервів · {quantityLabel(item.available, item.unit)}</small>
  </li>
}

function ClientList({ clients }: { clients: SuggestedClient[] }) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(8)
  const [selected, setSelected] = useState<string | null>(clients[0]?.id ?? null)
  const term = search.trim().toLocaleLowerCase('uk')
  const matches = clients.filter(c => c.name.toLocaleLowerCase('uk').includes(term) ||
    c.items.some(i => (i.name + ' ' + i.sku).toLocaleLowerCase('uk').includes(term)))
  return <>
    <TextInput aria-label="Пошук клієнта або товару" placeholder="Клієнт, товар або артикул" radius="xl"
      leftSection={<IconSearch size={16} />} value={search} onChange={event => { setSearch(event.currentTarget.value); setLimit(8) }} />
    {matches.length === 0 && <p role="status">Збігів за цим пошуком немає.</p>}
    {matches.slice(0, limit).map(c => {
      const expanded = selected === c.id
      return <article className="client-rec-card" key={c.id}>
        <h3><button type="button" aria-expanded={expanded} aria-controls={'client-rec-' + c.id}
          onClick={() => setSelected(expanded ? null : c.id)}>
          <span>{c.name}<small>Остання покупка {dateLabel(c.lastSale)}</small></span>
          <span className="client-rec-total">{c.items.some(i => i.quantity > 0)
            ? formatPrice(c.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100) : 'Очікує поповнення'}</span>
          <IconChevronDown size={16} aria-hidden="true" />
        </button></h3>
        <div hidden={!expanded} id={'client-rec-' + c.id}>
          {expanded && <><ul>{c.items.map(item => <Suggestion key={item.id} item={item} />)}</ul>
            <Link className="client-rec-profile" to={'/accounting/partners/' + c.id}>Документи клієнта</Link></>}
        </div>
      </article>
    })}
    {matches.length > limit && <Button variant="default" radius="xl" onClick={() => setLimit(n => n + 8)}>Показати ще клієнтів</Button>}
  </>
}

export function ClientRecommendations({ opened, onClose, days, setPeriod }: {
  opened: boolean; onClose: () => void; days: number; setPeriod: (value: string) => void
}) {
  const query = useApiQuery('client-recommendations-' + days, () => getClientRecommendations(days), { enabled: opened })
  const report = query.status === 'ready' ? query.data : undefined
  const [view, setView] = useState('clients')
  return <AppEditorModal opened={opened} onClose={onClose} size="standard" className="client-rec-modal"
    title={<MetricLabel icon={IconUsers}>Рекомендації клієнтам</MetricLabel>}>
    <div className="client-rec-panel">
      <div className="client-rec-toolbar"><span>Клієнти з покупкою за</span>
        <SegmentedControl aria-label="Період активності клієнтів" value={String(days)} data={periods} onChange={setPeriod} />
        {report && <Button variant="default" size="xs" radius="xl" leftSection={<IconRefresh size={14} />}
          loading={query.isFetching} onClick={query.reload}>Оновити залишки</Button>}
      </div>
      {report && typeof report.offeredClients !== 'number' ? <p role="status">Оновлюється розрахунок спільного залишку.</p> : report ? <>
        <div className="client-rec-summary"><h3>Кому запропонувати товар</h3>
          <strong>{numberFormat.format(report.offeredClients)} із {numberFormat.format(report.active)} активних клієнтів</strong>
          <small>{dateRange(report.start, report.through)}</small></div>
        {report.clients.length ? <><SegmentedControl aria-label="Перегляд рекомендацій" data={views} value={view} onChange={setView} />
          {view === 'stock' ? <SharedStock key={days} clients={report.clients} /> : <ClientList key={days} clients={report.clients} />}</> : <p role="status">{report.active
          ? 'Для цих клієнтів немає раніше придбаних товарів із підтвердженою ціною та вільним залишком.'
          : 'За цей період немає підтверджених покупок із визначеним клієнтом.'}</p>}
        <details className="client-rec-method"><summary>Як формуються рекомендації</summary>
          <p>Для кожного клієнта показуємо до трьох товарів з його покупок за два роки. Вище стоять товари, для яких наближається звичний строк повторної покупки, далі — покупки у відповідні тижні попередніх років. Якщо покупка була одна, варто уточнити потребу.</p>
          <p>Потреба — середня кількість на документ з урахуванням повернень. Вільний залишок ділимо в порядку черги між активними клієнтами вибраного періоду. За однакової підстави раніше пропонуємо тому, в кого раніше очікується повторна покупка, більше сезонів або документів із товаром, далі — за свіжістю покупки.</p>
          <p>Кожен отримує до своєї потреби. Коли запас вичерпано, наступні покупці очікують поповнення. Суму рахуємо за виділеною кількістю та поточною ціною. Фактичне резервування відбувається окремо.</p>
        </details>
      </> : <PageState kind={query.status === 'ready' ? 'loading' : query.status}
        description={problemMessage(query.problem, 'Не вдалося завантажити рекомендації.')} onRetry={query.reload} />}
    </div>
  </AppEditorModal>
}
