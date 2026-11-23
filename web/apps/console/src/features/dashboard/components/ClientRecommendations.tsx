import { Button, NativeSelect, SegmentedControl, TextInput } from '@mantine/core'
import { IconChevronDown, IconFileText, IconRefresh, IconSearch, IconUsers } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { CalculationInfo } from './CalculationInfo'
import { ACCOUNTING_DOCUMENT_CHANGED, save, useRegister } from '@/shared/api/accounting'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { notifySummaryStale } from '@/shared/lib/events'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { dateLabel, dateRange, formatPrice } from '@/shared/lib/salesFormat'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { DocumentLink } from '@/shared/ui/DocumentLink'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { DashboardState } from './DashboardSkeleton'
import { TableChip } from '@/shared/ui/TableChip'
import { getClientRecommendations, getRecommendationResults, type ClientSuggestion, type RecommendationOffer, type SuggestedClient } from '../api/dashboardApi'
import { RecommendationResults } from './RecommendationResults'
import { defaultRanking } from './RecommendationRankings'
import { numberFormat, PERIODS } from '../lib/insights'
import './client-recommendations.css'

const signals = { due: 'Час повторної покупки', season: 'Купував у цей сезон', repeat: 'Купує повторно', single: 'Уточнити потребу' }
const periods = PERIODS.map(n => ({ value: String(n), label: n + ' днів' }))
const quantityLabel = (value: number, unit: string) => numberFormat.format(value) + ' ' + unit
const views = [{ value: 'clients', label: 'За клієнтами' }, { value: 'stock', label: 'Спільні товари' }]
const workflowViews = [...views, { value: 'offers', label: 'Журнал пропозицій' }]
const statusLabels = { offered: 'Вже запропоновано', reserved: 'Зарезервовано', declined: 'Відмовився', released: 'Резерв знято', fulfilled: 'Відвантажено' }
// Stock kept for an offer without an answer is not a shortage: it is free again as soon as that customer declines.
const waitingReason = (item: ClientSuggestion) => item.held
  ? 'Утримано до відповіді на пропозицію · ' + quantityLabel(item.held, item.unit) : 'Очікує поповнення'

// The quantity of an offer can be changed until the customer answers, and a closed offer can be made again with one.
function QuantityAction({ offer, label, changeOnly, disabled, submit }: {
  offer: RecommendationOffer; label: string; changeOnly?: boolean; disabled: boolean; submit: (quantity: number) => void
}) {
  const [value, setValue] = useState(String(offer.quantity))
  const step = offer.unit === 'шт' ? 1 : 0.001
  const quantity = Number(value)
  const valid = value !== '' && Number.isFinite(quantity) && quantity > 0 && Math.abs(quantity / step - Math.round(quantity / step)) < 1e-6
  return <span className="client-rec-change">
    <input type="number" aria-label={`Кількість, ${offer.unit} · ${offer.name}`} min={step} step={step} max={999999999} value={value}
      disabled={disabled} onChange={event => setValue(event.currentTarget.value)} />
    <Button size="xs" variant="default" disabled={disabled || !valid || (changeOnly && quantity === offer.quantity)}
      onClick={() => submit(quantity)}>{label}</Button>
  </span>
}

type Buyer = { client: SuggestedClient; item: ClientSuggestion }
type ActionProps = { actions: (client: SuggestedClient, item: ClientSuggestion) => ReactNode }

function SharedStock({ clients, actions }: { clients: SuggestedClient[] } & ActionProps) {
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
              <div className="client-rec-facts">
                <TableChip tone={item.signal === 'due' || item.signal === 'season' ? 'success' : 'neutral'} value={signals[item.signal]} />
                {item.dueOn && <TableChip value={'Очікувана дата · ' + dateLabel(item.dueOn)} />}
                {item.seasons > 0 && <TableChip tone="success" value={`Сезонів · ${item.seasons} із 2`} />}
                <TableChip tone="document" value={'Документів · ' + item.purchases} />
              </div>
              <small>Остання покупка {dateLabel(item.last)}</small>
              {!item.offerId && item.quantity < item.requested && <small>{item.quantity ? 'Покрито частково' : waitingReason(item)} · потреба {quantityLabel(item.requested, item.unit)}</small>}
              {actions(client, item)}
            </li>)}</ol>
        </div>
      </details>
    })}
    {matches.length > limit && <Button variant="default" radius="xl" onClick={() => setLimit(n => n + 8)}>Показати ще товари</Button>}
  </>
}

