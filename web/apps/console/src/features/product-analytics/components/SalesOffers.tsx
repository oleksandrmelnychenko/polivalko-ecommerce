import { Button, Select, Textarea, TextInput } from '@mantine/core'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { problemTitle } from '@polivalko/shared/api/problem'
import { usePermissions } from '@/features/auth'
import { save, useRegister, type Page, type Partner } from '@/shared/api/accounting'
import { apiFetch } from '@/shared/api/client'
import { withCsrf } from '@/shared/api/csrf'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { kyivDay } from '@/shared/lib/kyivTime'
import { AnalyticsCard } from './AnalyticsCard'

type Focus = 'general' | 'irrigation'
type Draft = { mode: string; name: string; intro: string; items: {
  id: string; name: string; price: number; available: number; purchases: number; related: boolean
}[] }
export type Offer = { id: string; partner: string; day: string; body: string; focus: Focus;
  shipments: number; shipped: number; invoiceNumbers: string | null }
type Invoice = { id: string; number: string | null; day: string; amount: number }
export const uah = (amount: number | null) => amount === null ? '—' :
  amount.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 2 })

function Compose({ partner, focus, onIssued }: { partner: string; focus: Focus; onIssued: () => void }) {
  const [draft, setDraft] = useState<Draft>()
  const [body, setBody] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const invalidQuantity = draft?.items.some(i => !Number.isFinite(Number(quantities[i.id])) || Number(quantities[i.id]) <= 0 || Number(quantities[i.id]) > i.available)
  const lines = draft?.items.map(i => ({ ...i, qty: Number(quantities[i.id] || 0),
    sum: Math.round(i.price * Number(quantities[i.id] || 0) * 100) / 100 })) ?? []
  const total = lines.reduce((sum, i) => sum + i.sum, 0)
  const finalText = [body.trim(), ...lines.map(i => i.name + ' · ' + i.qty + ' × ' + uah(i.price) + ' = ' + uah(i.sum)),
    ...(lines.length ? ['Разом ' + uah(total)] : [])].join('\n\n')
  const [day, setDay] = useState(kyivDay(new Date()))
  const [issueId, setIssueId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function generate() {
    setBusy(true)
    setMessage('')
    try {
      const result = await withCsrf(async headers => {
        const response = await apiFetch('/api/v1/console/business-analytics/offer-draft?' +
          new URLSearchParams({ partner, focus }), { method: 'POST', headers })
        const payload = await response.json()
        return response.ok ? { data: payload as Draft } : { error: payload }
      })
      if (!result.data) throw new Error(result.error?.title ?? 'Помилка генерації')
      const next = result.data
      setDraft(next)
      setIssueId(crypto.randomUUID())
      setQuantities(Object.fromEntries(next.items.map(i => [i.id, String(Math.min(i.available, 1))])))
      setBody('Для ' + next.name + '\n\n' + next.intro)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Сервіс недоступний') }
    finally { setBusy(false) }
  }
  async function record() {
    setBusy(true)
    setMessage('')
    try {
      const result = await save('offers/' + issueId, { partnerId: partner, day, focus, body: finalText }, 'PUT')
      if (!result.response.ok) throw new Error(problemTitle(result.error, 'Не вдалося зареєструвати пропозицію'))
      setDraft(undefined)
      setBody('')
      setMessage('Видану пропозицію зареєстровано.')
      onIssued()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не вдалося зберегти') }
    finally { setBusy(false) }
  }
  return <div className="winter-stack">
    <Button variant="default" loading={busy} onClick={generate}>{draft ? 'Створити іншу чернетку' : 'Підготувати пропозицію'}</Button>
    {!draft && <Button variant="subtle" disabled={busy} onClick={() => {
      setDraft({ mode: 'manual', name: '', intro: '', items: [] })
      setBody('')
      setIssueId(crypto.randomUUID())
      setMessage('')
    }}>Внести готовий розрахунок</Button>}
    {draft && <>
      <p>{draft.mode === 'manual' ? 'Введіть текст і суму вже підготовленого розрахунку.' : draft.mode === 'ai' ? 'Чернетку підготував ШІ.' : draft.mode === 'catalog'
        ? 'Каталожна чернетка. Для генерації ШІ налаштуйте модель і серверний ключ.'
        : 'Модель тимчасово недоступна. Підготовлено каталожну чернетку.'}</p>
      {lines.map(i => <TextInput key={i.id} type="number" min="0.001" step="0.001" max={i.available}
        label={i.name + ' · ' + uah(i.price) + ' за одиницю'} description={'Доступно ' + i.available + ' · ' +
          (i.purchases ? 'покупок цієї позиції: ' + i.purchases : i.related ? 'раніше купував цю категорію' : 'з доступного асортименту')}
        value={quantities[i.id] ?? ''} onChange={e => setQuantities({ ...quantities,[i.id]:e.currentTarget.value })} />)}
      {lines.length > 0 && <strong>{invalidQuantity ? 'Перевірте кількість і залишок.' : 'Разом ' + uah(total)}</strong>}
      <Textarea autosize minRows={5} maxLength={8000} label="Текст для контрагента" value={body} onChange={e => setBody(e.currentTarget.value)} />
      <TextInput type="date" label="Дата видачі пропозиції" value={day} max={kyivDay(new Date())} onChange={e => setDay(e.currentTarget.value)} />
      <Button variant="default" disabled={!body.trim() || invalidQuantity} onClick={async () => {
        try { await navigator.clipboard.writeText(finalText); setMessage('Текст пропозиції скопійовано.') }
        catch { setMessage('Копіювання недоступне в цьому браузері.') }
      }}>Скопіювати пропозицію</Button>
      <Button disabled={!body.trim() || finalText.length > 8000 || invalidQuantity || !day || busy} onClick={record}>Зареєструвати видану пропозицію</Button>
    </>}
    {message && <p role="status">{message}</p>}
  </div>
}

function LinkInvoice({ offer, changed }: { offer: string; changed: () => void }) {
  const result = useRegister<Invoice[]>('offers/' + offer + '/invoices')
  const [invoice, setInvoice] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function link() {
    if (!invoice) return
    setBusy(true)
    try {
      const r = await save('offers/' + offer + '/invoices/' + invoice, {}, 'PUT')
      if (!r.response.ok) throw new Error(problemTitle(r.error, 'Не вдалося прив’язати накладну'))
      setInvoice(null)
      setMessage('Відвантаження прив’язано.')
      changed()
      result.reload()
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Помилка збереження') }
    finally { setBusy(false) }
  }
  return <div className="winter-stack">
    {result.status === 'error' || result.status === 'forbidden' ? <Button variant="default" onClick={result.reload}>Повторити завантаження накладних</Button>
      : <Select searchable label="Видаткова накладна контрагента" value={invoice} onChange={setInvoice}
        placeholder={result.isFetching ? 'Завантаження…' : 'Оберіть накладну'} nothingFoundMessage="Немає відповідних накладних"
        data={(result.data ?? []).map(d => ({ value: d.id, label: (d.number ?? d.id) + ' · ' + d.day + ' · ' + uah(d.amount) }))} />}
    <Button variant="default" disabled={!invoice || busy} onClick={link}>Прив’язати відвантаження</Button>
    {message && <p role="status">{message}</p>}
  </div>
}

export function OfferLedger({ rows, changed }: { rows: Offer[]; changed: () => void }) {
  const { can } = usePermissions()
  const [opened, setOpened] = useState('')
  if (!rows.length) return <p>За вибраний період немає зареєстрованих пропозицій.</p>
  return <div>{rows.map(o => <details key={o.id} onToggle={e => { if (e.currentTarget.open) setOpened(o.id) }}>
    <summary>{o.day} · {o.partner} · {o.shipments ? 'Є відвантаження · ' + uah(o.shipped) : 'Очікує відвантаження'}</summary>
    <p style={{ whiteSpace: 'pre-wrap' }}>{o.body}</p>
    {o.invoiceNumbers && <p>Видаткові накладні · {o.invoiceNumbers}</p>}
    {can(PermissionKeys.Accounting.Edit) && opened === o.id && <LinkInvoice offer={o.id} changed={changed} />}
  </details>)}</div>
}

export function SalesOffers() {
  const [params] = useSearchParams()
  const [partner, setPartner] = useState<string | null>(params.get('partner'))
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState<Focus>('general')
  const { can } = usePermissions()
  const today = kyivDay(new Date())
  const [from, setFrom] = useState(today.slice(0,7) + '-01')
  const [to, setTo] = useState(today)
  const partners = useRegister<Page<Partner>>('partners?q=' + encodeURIComponent(search))
  const direct = useRegister<{ partner: Partner }>('partners/' + partner, Boolean(partner))
  const options = new Map((partners.data?.items ?? []).map(p => [p.id,p.title]))
  if (direct.data) options.set(direct.data.partner.id,direct.data.partner.title)
  const history = useRegister<Offer[]>('offers?' + new URLSearchParams({ from,to }), Boolean(from && to && from <= to))
  return <div className="winter-stack">
    {can(PermissionKeys.Accounting.Edit) && <AnalyticsCard title="Пропозиція для контрагента">
      <div className="winter-stack">
        <Select searchable clearable label="Контрагент" placeholder="Знайдіть за назвою" value={partner}
          onChange={setPartner} onSearchChange={setSearch} data={[...options].map(([value,label]) => ({value,label}))}
          nothingFoundMessage="Контрагента не знайдено" />
        {partners.status === 'error' && <Button variant="default" onClick={partners.reload}>Оновити довідник</Button>}
        <Select label="Напрям пропозиції" value={focus} allowDeselect={false} data={[{value:'general',label:'Асортимент для клієнта'},
          {value:'irrigation',label:'Комплектація поливу'}]} onChange={v => setFocus(v === 'irrigation' ? v : 'general')} />
        {partner && <Compose key={partner + focus} partner={partner} focus={focus} onIssued={history.reload} />}
      </div>
    </AnalyticsCard>}
    <AnalyticsCard title="Видані пропозиції">
      <div className="ba-controls"><TextInput type="date" label="Від" value={from} max={to} onChange={e => setFrom(e.currentTarget.value)} />
        <TextInput type="date" label="До" value={to} min={from} onChange={e => setTo(e.currentTarget.value)} /></div>
      {history.data ? <OfferLedger rows={history.data} changed={history.reload} /> : history.isFetching ? <p>Завантаження…</p> :
        <p role="status">{history.problem?.title ?? 'Перевірте період до одного року.'} <button onClick={history.reload}>Оновити</button></p>}
    </AnalyticsCard>
  </div>
}
