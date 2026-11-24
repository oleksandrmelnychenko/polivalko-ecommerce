import { ActionIcon, Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getProducts } from '@/features/catalog/api/catalogApi'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { IconFileInvoice, IconPackage, IconPackageExport, IconSearch, IconTrash, IconUser } from '@tabler/icons-react'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { money, save, useRegister, type Page, type Partner, type Ref } from './api'

type LineInput = { productId: string; title: string; quantity: string; price: string }
export type EditableDraft = {
  agreed?: boolean
  id: string
  revision: string
  number: string
  day: string
  org: string
  store: string
  partner: Ref
  lines: LineInput[]
}
type Props = { kind: 'partner' | string; initial?: EditableDraft; onClose: () => void; onSaved: () => void }
const option = (r: Ref) => ({ value: r.id, label: r.title })

// The register rounds each line to kopecks before adding up the invoice.
function lineKopecks({ quantity, price }: LineInput) {
  const units = Number(quantity)
  const hryvnias = Number(price)
  const thousandths = Math.round(units * 1000)
  const kopecks = Math.round(hryvnias * 100)
  if (!price.trim() || !Number.isFinite(units) || !Number.isFinite(hryvnias) ||
      units <= 0 || units > 1_000_000 || hryvnias < 0 || hryvnias > 100_000_000 ||
      thousandths / 1000 !== units || kopecks / 100 !== hryvnias) return null
  return (BigInt(thousandths) * BigInt(kopecks) + 500n) / 1000n
}

function draftAmount(kopecks: bigint | null) {
  if (kopecks === null) return '—'
  return money(String(kopecks / 100n) + '.' + String(kopecks % 100n).padStart(2, '0'), 'UAH')
}