function Suggestion({ item, children }: { item: ClientSuggestion; children: ReactNode }) {
  return <li className="client-rec-item">
    <div className="client-rec-item-main"><div className="client-rec-item-title">
      <Link to={'/catalog/products/' + item.id}>{item.name}</Link>
      <TableChip tone={item.signal === 'due' || item.signal === 'season' ? 'success' : 'neutral'} value={signals[item.signal]} />
    </div>
    <small>{item.sku && <>Арт. {item.sku} · </>}Остання покупка {dateLabel(item.last)}</small>
    <div className="client-rec-facts">
      <TableChip tone="document" value={'Документів продажу · ' + item.purchases} />
      {item.interval != null && <TableChip value={`Звичний інтервал · ${item.interval} дн.`} />}
      {item.seasons > 0 && <TableChip tone="success" value={`Сезонів із покупками · ${item.seasons} із 2`} />}
      <TableChip value={'Після резервів · ' + quantityLabel(item.available, item.unit)} />
      {item.buyers > 1 && <TableChip value={`У черзі · ${item.rank} із ${item.buyers}`} />}
      {item.requested > item.quantity && <TableChip tone="warning" value={'Потреба · ' + quantityLabel(item.requested, item.unit)} />}
    </div></div>
    {(item.quantity > 0 || !item.offerId) && <div className="client-rec-quantity">
      {item.quantity > 0 ? <><span>{item.offerId ? 'Розподілено' : 'До пропозиції'}</span>
        <strong>{formatPrice(item.amount)}</strong><small>{quantityLabel(item.quantity, item.unit)} × {formatPrice(item.price)}</small></>
        : <strong>{waitingReason(item)} · до пропозиції 0 {item.unit}</strong>}
    </div>}
    {children}
  </li>
}

function ClientList({ clients, actions }: { clients: SuggestedClient[] } & ActionProps) {
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
            ? formatPrice(c.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100) : c.items.some(i => i.offerId) ? 'Є запис у журналі' : c.items.some(i => i.held) ? 'Утримано до відповіді' : 'Очікує поповнення'}</span>
          <IconChevronDown size={16} aria-hidden="true" />
        </button></h3>
        <div hidden={!expanded} id={'client-rec-' + c.id}>
          {expanded && <><ul>{c.items.map(item => <Suggestion key={item.id} item={item}>{actions(c, item)}</Suggestion>)}</ul>
            <div className="client-rec-footer"><Link to={'/accounting/partners/' + c.id}>
              <IconFileText size={15} aria-hidden="true" />Документи клієнта</Link></div></>}
        </div>
      </article>
    })}
    {matches.length > limit && <Button variant="default" radius="xl" onClick={() => setLimit(n => n + 8)}>Показати ще клієнтів</Button>}
  </>
}

function InvoiceWarehouse({ create, cancel, disabled }: {
  create: (org: string, store: string) => void; cancel: () => void; disabled: boolean
}) {
  type Ref = { id: string; title: string }
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')
  const [org, setOrg] = useState('')
  const [store, setStore] = useState('')
  if (!refs.data) return <DashboardState kind={refs.status === 'ready' ? 'empty' : refs.status} onRetry={refs.reload} />
  const options = (rows: Ref[]) => [{ value: '', label: 'Виберіть' }, ...rows.map(r => ({ value: r.id, label: r.title }))]
  return <div className="client-rec-actions">
    <NativeSelect label="Організація" value={org} data={options(refs.data.organizations)} onChange={e => setOrg(e.currentTarget.value)} />
    <NativeSelect label="Склад відвантаження" value={store} data={options(refs.data.stores)} onChange={e => setStore(e.currentTarget.value)} />
    <Button size="xs" disabled={disabled || !org || !store} onClick={() => create(org, store)}>Створити чернетку</Button>
    <Button size="xs" variant="default" disabled={disabled} onClick={cancel}>Скасувати</Button>
  </div>
}

