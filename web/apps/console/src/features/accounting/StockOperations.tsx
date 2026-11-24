import { ActionIcon, Alert, Button, Group, Modal, Select, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core'
import { IconFilePencil, IconPackage, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { getProducts } from '@/features/catalog/api/catalogApi'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { DOCUMENTS_PATH, DocumentLink } from '@/shared/ui/DocumentLink'
import { FilterBar } from '@/shared/ui/FilterBar'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { DocumentStatus, documentIcon } from './DocumentTable'
import { Grid } from './RegisterTable'
import { money, save, stockOperationNames, useRegister, writeOffReasons, type Doc, type Page, type Ref } from './api'

type S = components['schemas']
type State = S['StockOperationState']
export type StockKind = 'income' | 'writeOff' | 'recount'
type LineInput = { productId: string; title: string; quantity: string; price: string }
type Initial = { state: State; lines: LineInput[] }

const option = (r: Ref) => ({ value: r.id, label: r.title })
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date())
const quantity = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 3 })
const signed = (value: number) => (value > 0 ? '+' : '') + quantity(value)

const copy: Record<StockKind, { title: string; heading: string; create: string; empty: string; editor: string; amount: string }> = {
  income: {
    title: 'Оприбуткування',
    heading: 'Товар без документів постачальника',
    create: 'Оприбуткувати товар',
    empty: 'Оприбуткувань ще немає',
    editor: 'Нове оприбуткування',
    amount: 'Кількість',
  },
  writeOff: {
    title: 'Списання',
    heading: 'Брак, втрати й інші списання',
    create: 'Списати товар',
    empty: 'Списань ще немає',
    editor: 'Нове списання',
    amount: 'Кількість',
  },
  recount: {
    title: 'Перерахунки',
    heading: 'Фактична кількість на полиці',
    create: 'Новий перерахунок',
    empty: 'Перерахунків ще немає',
    editor: 'Новий перерахунок',
    amount: 'Факт',
  },
}

// Journal of one kind of stock operation with drafts first-class, like the invoice journals.
export function StockOperationRegister({ kind, switcher }: { kind: StockKind; switcher?: React.ReactNode }) {
  const [params, setParams] = useSearchParams()
  const [create, setCreate] = useState(false)
  const { can } = usePermissions()
  const text = copy[kind]
  const filter = new URLSearchParams({ register: kind, page: params.get('page') ?? '1' })
  for (const key of ['q', 'status']) if (params.get(key)) filter.set(key, params.get(key)!)
  const query = useRegister<Page<Doc>>('documents?' + filter)
  const drafts = useRegister<Page<Doc>>('documents?' + new URLSearchParams({ register: kind, status: 'draft' }))
  const draftsOnly = params.get('status') === 'draft'
  const page = Math.max(1, Number(params.get('page')) || 1)
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack gap="sm" className="ledger-workspace doc-register">
      <PageHeader title={text.title} actions={
        <Group gap="xs">
          {switcher}
          {(draftsOnly || !!drafts.data?.total) && (
            <Button radius="xl" variant={draftsOnly ? 'filled' : 'default'} leftSection={<IconFilePencil size={16} />}
              aria-pressed={draftsOnly} onClick={() => change('status', draftsOnly ? '' : 'draft')}>
              Чернетки · {drafts.data?.total.toLocaleString('uk-UA') ?? '—'}
            </Button>
          )}
          {can(PermissionKeys.Accounting.Edit) && (
            <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => setCreate(true)}>{text.create}</Button>
          )}
        </Group>
      } />
      <section className="ledger-card">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={documentIcon({ entityType: 'stockOperation', kind } as Doc)}>{text.heading}</MetricLabel></h2>
          {query.data && <span className="ledger-count">Записів · {query.data.total.toLocaleString('uk-UA')}</span>}
        </header>
        <FilterBar label="Пошук операцій"
          search={<TextInput aria-label="Пошук" maxLength={160} className="app-filter-wide" leftSection={<IconSearch size={16} />}
            placeholder="Номер або організація" value={params.get('q') ?? ''} onChange={(e) => change('q', e.currentTarget.value)} />}
          actions={<Paginator page={page} pageSize={50} totalPages={query.data && Math.ceil(query.data.total / 50)}
            isLoading={query.isFetching} onPageChange={(p) => change('page', String(p))} onRefresh={() => { query.reload(); drafts.reload() }} />} />
        {query.data ? (
          query.data.total ? (
            <Grid columns={['Номер', 'Дата', 'Організація', 'Стан документа', ...(kind === 'income' ? ['Сума'] : [])]}>
              {query.data.items.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td data-label="Номер"><DocumentLink id={d.id}>№ {d.number || d.sourceId}</DocumentLink></Table.Td>
                  <Table.Td data-label="Дата" className="ledger-number">{d.day ?? '—'}</Table.Td>
                  <Table.Td data-label="Організація">{d.organization || '—'}</Table.Td>
                  <Table.Td data-label="Стан документа"><DocumentStatus doc={d} /></Table.Td>
                  {kind === 'income' && <Table.Td data-label="Сума" className="register-money">{money(d.amount, d.currency)}</Table.Td>}
                </Table.Tr>
              ))}
            </Grid>
          ) : <PageState kind="empty" title={params.has('q') || draftsOnly ? 'Записів за цими умовами немає' : text.empty} />
        ) : <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />}
      </section>
      {create && <StockOperationForm kind={kind} onClose={() => setCreate(false)}
        onSaved={() => { setCreate(false); query.reload(); drafts.reload() }} />}
    </Stack>
  )
}

