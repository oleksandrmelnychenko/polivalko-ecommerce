import { Alert, Button, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts } from '@/features/catalog/api/catalogApi'
import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { IconFileInvoice, IconPackage, IconUser } from '@tabler/icons-react'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { save, useRegister, type Page, type Partner, type Ref } from './api'

type LineInput = { productId: string; title: string; quantity: string; price: string }
export type EditableDraft = {
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

export function EditRegister({ kind, initial, onClose, onSaved }: Props) {
  const navigate = useNavigate()
  const person = kind === 'partner'
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
      navigate(person ? '/accounting/partners/' + id : '/accounting/documents/' + id)
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
      className="ledger-editor"
      title={<MetricLabel icon={person ? IconUser : IconFileInvoice}>
        {initial ? 'Редагування чернетки' : person ? 'Новий контрагент' : kind === 'in' ? 'Нова прибуткова накладна' : 'Нова видаткова накладна'}
      </MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Скасувати</Button>
        <Button type="submit" form={'register-' + id} loading={busy}>{person ? 'Зберегти' : 'Зберегти чернетку'}</Button>
      </Group>}
    >
      <form id={'register-' + id} onSubmit={submit}>
        <Stack gap="sm">
          <section className="ledger-form-block">
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
                <Group grow align="end">
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
                    label="Контрагент"
                    searchValue={term}
                    onSearchChange={setTerm}
                    data={candidates}
                    value={partner?.id ?? null}
                    onChange={(value, item) => setPartner(value && item ? { id: value, title: item.label } : null)}
                  />
                </Group>
                <Group grow>
                  <Select
                    required
                    label="Організація"
                    searchable
                    data={refs.data?.organizations.map(option) ?? []}
                    value={org}
                    onChange={setOrg}
                  />
                  <Select
                    required
                    label="Склад"
                    data={refs.data?.stores.map(option) ?? []}
                    value={store}
                    onChange={setStore}
                  />
                </Group>
              </>
            )}
          </section>
          {!person && <section className="ledger-form-block">
              <h3><MetricLabel icon={IconPackage}>Товари</MetricLabel></h3>
              <Select
                label="Додати товар"
                placeholder="Введіть назву або артикул"
                searchable
                value={null}
                searchValue={productTerm}
                onSearchChange={setProductTerm}
                data={products.data?.items.map((p) => ({ value: p.id, label: p.name + ' · ' + p.sku })) ?? []}
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
              {lines.length > 0 && <div className="ledger-lines"><Table>
                <Table.Thead>
                  <Table.Tr>
                    {['Товар', 'Кількість', 'Ціна, грн', ''].map((c) => (
                      <Table.Th key={c}>{c}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lines.map((l, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{l.title}</Table.Td>
                      <Table.Td>
                        <TextInput
                          aria-label={'Кількість ' + l.title}
                          type="number"
                          required
                          min="0.001"
                          step="0.001"
                          value={l.quantity}
                          onChange={(e) => updateLine(i, 'quantity', e.currentTarget.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          aria-label={'Ціна ' + l.title}
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={l.price}
                          onChange={(e) => updateLine(i, 'price', e.currentTarget.value)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Button variant="subtle" onClick={() => setLines((old) => old.filter((_, j) => i !== j))}>
                          Прибрати
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table></div>}
              <Text size="sm" c="dimmed">
                Чернетка зберігає позиції та суму в гривнях. Рух запасів і зміна боргу потребують проведення.
              </Text>
          </section>}
          {error && <Alert color="red" role="alert">{error}</Alert>}
        </Stack>
      </form>
    </AppEditorModal>
  )
}
