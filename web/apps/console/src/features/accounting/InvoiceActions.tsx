import { Alert, Button, Group, Modal, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { problemMessage } from '@/shared/api/problem'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { money, save, useRegister, type Doc, type Card } from './api'
import { EditRegister } from './EditRegister'

const amount = (value: string) => money(value, 'UAH')
type State = components['schemas']['InvoiceState']

export function InvoiceActions({ doc, lines, refresh, onDialogChange }: { doc: Doc; lines: Card['lines']; refresh: () => void; onDialogChange: (opened: boolean) => void }) {
  const url = 'documents/' + doc.id
  const query = useRegister<State>(url + '/operations')
  const [action, updateAction] = useState<'post' | 'pay' | 'edit' | null>(null)
  function setAction(next: typeof action) {
    updateAction(next)
    onDialogChange(next !== null)
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { can } = usePermissions()
  if (!query.data) return <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
  const state = query.data
  const purchase = doc.kind === 'in'
  const negative = state.stock.some((item) => item.after < 0)
  const close = () => {
    if (!busy) {
      setAction(null)
      setError('')
    }
  }
  async function submit(path: string, body: unknown) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save(url + '/' + path, body)
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Не вдалося зберегти операцію.'))
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
  const draft = state.status === 'draft'
  if (state.status === 'cancelled') return <Text>Чернетку скасовано після зняття резерву клієнта.</Text>
  return (
    <Stack className="invoice-operation" gap="md">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed">
            {state.store}
          </Text>
          <Title order={3}>{draft ? 'Підготовка до проведення' : 'Оплата накладної'}</Title>
        </div>
        <Group>
          {draft && can(PermissionKeys.Accounting.Edit) && (
            <Button variant="default" onClick={() => setAction('edit')}>
              Редагувати
            </Button>
          )}
          {draft && can(PermissionKeys.Accounting.Post) && (
            <Button onClick={() => setAction('post')}>Перевірити й провести</Button>
          )}
          {!draft && Number(state.due) > 0 && can(PermissionKeys.Accounting.Pay) && (
            <Button onClick={() => setAction('pay')}>
              {purchase ? 'Зареєструвати виплату' : 'Зареєструвати оплату'}
            </Button>
          )}
        </Group>
      </Group>
      {state.offerReservation && <Text size="sm">
        {draft ? 'Під час проведення буде списано резерв' : 'Списано резерв'} клієнта {doc.partnerTitle} · {state.offerReservation.quantity.toLocaleString('uk-UA')} {state.offerReservation.unit}
      </Text>}
      <div className="invoice-totals">
        <div>
          <span>Сума накладної</span>
          <strong>{amount(state.total)}</strong>
        </div>
        <div>
          <span>{purchase ? 'Сплачено постачальнику' : 'Отримано від клієнта'}</span>
          <strong>{draft ? '—' : amount(state.paid)}</strong>
        </div>
        <div>
          <span>{purchase ? 'До сплати' : 'До отримання'}</span>
          <strong>{state.due == null ? 'Після проведення' : amount(state.due)}</strong>
        </div>
      </div>
      {state.payments.length > 0 && (
        <Grid columns={['Дата', 'Спосіб', 'Каса або рахунок', 'Номер платіжного документа', 'Сума']}>
          {state.payments.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.day}</Table.Td>
              <Table.Td>{p.method === 'cash' ? 'Готівка' : 'Банк'}</Table.Td>
              <Table.Td>{p.accountTitle}</Table.Td>
              <Table.Td>{p.reference}</Table.Td>
              <Table.Td>{amount(p.amount)}</Table.Td>
            </Table.Tr>
          ))}
        </Grid>
      )}
      <details>
        <summary>{draft ? 'Очікуваний рух запасів' : 'Рух запасів при проведенні'}</summary>
        <Impact state={state} />
      </details>
      <Modal
        opened={action === 'post'}
        onClose={close}
        title={purchase ? 'Приймання на склад' : 'Відвантаження зі складу'}
        size="lg"
      >
        <Stack>
          <Text fw={600}>
            {state.store} · № {doc.number}
          </Text>
          <Impact state={state} />
          <Text>
            {purchase ? 'До сплати постачальнику' : 'До отримання від клієнта'} після проведення · {amount(state.total)}
          </Text>
          {negative && <Alert color="orange">На цьому складі бракує товару. Перевірте склад і надходження.</Alert>}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" onClick={close} disabled={busy}>
              Закрити
            </Button>
            <Button
              disabled={negative || !draft}
              loading={busy}
              onClick={() => submit('post', { revision: state.revision })}
            >
              Провести накладну
            </Button>
          </Group>
        </Stack>
      </Modal>
      {action === 'pay' && (
        <PaymentForm
          due={state.due ?? '0.00'}
          minDay={doc.day ?? ''}
          purchase={purchase}
          error={error}
          busy={busy}
          close={close}
          submit={(body) => submit('payments', body)}
        />
      )}
      {action === 'edit' && doc.partnerId && (
        <EditRegister
          kind={doc.kind!}
          initial={{
            id: doc.id,
            agreed: Boolean(state.offerReservation),
            revision: state.revision,
            number: doc.number ?? '',
            day: doc.day ?? '',
            org: state.orgId,
            store: state.storeId,
            partner: { id: doc.partnerId, title: doc.partnerTitle ?? '' },
            lines: lines.map((l) => ({
              productId: l.productRef!,
              title: l.product || l.sku || '',
              quantity: l.quantity!,
              price: l.price!,
            })),
          }}
          onClose={close}
          onSaved={() => {
            setAction(null)
            query.reload()
            refresh()
          }}
        />
      )}
    </Stack>
  )
}