function StockOperationForm({ kind, initial, onClose, onSaved }: { kind: StockKind; initial?: Initial; onClose: () => void; onSaved: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const text = copy[kind]
  const [id] = useState(() => initial?.state.id ?? crypto.randomUUID())
  const [day, setDay] = useState(initial?.state.day ?? today())
  const [org, setOrg] = useState<string | null>(initial?.state.orgId ?? null)
  const [store, setStore] = useState<string | null>(initial?.state.storeId ?? null)
  const [reason, setReason] = useState<string | null>(initial?.state.reason ?? null)
  const [comment, setComment] = useState(initial?.state.comment ?? '')
  const [lines, setLines] = useState<LineInput[]>(initial?.lines ?? [])
  const [productTerm, setProductTerm] = useState('')
  const [opened, setOpened] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')
  const products = useApiQuery('stock-operation-products:' + productTerm,
    () => getProducts({ q: productTerm, page: 1, pageSize: 25 }), { enabled: productTerm.trim().length >= 2 })
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!org || !store || !lines.length || (kind === 'writeOff' && !reason)) {
      setError(kind === 'writeOff' ? 'Виберіть організацію, склад, причину й товари.' : 'Виберіть організацію, склад і товари.')
      return
    }
    setBusy(true)
    setError('')
    const draft = {
      id, kind, day, orgId: org, storeId: store,
      reason: kind === 'writeOff' ? reason : null,
      comment: comment.trim() || null,
      lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), price: kind === 'income' ? Number(l.price) : null })),
    }
    try {
      const result = initial
        ? await save('stock-operations/' + id, { revision: initial.state.revision, draft }, 'PUT')
        : await save('stock-operations', draft)
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Операцію не збережено. Перевірте поля.'))
        return
      }
      onSaved()
      if (!initial) navigate(DOCUMENTS_PATH + '/' + id, { state: { documentBackground: location } })
    } catch {
      setError('Не вдалося отримати відповідь сервера. Повторіть збереження.')
    } finally {
      setBusy(false)
    }
  }
  function update(i: number, key: 'quantity' | 'price', value: string) {
    setLines((current) => current.map((line, index) => (index === i ? { ...line, [key]: value } : line)))
  }
  return (
    <AppEditorModal opened={opened} onClose={() => { if (!busy) setOpened(false) }} onExitTransitionEnd={onClose}
      size="standard" className="ledger-editor invoice-editor"
      title={<MetricLabel icon={documentIcon({ entityType: 'stockOperation', kind } as Doc)}>
        {initial ? stockOperationNames[kind] + ' № ' + initial.state.number : text.editor}
      </MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Скасувати</Button>
        <Button type="submit" form={'stock-operation-' + id} loading={busy}>Зберегти чернетку</Button>
      </Group>}>
      <form id={'stock-operation-' + id} onSubmit={submit}>
        <Stack gap="sm">
          <section className="ledger-form-block draft-details">
            <TextInput required type="date" label="Дата" value={day} onChange={(e) => setDay(e.currentTarget.value)} />
            <Select required searchable label="Організація" placeholder="Оберіть організацію"
              data={refs.data?.organizations.map(option) ?? []} value={org} onChange={setOrg} />
            <Select required label="Склад" placeholder="Оберіть склад"
              data={refs.data?.stores.map(option) ?? []} value={store} onChange={setStore} />
            {kind === 'writeOff' && <Select required label="Причина" placeholder="Оберіть причину"
              data={Object.entries(writeOffReasons).map(([value, label]) => ({ value, label }))} value={reason} onChange={setReason} />}
            <Textarea label={reason === 'other' ? 'Коментар (обов’язковий)' : 'Коментар'} required={reason === 'other'} maxLength={500}
              autosize minRows={1} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          </section>
          <section className="ledger-form-block draft-products">
            <header><h3><MetricLabel icon={IconPackage}>Товари</MetricLabel></h3><span>{lines.length}</span></header>
            <Select label="Додати товар" placeholder="Назва або артикул від двох символів" leftSection={<IconSearch size={16} />}
              disabled={lines.length >= 250} searchable value={null} searchValue={productTerm} onSearchChange={setProductTerm}
              data={products.data?.items.filter((p) => !lines.some((l) => l.productId === p.id))
                .map((p) => ({ value: p.id, label: (p.displayName || p.name) + ' · ' + p.sku })) ?? []}
              onChange={(value, item) => {
                if (value && item) {
                  setLines((l) => [...l, { productId: value, title: item.label, quantity: kind === 'recount' ? '' : '1', price: '' }])
                  setProductTerm('')
                }
              }} />
            {products.status === 'forbidden' && <Text c="red">Для вибору товарів потрібне право перегляду каталогу.</Text>}
            {refs.status === 'error' && <Button variant="subtle" onClick={refs.reload}>Повторити завантаження складів і організацій</Button>}
            {kind === 'recount' && <Text size="sm" c="dimmed">Облікову кількість консоль запам’ятає під час збереження чернетки.</Text>}
            {lines.length > 0 && <ol className="draft-line-list">
              {lines.map((line, index) => (
                <li key={line.productId}>
                  <strong className="draft-product-name">{line.title}</strong>
                  <TextInput label={text.amount} aria-label={text.amount + ' ' + line.title} type="number" required
                    min={kind === 'recount' ? '0' : '0.001'} max="1000000" step="0.001" value={line.quantity}
                    onChange={(e) => update(index, 'quantity', e.currentTarget.value)} />
                  {kind === 'income' && <TextInput label="Ціна за одиницю, грн" aria-label={'Ціна ' + line.title} type="number" required
                    min="0.01" max="100000000" step="0.01" value={line.price} onChange={(e) => update(index, 'price', e.currentTarget.value)} />}
                  <ActionIcon className="draft-remove" variant="subtle" color="gray" aria-label={'Прибрати ' + line.title}
                    onClick={() => setLines((old) => old.filter((_, i) => i !== index))}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </li>
              ))}
            </ol>}
          </section>
          {error && <Alert color="red" role="alert">{error}</Alert>}
        </Stack>
      </form>
    </AppEditorModal>
  )
}

