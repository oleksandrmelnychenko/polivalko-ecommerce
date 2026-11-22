import { Button, SegmentedControl, TextInput } from '@mantine/core'
import { IconChevronDown, IconSearch, IconUsers } from '@tabler/icons-react'
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

function Suggestion({ item }: { item: ClientSuggestion }) {
  return <li className="client-rec-item">
    <div className="client-rec-item-title">
      <Link to={'/catalog/products/' + item.id}>{item.name}</Link>
      <TableChip tone={item.signal === 'due' ? 'success' : 'neutral'} value={signals[item.signal]} />
    </div>
    <p>{item.sku && <>Арт. {item.sku} · </>}Документів продажу з товаром — {item.purchases}. Остання покупка {dateLabel(item.last)}.
      {item.interval != null && <> Звичний інтервал — {item.interval} дн.</>}
      {item.seasons > 0 && <> Купував у відповідні тижні минулих років ({item.seasons} із 2).</>}</p>
    <div className="client-rec-quantity">
      <span>Запропонувати <b>{numberFormat.format(item.quantity)} {item.unit}</b> × {formatPrice(item.price)}</span>
      <strong>{formatPrice(item.amount)}</strong>
    </div>
    <small>Доступно після резервів · {numberFormat.format(item.available)} {item.unit}</small>
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
          <span className="client-rec-total">{formatPrice(c.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100)}</span>
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
  return <AppEditorModal opened={opened} onClose={onClose} size="standard" className="client-rec-modal"
    title={<MetricLabel icon={IconUsers}>Рекомендації клієнтам</MetricLabel>}>
    <div className="client-rec-panel">
      <div className="client-rec-toolbar"><span>Клієнти з покупкою за</span>
        <SegmentedControl aria-label="Період активності клієнтів" value={String(days)} data={periods} onChange={setPeriod} />
      </div>
      {report ? <>
        <div className="client-rec-summary"><h3>Кому запропонувати товар</h3>
          <strong>{numberFormat.format(report.clients.length)} із {numberFormat.format(report.active)} активних клієнтів</strong>
          <small>{dateRange(report.start, report.through)}</small></div>
        {report.clients.length ? <ClientList key={days} clients={report.clients} /> : <p role="status">{report.active
          ? 'Для цих клієнтів немає раніше придбаних товарів із підтвердженою ціною та вільним залишком.'
          : 'За цей період немає підтверджених покупок із визначеним клієнтом.'}</p>}
        <details className="client-rec-method"><summary>Як формуються рекомендації</summary>
          <p>Для кожного клієнта показуємо до трьох товарів з його покупок за два роки. Вище стоять товари, для яких наближається звичний строк повторної покупки, далі — покупки у відповідні тижні попередніх років. Якщо покупка була одна, варто уточнити потребу.</p>
          <p>Кількість — середня на документ після вирахування повернень, у межах доступного залишку. Сума розрахована за поточною ціною каталогу. Кожна пропозиція використовує залишок незалежно від інших.</p>
        </details>
      </> : <PageState kind={query.status === 'ready' ? 'loading' : query.status}
        description={problemMessage(query.problem, 'Не вдалося завантажити рекомендації.')} onRetry={query.reload} />}
    </div>
  </AppEditorModal>
}