export function EditRegister({ kind, initial, onClose, onSaved }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const person = kind === 'partner'
  const outgoing = kind === 'out'
  const [id] = useState(() => initial?.id ?? crypto.randomUUID())
  const [title, setTitle] = useState(initial?.number ?? '')
  const [category, setCategory] = useState('juridical')
  const [day, setDay] = useState(
    () => initial?.day ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date()),
  )
  const [org, setOrg] = useState<string | null>(initial?.org ?? null)
  const [store, setStore] = useState<string | null>(initial?.store ?? null)
  const [partner, setPartner] = useState<Ref | null>(initial?.partner ?? null)
  const [term, setTerm] = useState(initial?.partner.title ?? '')
  const [productTerm, setProductTerm] = useState('')
  const [lines, setLines] = useState<LineInput[]>(initial?.lines ?? [])
  const amounts = lines.map(lineKopecks)
  const total = amounts.reduce<bigint | null>((sum, value) => sum === null || value === null ? null : sum + value, 0n)
  const [opened, setOpened] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const partners = useRegister<Page<Partner>>('partners?q=' + encodeURIComponent(term), !person)
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references', !person)
  const products = useApiQuery(
    'register-products:' + productTerm,
    () => getProducts({ q: productTerm, page: 1, pageSize: 25 }),
    { enabled: !person && productTerm.trim().length >= 2 },
  )
  const candidates = partners.data?.items.map(option) ?? []
  if (partner && !candidates.some((p) => p.value === partner.id)) candidates.unshift(option(partner))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!person && (!partner || !org || !store || !lines.length)) {
      setError('Виберіть контрагента, організацію, склад і товари.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = person
        ? { id, title, kind: category }
        : {
            id,
            partnerId: partner?.id,
            number: title,
            kind,
            day,
            organizationId: org,
            storeId: store,
            lines: lines.map((l) => ({
              productId: l.productId,
              quantity: Number(l.quantity),
              price: Number(l.price),
            })),
          }
      const result = initial
        ? await save('drafts/' + id, { revision: initial.revision, draft: body }, 'PUT')
        : await save(person ? 'partners' : 'drafts', body)
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Запис не збережено. Перевірте поля.'))
        return
      }
      onSaved()
      if (!initial) {
        navigate(person ? '/finance/partners/' + id : '/finance/documents/' + id, {
          state: { documentBackground: location },
        })
      }
    } catch {
      setError('Не вдалося отримати відповідь сервера. Повторіть збереження.')
    } finally {
      setBusy(false)
    }
  }
  function updateLine(i: number, key: 'quantity' | 'price', value: string) {
    setLines((current) => current.map((item, index) => (index === i ? { ...item, [key]: value } : item)))
  }
  return (
    <AppEditorModal
      opened={opened}
      onClose={() => { if (!busy) setOpened(false) }}
      onExitTransitionEnd={onClose}
      size={person ? 'compact' : 'standard'}
      className={person ? 'ledger-editor' : 'ledger-editor invoice-editor'}
      data-outgoing={outgoing || undefined}
      title={<MetricLabel icon={person ? IconUser : outgoing ? IconPackageExport : IconFileInvoice}>
        {initial && outgoing ? 'Редагування видаткової накладної № ' + initial.number : initial ? 'Редагування чернетки' : person ? 'Новий контрагент' : kind === 'in' ? 'Нова прибуткова накладна' : 'Нова видаткова накладна'}
      </MetricLabel>}
      footer={<>
        {!person && <div className="draft-total"><span>{outgoing ? 'Сума відвантаження' : 'Сума накладної'}</span><strong>{draftAmount(total)}</strong></div>}
        <Group gap="xs">
        <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Скасувати</Button>
        <Button type="submit" form={'register-' + id} loading={busy}>{person ? 'Зберегти' : 'Зберегти чернетку'}</Button>
      </Group></>}
    >
      <form id={'register-' + id} onSubmit={submit}>
        <Stack gap="sm">
          <section className={person ? 'ledger-form-block' : 'ledger-form-block draft-details'}>
            {!person && <h3><MetricLabel icon={IconFileInvoice}>Реквізити накладної</MetricLabel></h3>}
            <TextInput
              required
              label={person ? 'Назва контрагента' : 'Номер накладної'}
              value={title}
              maxLength={person ? 300 : 80}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            {person ? (
              <Select
                required
                label="Вид"
                value={category}
                onChange={(v) => v && setCategory(v)}
                data={[
                  { value: 'juridical', label: 'Юридична особа' },
                  { value: 'individual', label: 'Фізична особа' },
                ]}
              />
            ) : (
              <>
                  <TextInput
                    required
                    type="date"
                    label="Дата"
                    value={day}
                    onChange={(e) => setDay(e.currentTarget.value)}
                  />
                  <Select
                    searchable
                    required
                    label={outgoing ? 'Покупець' : 'Постачальник'}
                    className="draft-partner"
                    disabled={initial?.agreed}
                    placeholder={kind === 'in' ? 'Оберіть постачальника' : 'Оберіть покупця'}
                    searchValue={term}
                    onSearchChange={setTerm}
                    data={candidates}
                    value={partner?.id ?? null}
                    onChange={(value, item) => setPartner(value && item ? { id: value, title: item.label } : null)}
                  />
                  <Select
                    required
                    label="Організація"
                    placeholder="Оберіть організацію"
                    searchable
                    data={refs.data?.organizations.map(option) ?? []}
                    value={org}
                    onChange={setOrg}
                  />
                  <Select
                    required
                    label={outgoing ? "Склад відвантаження" : "Склад"}
                    placeholder="Оберіть склад"
                    data={refs.data?.stores.map(option) ?? []}
                    value={store}
                    onChange={setStore}
                  />
              </>
            )}
          </section>
          {!person && <section className="ledger-form-block draft-products">
              <header><h3><MetricLabel icon={IconPackage}>{outgoing ? 'Товари до відвантаження' : 'Товари'}</MetricLabel></h3><span>{lines.length}</span></header>
              <Select
                label="Додати товар"
                placeholder="Назва або артикул від двох символів"
                leftSection={<IconSearch size={16} />}
                disabled={initial?.agreed || lines.length >= 250}
                searchable
                value={null}
                searchValue={productTerm}
                onSearchChange={setProductTerm}
                data={products.data?.items.map((p) => ({ value: p.id, label: (p.displayName || p.name) + ' · ' + p.sku })) ?? []}
                onChange={(value, item) => {
                  if (value && item) {
                    setLines((l) => [...l, { productId: value, title: item.label, price: '', quantity: '1' }])
                    setProductTerm('')
                  }
                }}
              />
              {products.status === 'forbidden' && (
                <Text c="red">Для вибору товарів потрібне право перегляду каталогу.</Text>
              )}
              {refs.status === 'error' && (
                <Button variant="subtle" onClick={refs.reload}>
                  Повторити завантаження складів і організацій
                </Button>
              )}
              {lines.length > 0 && <ol className="draft-line-list">
                {lines.map((line, index) => (
                  <li key={index}>
                    <strong className="draft-product-name">{line.title}</strong>
                    <TextInput label="Кількість" aria-label={'Кількість ' + line.title} type="number" required
                      readOnly={initial?.agreed} min="0.001" max="1000000" step="0.001" value={line.quantity}
                      onChange={(e) => updateLine(index, 'quantity', e.currentTarget.value)} />
                    <TextInput label="Ціна, грн" aria-label={'Ціна ' + line.title} type="number" required
                      readOnly={initial?.agreed} min="0" max="100000000" step="0.01" value={line.price}
                      onChange={(e) => updateLine(index, 'price', e.currentTarget.value)} />
                    <div className="draft-line-sum"><span>Сума</span><strong>{draftAmount(amounts[index])}</strong></div>
                    <ActionIcon className="draft-remove" disabled={initial?.agreed} variant="subtle" color="gray" aria-label={'Прибрати ' + line.title}
                      onClick={() => setLines((old) => old.filter((_, i) => i !== index))}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </li>
                ))}
              </ol>}
          </section>}
          {error && <Alert color="red" role="alert">{error}</Alert>}
        </Stack>
      </form>
    </AppEditorModal>
  )
}