// Card block of a stock operation: expected or recorded movement, editing and posting.
export function StockOperationActions({ doc, refresh, onDialogChange }: { doc: Doc; refresh: () => void; onDialogChange: (opened: boolean) => void }) {
  const url = 'stock-operations/' + doc.id
  const query = useRegister<State>(url)
  const [action, updateAction] = useState<'post' | 'edit' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { can } = usePermissions()
  function setAction(next: typeof action) {
    updateAction(next)
    onDialogChange(next !== null)
    if (!next) setError('')
  }
  if (!query.data) return <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
  const state = query.data
  const kind = state.kind as StockKind
  const draft = state.status === 'draft'
  const negative = state.lines.some((l) => l.after < 0)
  // Only receipts and write-offs need the opening first; a recount itself states the quantity on the shelf.
  const unopened = kind === 'recount' ? [] : state.lines.filter((l) => l.firstMovement)
  const openingWarning = unopened.length > 0 && (
    <Alert color="orange" title="Спершу введіть початковий залишок">
      {unopened.length === 1
        ? <>Товар «{unopened[0].title}» ще не має руху</>
        : <>Товари {unopened.map((l) => '«' + l.title + '»').join(', ')} ще не мають руху</>} на складі {state.store}. Після
      проведення ввести для {unopened.length === 1 ? 'нього' : 'них'} початковий залишок
      уже не вийде, і склад покаже лише кількість із цієї операції. Якщо товар уже лежав на полиці, спершу введіть
      початковий залишок у «Склад → Залишки» або проведіть перерахунок.
    </Alert>
  )
  async function post() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save(url + '/post', { revision: state.revision })
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Операцію не проведено.'))
        query.reload()
        return
      }
      setAction(null)
      query.reload()
      refresh()
    } catch {
      setError('Немає зв’язку. Повторіть дію, коли з’єднання відновиться.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Stack className="invoice-operation" gap="md">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed">{state.store}</Text>
          <Title order={3}>{draft ? 'Підготовка до проведення' : 'Рух складу проведено'}</Title>
        </div>
        <Group>
          {draft && can(PermissionKeys.Accounting.Edit) && <Button variant="default" onClick={() => setAction('edit')}>Редагувати</Button>}
          {draft && can(PermissionKeys.Accounting.Post) && <Button onClick={() => setAction('post')}>Перевірити й провести</Button>}
        </Group>
      </Group>
      {(state.reason || state.comment) && <Text size="sm">
        {state.reason && <>Причина · <b>{writeOffReasons[state.reason] ?? state.reason}</b>{state.comment && ' · '}</>}
        {state.comment}
      </Text>}
      {draft && openingWarning}
      <Movement state={state} />
      <Modal opened={action === 'post'} onClose={() => { if (!busy) setAction(null) }} title={stockOperationNames[kind]} size="lg">
        <Stack>
          <Text fw={600}>{state.store} · № {state.number}</Text>
          <Movement state={state} />
          {kind === 'recount' && <Text size="sm">Рух — різниця між фактом і обліком на момент збереження чернетки.</Text>}
          {openingWarning}
          {negative && <Alert color="orange">На цьому складі бракує товару для цієї операції.</Alert>}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" onClick={() => setAction(null)} disabled={busy}>Закрити</Button>
            <Button disabled={negative || !draft} loading={busy} onClick={post}>Провести</Button>
          </Group>
        </Stack>
      </Modal>
      {action === 'edit' && <StockOperationForm kind={kind}
        initial={{ state, lines: state.lines.map((l) => ({
          productId: l.productId, title: l.title + (l.sku ? ' · ' + l.sku : ''),
          quantity: String(l.quantity), price: l.price == null ? '' : String(l.price),
        })) }}
        onClose={() => setAction(null)}
        onSaved={() => { setAction(null); query.reload(); refresh() }} />}
    </Stack>
  )
}

function Movement({ state }: { state: State }) {
  const recount = state.kind === 'recount'
  const income = state.kind === 'income'
  return (
    <Grid columns={['Товар', ...(recount ? ['Облік', 'Факт'] : ['Кількість']), ...(income ? ['Ціна'] : []), 'Було', 'Рух', state.status === 'draft' ? 'Стане' : 'Стало']}>
      {state.lines.map((l) => (
        <Table.Tr key={l.productId}>
          <Table.Td>{l.title}<Text size="xs" c="dimmed">{l.sku}</Text></Table.Td>
          {recount && <Table.Td className="ledger-number">{l.book == null ? '—' : quantity(l.book)}</Table.Td>}
          <Table.Td className="ledger-number">{quantity(l.quantity)}</Table.Td>
          {income && <Table.Td className="register-money">{money(l.price == null ? null : l.price.toFixed(2), 'UAH')}</Table.Td>}
          <Table.Td className="ledger-number">{quantity(l.before)}</Table.Td>
          <Table.Td className="ledger-number">{signed(l.change)}</Table.Td>
          <Table.Td className="ledger-number" c={l.after < 0 ? 'red' : undefined}>{quantity(l.after)}</Table.Td>
        </Table.Tr>
      ))}
    </Grid>
  )
}