function Impact({ state }: { state: State }) {
  return (
    <Grid columns={['Товар', 'Було', 'Рух', 'Стане / стало']}>
      {state.stock.map((l) => (
        <Table.Tr key={l.productId}>
          <Table.Td>{l.title}</Table.Td>
          <Table.Td>{l.before}</Table.Td>
          <Table.Td>
            {l.change > 0 ? '+' : ''}
            {l.change}
          </Table.Td>
          <Table.Td c={l.after < 0 ? 'red' : undefined}>{l.after}</Table.Td>
        </Table.Tr>
      ))}
    </Grid>
  )
}

export function PaymentForm({
  due,
  minDay,
  purchase,
  error,
  busy,
  close,
  submit,
  balanceLabel = 'Залишок за накладною',
}: {
  due: string
  minDay: string
  purchase: boolean
  error: string
  busy: boolean
  close: () => void
  submit: (body: unknown) => Promise<void>
  balanceLabel?: string
}) {
  const [id] = useState(() => crypto.randomUUID())
  const [value, setValue] = useState(due)
  const [day, setDay] = useState(
    () => [minDay, new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date())].sort()[1],
  )
  const [method, setMethod] = useState('bank')
  const [accountTitle, setAccount] = useState('')
  const [reference, setReference] = useState('')
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void submit({ id, day, amount: value, method, accountTitle, reference })
  }
  return (
    <Modal opened onClose={close} title={purchase ? 'Виплата постачальнику' : 'Оплата від клієнта'}>
      <form onSubmit={onSubmit}>
        <Stack>
          <Text>
            {balanceLabel} · <b>{amount(due)}</b>
          </Text>
          <Group grow>
            <TextInput
              label="Сума, грн"
              type="number"
              required
              min="0.01"
              max={due}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
            />
            <TextInput
              label="Дата оплати"
              type="date"
              required
              min={minDay}
              value={day}
              onChange={(e) => setDay(e.currentTarget.value)}
            />
          </Group>
          <Select
            label="Спосіб"
            value={method}
            onChange={(v) => v && setMethod(v)}
            data={[
              { value: 'bank', label: 'Банк' },
              { value: 'cash', label: 'Готівка' },
            ]}
          />
          <TextInput
            label={method === 'bank' ? 'Рахунок' : 'Каса'}
            required
            maxLength={150}
            value={accountTitle}
            onChange={(e) => setAccount(e.currentTarget.value)}
          />
          <TextInput
            label="Номер платіжного документа"
            required
            maxLength={150}
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
          {error && <Alert color="red">{error}</Alert>}
          <Button type="submit" loading={busy}>
            Зареєструвати {purchase ? 'виплату' : 'оплату'}
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