export function ClientRecommendations({ opened, onClose, days, setPeriod }: {
  opened: boolean; onClose: () => void; days: number; setPeriod: (value: string) => void
}) {
  const query = useApiQuery('client-recommendations-' + days, () => getClientRecommendations(days), { enabled: opened })
  const report = query.status === 'ready' ? query.data : undefined
  const [view, setView] = useState('clients')
  const [ranking, setRanking] = useState(defaultRanking)
  const journal = view === 'offers'
  const results = useApiQuery('recommendation-results', getRecommendationResults, { enabled: opened && journal })
  const { can } = usePermissions()
  const canEdit = can(PermissionKeys.Accounting.Edit)
  const canReserve = canEdit && can(PermissionKeys.Accounting.Post)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const ids = useRef(new Map<string, string>())
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const [choosingFor, setChoosingFor] = useState<string | null>(null)
  const disabled = saving || query.isFetching
  const reloadOffers = query.reload
  const reloadResults = results.reload
  const reload = useCallback(() => { reloadOffers(); reloadResults() }, [reloadOffers, reloadResults])
  useEffect(() => {
    if (!opened) return
    window.addEventListener(ACCOUNTING_DOCUMENT_CHANGED, reload)
    return () => window.removeEventListener(ACCOUNTING_DOCUMENT_CHANGED, reload)
  }, [opened, reload])

  async function record(path: string, body: unknown, success: string, openInvoice = false) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setNotice('')
    try {
      const result = await save('recommendation-offers/' + path, body, 'PUT')
      setNotice(result.response.ok ? success : problemMessage(result.error, 'Не вдалося зберегти рішення.'))
      if (result.response.ok) {
        notifySummaryStale()
        if (openInvoice && result.data) navigate('/accounting/documents/' + result.data, { state: { documentBackground: location } })
      }
    } catch { setNotice('Не вдалося підтвердити запис. Перевірте журнал перед повтором.') }
    finally { reload(); busy.current = false; setSaving(false) }
  }

  function issue(client: SuggestedClient, item: ClientSuggestion) {
    const key = [client.id, item.id, item.last, item.quantity, item.price, item.unit].join('/')
    const id = ids.current.get(key) ?? crypto.randomUUID()
    ids.current.set(key, id)
    return record(id, { partnerId: client.id, productId: item.id, lastPurchase: item.last, days,
      quantity: item.quantity, unit: item.unit, price: item.price }, 'Пропозицію записано. Очікуємо відповідь клієнта.')
  }

  function decisions(offer: RecommendationOffer) {
    return <div className="client-rec-actions">
      <TableChip value={statusLabels[offer.status] + ' · ' + quantityLabel(offer.quantity, offer.unit)}
        tone={offer.status === 'reserved' || offer.status === 'fulfilled' ? 'success' : 'neutral'} />
      {offer.status === 'offered' && <>
        {canReserve && <Button size="xs" disabled={disabled} onClick={() => record(offer.id + '/accept', {}, 'Погоджену кількість зарезервовано.')}>Погодився · резервувати</Button>}
        {canEdit && <Button size="xs" variant="default" disabled={disabled} onClick={() => record(offer.id + '/decline', {}, 'Відмову записано. Чергу перераховано.')}>Відмовився</Button>}
        {canEdit && <QuantityAction key={offer.id + ':' + offer.quantity} offer={offer} label="Змінити кількість" changeOnly disabled={disabled}
          submit={quantity => record(offer.id + '/quantity', { quantity }, 'Кількість у пропозиції змінено.')} />}
      </>}
      {canEdit && (offer.status === 'declined' || offer.status === 'released') && <QuantityAction key={offer.id + ':' + offer.status + offer.quantity}
        offer={offer} label="Запропонувати знову" disabled={disabled}
        submit={quantity => record(offer.id + '/reopen', { quantity }, 'Пропозицію повернуто за поточною ціною. Очікуємо відповідь клієнта.')} />}
      {canReserve && offer.status === 'reserved' && <Button size="xs" variant="default" disabled={disabled}
        onClick={() => record(offer.id + '/release', {}, 'Резерв знято. Кількість повернуто в розподіл.')}>
        {offer.invoiceId ? 'Скасувати чернетку і зняти резерв' : 'Зняти резерв'}</Button>}
    </div>
  }

  const offers = report?.offers
  const byId = new Map(offers?.map(offer => [offer.id, offer]))
  function actions(client: SuggestedClient, item: ClientSuggestion) {
    if (!offers) return null
    if (item.offerId) {
      const offer = byId.get(item.offerId)
      if (!offer) return null
      // One offer is kept per purchase. A closed one is made again in place instead of adding a second.
      return decisions(offer)
    }
    return canEdit && item.quantity > 0 && <div className="client-rec-actions"><Button size="xs" disabled={disabled}
      onClick={() => issue(client, item)}>Запропонувати</Button></div>
  }
  const method = <CalculationInfo title={journal ? 'Що враховано в журналі пропозицій' : 'Як формуються рекомендації'}>
    {!journal && <>
      <p>Для кожного клієнта показуємо до трьох товарів з його покупок за два роки. Вище стоять товари, для яких наближається звичний строк повторної покупки, далі — покупки у відповідні тижні попередніх років. Якщо покупка була одна, варто уточнити потребу.</p>
      <p>Потреба — середня кількість на документ з урахуванням повернень. Вільний залишок ділимо в порядку черги між активними клієнтами вибраного періоду. За однакової підстави раніше пропонуємо тому, в кого раніше очікується повторна покупка, більше сезонів або документів із товаром, далі — за свіжістю покупки.</p>
    </>}
    {offers && <p>{canEdit && !journal ? 'Після розмови натисніть «Запропонувати», щоб записати клієнта й кількість.' : '«Запропонувати» фіксує розмову з покупцем.'} До відповіді ця кількість закріплена в черзі в усіх періодах. Після згоди створюється складський резерв, після відмови кількість переходить далі. До відповіді кількість можна змінити, а пропозицію після відмови чи знятого резерву — зробити знову: вона повертається за поточною ціною, якщо для неї є вільний залишок. Журнал показує всі відкриті пропозиції й резерви та рішення за вибраний період.</p>}
  </CalculationInfo>
  return <AppEditorModal opened={opened} onClose={onClose} size="standard" className="client-rec-modal"
    title={<MetricLabel icon={IconUsers}>Рекомендації клієнтам</MetricLabel>}>
    <div className="client-rec-panel">
      <div className="client-rec-toolbar"><div className="client-rec-period"><span className="dash-with-info">{journal ? 'Записи журналу за' : 'Клієнти з покупкою за'}{journal && offers && method}</span>
        <SegmentedControl aria-label={journal ? 'Період журналу' : 'Період активності клієнтів'} value={String(days)} data={periods} onChange={setPeriod} /></div>
        {report && <Button size="xs" radius="xl" leftSection={<IconRefresh size={14} />}
          loading={query.isFetching || (journal && results.isFetching)} onClick={reload}>{journal ? 'Оновити журнал' : 'Оновити залишки'}</Button>}
      </div>
      {notice && <p role="status" className="client-rec-notice">{notice}</p>}
      {report && typeof report.offeredClients !== 'number' ? <p role="status">Оновлюється розрахунок спільного залишку.</p> : report ? <>
        {!journal && <div className="client-rec-summary"><h3 className="dash-with-info">Кому запропонувати товар {method}</h3>
          <div><strong>{numberFormat.format(report.offeredClients)}</strong><TableChip value={'із ' + numberFormat.format(report.active) + ' активних клієнтів'} /></div>
          <small>{dateRange(report.start, report.through)}</small></div>}
        {(report.clients.length > 0 || offers) && <SegmentedControl aria-label="Перегляд рекомендацій" data={offers ? workflowViews : views} value={view} onChange={setView} />}
        {view === 'offers' && offers ? <section aria-label="Журнал пропозицій">
          {results.status === 'ready' && results.data ? <RecommendationResults key={days} report={results.data} days={days} ranking={ranking} onRanking={setRanking} /> :
            <DashboardState kind={results.status === 'ready' ? 'empty' : results.status} description={results.status === 'error' ? 'Не вдалося завантажити показники журналу.' : undefined} onRetry={reloadResults} />}
          {offers.length === 0 && <p className="rec-journal-empty">Записаних пропозицій за цей період ще немає.</p>}
          {offers.map(offer => <article className="client-rec-journal" key={offer.id}>
            <strong>{offer.customer}</strong><span>{offer.name}</span>
            <small>Запропоновано {dateLabel(offer.offeredAt.slice(0,10))} · {quantityLabel(offer.quantity, offer.unit)} × {formatPrice(offer.price)}
              {offer.status !== 'offered' && <> · стан змінено {dateLabel(offer.changedAt.slice(0,10))}</>}</small>
            {decisions(offer)}
            {offer.invoiceId ? <DocumentLink id={offer.invoiceId}>
              {offer.status === 'reserved' ? 'Відкрити чернетку' : offer.status === 'released' ? 'Скасована накладна' : 'Проведена накладна'}</DocumentLink>
              : canEdit && offer.status === 'reserved' && (choosingFor === offer.id && !offer.hasWarehouseSource
                ? <InvoiceWarehouse key={offer.id} disabled={disabled} cancel={() => setChoosingFor(null)} create={(organizationId, storeId) =>
                    record(offer.id + '/invoice', { organizationId, storeId }, 'Чернетку створено.', true)} />
                : <div><Button size="xs" disabled={disabled} onClick={() => offer.hasWarehouseSource
                    ? record(offer.id + '/invoice', {}, 'Чернетку створено.', true) : setChoosingFor(offer.id)}>Створити накладну</Button></div>)}
          </article>)}</section>
          : report.clients.length ? view === 'stock' ? <SharedStock key={days} clients={report.clients} actions={actions} />
          : <ClientList key={days} clients={report.clients} actions={actions} /> : <p role="status">{report.active
          ? 'Для цих клієнтів немає раніше придбаних товарів із підтвердженою ціною та вільним залишком.'
          : 'За цей період немає підтверджених покупок із визначеним клієнтом.'}</p>}
      </> : <DashboardState kind={query.status === 'ready' ? 'empty' : query.status}
        description={problemMessage(query.problem, 'Не вдалося завантажити рекомендації.')} onRetry={query.reload} />}
    </div>
  </AppEditorModal>
}
