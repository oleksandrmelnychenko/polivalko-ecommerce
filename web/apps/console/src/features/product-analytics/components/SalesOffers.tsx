import { Button, Select, Textarea, TextInput } from '@mantine/core'
import { IconChevronRight, IconCopy, IconFileInvoice, IconFileText, IconPlus, IconSend } from '@tabler/icons-react'
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
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { TableChip } from '@/shared/ui/TableChip'
import { dateLabel } from '@/shared/lib/salesFormat'
import './sales-offers.css'

type Focus = 'general' | 'irrigation'
type Draft = { mode: string; basis?: string; name: string; intro: string; items: {
  id: string; name: string; price: number; available: number; purchases: number; related: boolean; reason?: string
}[] }
export type Offer = { id: string; partner: string; day: string; body: string; focus: Focus;
  shipments: number; shipped: number; invoiceNumbers: string | null }
type Invoice = { id: string; number: string | null; day: string; amount: number }
export const uah = (amount: number | null) => amount === null ? '—' :
  amount.toLocaleString('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 2 })

function Compose({ initialPartner, opened, onClose, onIssued }: { initialPartner: string | null; opened: boolean; onClose: () => void; onIssued: (day: string) => void }) {
  const [partner, setPartner] = useState(initialPartner)
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState<Focus>('general')
  const [method, setMethod] = useState('statistics')
  const partners = useRegister<Page<Partner>>('partners?q=' + encodeURIComponent(search), opened)
  const direct = useRegister<{ partner: Partner }>('partners/' + partner, opened && Boolean(partner))
  const options = new Map((partners.data?.items ?? []).map(p => [p.id,p.title]))
  if (direct.data) options.set(direct.data.partner.id,direct.data.partner.title)
  const [draft, setDraft] = useState<Draft>()
  const [body, setBody] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const invalidQuantity = draft?.items.some(i => !Number.isFinite(Number(quantities[i.id])) || Number(quantities[i.id]) <= 0 || Number(quantities[i.id]) > i.available)
  const lines = draft?.items.map(i => ({ ...i, qty: Number(quantities[i.id] || 0),
    sum: Math.round(i.price * Number(quantities[i.id] || 0) * 100) / 100 })) ?? []
  const total = lines.reduce((sum, i) => sum + i.sum, 0)
  const offerTotal = lines.length ? total : draft?.mode === 'manual' && manualAmount !== '' ? Number(manualAmount) : null
  const invalidTotal = offerTotal != null && (!Number.isFinite(offerTotal) || offerTotal < 0)
  const finalText = [body.trim(), ...lines.map(i => i.name + ' · ' + i.qty + ' × ' + uah(i.price) + ' = ' + uah(i.sum)),
    ...(offerTotal != null ? ['Разом ' + uah(offerTotal)] : [])].join('\n\n')
  const [day, setDay] = useState(kyivDay(new Date()))
  const [issueId, setIssueId] = useState('')
  const [pending, setPending] = useState<'draft' | 'issue' | null>(null)
  const busy = pending !== null
  const [message, setMessage] = useState('')
  async function generate() {
    if (!partner) return
    setPending('draft')
    setMessage('')
    try {
      const result = await withCsrf(async headers => {
        const response = await apiFetch('/api/v1/console/business-analytics/offer-draft?' +
          new URLSearchParams({ partner, focus, method }), { method: 'POST', headers })
        const payload = await response.json().catch(() => undefined)
        return response.ok ? { data: payload as Draft } : { error: payload }
      })
      if (!result.data) throw new Error(result.error?.title ?? 'Помилка генерації')
      const next = result.data
      setDraft(next)
      setIssueId(crypto.randomUUID())
      setQuantities(Object.fromEntries(next.items.map(i => [i.id, String(Math.min(i.available, 1))])))
      setBody('Для ' + next.name + '\n\n' + next.intro)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Сервіс недоступний') }
    finally { setPending(null) }
  }
  async function record() {
    setPending('issue')
    setMessage('')
    try {
      const result = await save('offers/' + issueId, { partnerId: partner, day, focus, body: finalText,
        selectionBasis: draft?.mode === 'manual' ? 'manual' : draft?.basis }, 'PUT')
      if (!result.response.ok) throw new Error(problemTitle(result.error, 'Не вдалося зареєструвати пропозицію'))
      setDraft(undefined)
      setBody('')
      onIssued(day)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не вдалося зберегти') }
    finally { setPending(null) }
  }
  function startManual() {
    setDraft({ mode: 'manual', name: '', intro: '', items: [] })
    setBody('')
    setIssueId(crypto.randomUUID())
    setMessage('')
  }
  return <AppEditorModal opened={opened} onClose={() => { if (!busy) onClose() }} dirty={!!draft && !busy} size="standard" className="offer-editor"
    title={<MetricLabel icon={IconFileText}>Нова пропозиція</MetricLabel>}
    footer={draft && <div className="offer-actions"><Button radius="xl" variant="default" leftSection={<IconCopy size={16} />} disabled={!body.trim() || invalidQuantity || invalidTotal || busy} onClick={async () => {
      try { await navigator.clipboard.writeText(finalText); setMessage('Текст пропозиції скопійовано.') }
      catch { setMessage('Копіювання недоступне в цьому браузері.') }
    }}>Скопіювати</Button>
      <Button radius="xl" leftSection={<IconSend size={16} />} loading={pending === 'issue'} disabled={!body.trim() || finalText.length > 8000 || invalidQuantity || invalidTotal || !day || day > kyivDay(new Date()) || busy} onClick={record}>Зареєструвати пропозицію</Button></div>}>
    <div className="offer-section">
      <div className="offer-fields">
        <Select searchable clearable disabled={!!draft || busy} label="Контрагент" placeholder="Знайдіть за назвою" value={partner}
          onChange={setPartner} onSearchChange={setSearch} data={[...options].map(([value,label]) => ({value,label}))}
          nothingFoundMessage="Контрагента не знайдено" />
        <Select disabled={!!draft || busy} label="Напрям пропозиції" value={focus} allowDeselect={false} data={[{value:'general',label:'Асортимент для клієнта'},
          {value:'irrigation',label:'Комплектація поливу'}]} onChange={v => setFocus(v === 'irrigation' ? v : 'general')} />
        <Select disabled={busy} label="Підготовка чернетки" value={method} allowDeselect={false}
          data={[{value:'statistics',label:'За статистикою продажів'}, {value:'openai',label:'Статистика й текст від OpenAI'}]}
          onChange={value => setMethod(value ?? 'statistics')} />
      </div>
      {partners.status === 'error' && <Button variant="default" onClick={partners.reload}>Оновити довідник</Button>}
      <div className="offer-actions">
        <Button variant="default" disabled={!partner || busy} loading={pending === 'draft'} onClick={generate}>{draft ? 'Створити іншу чернетку' : 'Підготувати чернетку'}</Button>
        {!draft && <Button variant="default" disabled={!partner || busy} onClick={startManual}>Внести готовий розрахунок</Button>}
      </div>
    </div>
    {draft && <div className="offer-section">
      <p>{draft.mode === 'manual' ? 'Внесіть підготовлений розрахунок.' :
        draft.basis === 'statistics' ? 'Товари підібрано за статистикою продажів.' : 'Товари підібрано з каталогу.'}
        {draft.mode === 'ai' && ' Вступ підготував OpenAI.'}
        {draft.mode === 'provider-unconfigured' && ' OpenAI ще не налаштовано. Використано стандартний вступ.'}
        {draft.mode === 'provider-unavailable' && ' OpenAI тимчасово недоступний. Використано стандартний вступ.'}</p>
      {lines.length > 0 && <div className="offer-lines">{lines.map(i => <div className="offer-line" key={i.id}>
        <div><strong>{i.name}</strong><p>{uah(i.price)} за одиницю · доступно {i.available}</p>
          <small>{i.reason || (i.purchases ? 'Покупок цієї позиції · ' + i.purchases : i.related ? 'Раніше купував цю категорію' : 'З доступного асортименту')}</small></div>
        <TextInput type="number" min="0.001" step="0.001" max={i.available} label="Кількість" aria-label={'Кількість · ' + i.name}
          value={quantities[i.id] ?? ''} onChange={e => setQuantities({ ...quantities,[i.id]:e.currentTarget.value })} />
        <b className="offer-amount">{uah(i.sum)}</b>
      </div>)}</div>}
      {lines.length > 0 && <strong className="offer-total">{invalidQuantity ? 'Перевірте кількість і залишок.' : 'Разом ' + uah(total)}</strong>}
      <Textarea autosize minRows={5} maxLength={8000} label="Текст для контрагента" value={body} onChange={e => setBody(e.currentTarget.value)} />
      <div className="offer-fields">
        {draft.mode === 'manual' && <TextInput type="number" min="0" step="0.01" label="Сума пропозиції, грн" value={manualAmount}
          onChange={e => setManualAmount(e.currentTarget.value)} error={invalidTotal ? 'Перевірте суму' : undefined} />}
        <TextInput type="date" label="Дата видачі пропозиції" value={day} max={kyivDay(new Date())} onChange={e => setDay(e.currentTarget.value)} />
      </div>
    </div>}
    {message && <p className="offer-feedback" role="status">{message}</p>}
  </AppEditorModal>
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
  return <div className="offer-invoice">
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
  const [selectedId, setSelectedId] = useState('')
  const [opened, setOpened] = useState(false)
  const selected = rows.find(row => row.id === selectedId)
  // Issued offers persist the sent text. Only the explicit closing total is a quote amount.
  const lastLine = selected?.body.trimEnd().split('\n').pop()?.trim()
  const quoted = lastLine?.match(/^Разом\s+([\d\s.,]+\s*(?:₴|грн\.?|UAH))$/iu)?.[1]
  if (!rows.length) return <p className="offer-feedback">За вибраний період немає зареєстрованих пропозицій.</p>
  return <><div className="offer-ledger">{rows.map(o => <button type="button" key={o.id} className="offer-row" aria-haspopup="dialog"
    onClick={() => { setSelectedId(o.id); setOpened(true) }}><span className="offer-partner"><IconFileText size={17} aria-hidden="true" /><span><strong>{o.partner}</strong>
      <time dateTime={o.day}>{dateLabel(o.day)}</time></span></span>
      <TableChip tone={o.shipments ? 'success' : 'neutral'} value={o.shipments ? 'Є відвантаження' : 'Очікує відвантаження'} />
      <b className="offer-amount">{o.shipments ? uah(o.shipped) : '—'}</b><IconChevronRight size={16} aria-hidden="true" /></button>)}</div>
    <AppEditorModal opened={opened && !!selected} onClose={() => setOpened(false)} size="standard" className="offer-editor"
      title={<MetricLabel icon={IconSend}>Видана пропозиція</MetricLabel>}>
      {selected && <div className="offer-card">
        <section className="offer-section">
          <h3>{selected.partner}</h3>
          <div className="offer-card-meta"><time dateTime={selected.day}>{dateLabel(selected.day)}</time>
            <span>{selected.focus === 'irrigation' ? 'Комплектація поливу' : 'Асортимент для клієнта'}</span>
            <TableChip tone={selected.shipments ? 'success' : 'neutral'} value={selected.shipments ? 'Є відвантаження' : 'Очікує відвантаження'} /></div>
          <dl className="offer-card-sums">
            <div><dt>Сума пропозиції</dt><dd>{quoted ?? 'Не вказано окремо'}</dd></div>
            <div><dt>За накладними</dt><dd>{uah(selected.shipped)}</dd></div>
          </dl>
        </section>
        <section className="offer-section"><h3><MetricLabel icon={IconFileText}>Текст пропозиції</MetricLabel></h3>
          <p className="offer-letter">{selected.body}</p></section>
        <section className="offer-section"><h3><MetricLabel icon={IconFileInvoice}>Прив’язані накладні · {selected.shipments}</MetricLabel></h3>
          <p>{selected.invoiceNumbers ?? 'Накладних ще немає.'}</p>
          {opened && can(PermissionKeys.Accounting.Edit) && <LinkInvoice key={selected.id} offer={selected.id} changed={changed} />}
        </section>
      </div>}
    </AppEditorModal></>
}

export function SalesOffers() {
  const [params] = useSearchParams()
  const initialPartner = params.get('partner')
  const [opened, setOpened] = useState(Boolean(initialPartner))
  const [session, setSession] = useState(0)
  const [notice, setNotice] = useState('')
  const { can } = usePermissions()
  const today = kyivDay(new Date())
  const [from, setFrom] = useState(today.slice(0,7) + '-01')
  const [to, setTo] = useState(today)
  const history = useRegister<Offer[]>('offers?' + new URLSearchParams({ from,to }), Boolean(from && to && from <= to))
  return <div className="sales-offers">
    <AnalyticsCard title={<MetricLabel icon={IconSend}>Видані пропозиції</MetricLabel>} actions={can(PermissionKeys.Accounting.Edit) &&
      <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => {setNotice(''); setSession(s => s + 1); setOpened(true)}}>Нова пропозиція</Button>}>
      <div className="offer-toolbar"><TextInput radius="xl" type="date" label="Від" value={from} max={to} onChange={e => setFrom(e.currentTarget.value)} />
        <TextInput radius="xl" type="date" label="До" value={to} min={from} onChange={e => setTo(e.currentTarget.value)} />
        {history.data && <span>Пропозицій <b>{history.data.length}</b></span>}</div>
      {notice && <p role="status" className="offer-feedback">{notice}</p>}
      {history.data ? <OfferLedger rows={history.data} changed={history.reload} /> : history.isFetching ? <p>Завантаження…</p> :
        <p role="status" className="offer-feedback">{history.problem?.title ?? 'Перевірте період до одного року.'} <Button radius="xl" variant="default" size="xs" onClick={history.reload}>Оновити</Button></p>}
    </AnalyticsCard>
    {can(PermissionKeys.Accounting.Edit) && <Compose key={session} opened={opened} initialPartner={initialPartner} onClose={() => setOpened(false)}
      onIssued={day => {
        setOpened(false)
        setNotice('Пропозицію зареєстровано.')
        if (!from || !to || day < from || day > to) { setFrom(day); setTo(day) }
        else history.reload()
      }} />}
  </div>
}
