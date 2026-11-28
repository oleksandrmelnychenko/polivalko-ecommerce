import { Alert, Button, Checkbox, Group, Modal, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { IconRotateClockwise, IconTrash } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { problemMessage } from '@/shared/api/problem'
import { notifySuccess } from '@/shared/ui/notify'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { money, remove, save, useRegister, type Doc, type Card } from './api'
import { EditRegister } from './EditRegister'

const amount = (value: string) => money(value, 'UAH')
const qtyFmt = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
type ImpactLine = components['schemas']['InvoiceState']['stock'][number] & {
  reservedQuantity?: number | null
  firstMovement?: boolean
  unlinkedFromShop?: boolean
}
type State = Omit<components['schemas']['InvoiceState'], 'stock'> & { stock: ImpactLine[] }
type PaymentItem = State['payments'][number]

export function InvoiceActions({
  doc,
  lines,
  refresh,
  onDeleted,
  onDialogChange,
}: {
  doc: Doc
  lines: Card['lines']
  refresh: () => void
  onDeleted?: () => void
  onDialogChange: (opened: boolean) => void
}) {
  const url = 'documents/' + doc.id
  const query = useRegister<State>(url + '/operations')
  const [action, updateAction] = useState<'post' | 'pay' | 'edit' | 'delete' | 'unpost' | null>(null)
  const [reversingPayment, setReversingPayment] = useState<PaymentItem | null>(null)
  function setAction(next: typeof action) {
    updateAction(next)
    onDialogChange(next !== null || reversingPayment !== null)
    if (!next) setError('')
  }
  function openReversePayment(payment: PaymentItem | null) {
    setReversingPayment(payment)
    onDialogChange(action !== null || payment !== null)
    if (!payment) setError('')
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { can } = usePermissions()
  const canLinkShop = can(PermissionKeys.Catalog.RunImport)
  const [linkUnlinkedToShop, setLinkUnlinkedToShop] = useState(true)
  if (!query.data) return <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
  const state = query.data
  const isReturn = doc.entityType === 'customerReturn' || doc.kind === 'customerReturn'
  const purchase = doc.kind === 'in'
  const negative = state.stock.some((item) => item.after < 0)
  const reservedConflicts = state.stock.filter((item) => item.reservedQuantity != null && item.after < item.reservedQuantity)
  const reservedConflict = reservedConflicts.length > 0
  const unopened = state.stock.filter((item) => item.firstMovement)
  const unlinked = purchase ? state.stock.filter((item) => item.unlinkedFromShop) : []
  const openingWarning = unopened.length > 0 && (
    <Alert color="orange" title="Спершу введіть початковий залишок">
      {unopened.length === 1
        ? <>Товар «{unopened[0].title}» ще не має руху</>
        : <>Товари {unopened.map((l) => '«' + l.title + '»').join(', ')} ще не мають руху</>} на складі {state.store}. Після
      проведення ввести для {unopened.length === 1 ? 'нього' : 'них'} початковий залишок уже не вийде, і склад покаже лише кількість із цієї операції.
      Якщо товар уже лежав на полиці, спершу введіть початковий залишок у «Склад → Залишки».
    </Alert>
  )
  const reservedWarning = reservedConflict && (
    <Alert color="orange" title="Конфлікт із резервом інтернет-магазину">
      Після проведення залишок стане меншим за зарезервовану кількість для{' '}
      {reservedConflicts.map((l) => `«${l.title}» (залишиться ${qtyFmt.format(l.after)}, у резерві ${qtyFmt.format(l.reservedQuantity ?? 0)})`).join(', ')}.
    </Alert>
  )
  const close = () => {
    if (!busy) {
      setAction(null)
      setReversingPayment(null)
      onDialogChange(false)
      setError('')
    }
  }
  async function submit(path: string, body?: unknown) {
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
      onDialogChange(false)
      query.reload()
      refresh()
    } catch {
      setError('Немає зв’язку. Повторіть дію, коли з’єднання відновиться.')
    } finally {
      setBusy(false)
    }
  }
  async function deleteDraft() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await remove('drafts/' + doc.id)
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Не вдалося видалити чернетку.'))
        query.reload()
        return
      }
      notifySuccess('Чернетку видалено.')
      setAction(null)
      onDialogChange(false)
      onDeleted?.()
    } catch {
      setError('Немає зв’язку. Повторіть дію, коли з’єднання відновиться.')
    } finally {
      setBusy(false)
    }
  }
  async function unpostDocument() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save(url + '/unpost')
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Не вдалося сторнувати проведення.'))
        query.reload()
        return
      }
      notifySuccess('Проведення сторновано.')
      setAction(null)
      onDialogChange(false)
      query.reload()
      refresh()
    } catch {
      setError('Немає зв’язку. Повторіть дію, коли з’єднання відновиться.')
    } finally {
      setBusy(false)
    }
  }
  async function reversePayment() {
    if (busy || !reversingPayment) return
    setBusy(true)
    setError('')
    try {
      const result = await remove('payments/' + reversingPayment.id)
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Не вдалося сторнувати оплату.'))
        query.reload()
        return
      }
      notifySuccess('Оплату сторновано.')
      openReversePayment(null)
      query.reload()
      refresh()
    } catch {
      setError('Немає зв’язку. Повторіть дію, коли з’єднання відновиться.')
    } finally {
      setBusy(false)
    }
  }
  const draft = state.status === 'draft'
  const posted = state.status === 'posted'
  const canReversePayment = posted && can(PermissionKeys.Accounting.Post)
  if (state.status === 'cancelled') {
    return (
      <Text c="dimmed">
        {state.offerReservation ? 'Чернетку скасовано після зняття резерву клієнта.' : 'Документ сторновано (скасовано).'}
      </Text>
    )
  }
  return (
    <Stack className="invoice-operation" gap="md">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text size="sm" c="dimmed">
            {state.store}
          </Text>
          <Title order={3}>
            {draft ? 'Підготовка до проведення' : isReturn ? 'Повернення коштів' : 'Оплата накладної'}
          </Title>
        </div>
        <Group gap="xs" wrap="wrap">
          {draft && can(PermissionKeys.Accounting.Edit) && (
            <>
              <Button variant="default" onClick={() => setAction('edit')}>
                Редагувати
              </Button>
              <Button variant="light" color="red" leftSection={<IconTrash size={15} />} onClick={() => setAction('delete')}>
                Видалити чернетку
              </Button>
            </>
          )}
          {draft && can(PermissionKeys.Accounting.Post) && (
            <Button onClick={() => setAction('post')}>Перевірити й провести</Button>
          )}
          {posted && can(PermissionKeys.Accounting.Post) && (
            <Button variant="light" color="orange" leftSection={<IconRotateClockwise size={15} />} onClick={() => setAction('unpost')}>
              Сторнувати проведення
            </Button>
          )}
          {posted && Number(state.due) > 0 && can(PermissionKeys.Accounting.Pay) && (
            <Button onClick={() => setAction('pay')}>
              {isReturn ? 'Зареєструвати повернення коштів' : purchase ? 'Зареєструвати виплату' : 'Зареєструвати оплату'}
            </Button>
          )}
        </Group>
      </Group>
      {state.offerReservation && <Text size="sm">
        {draft ? 'Під час проведення буде списано резерв' : 'Списано резерв'} клієнта {doc.partnerTitle} · {state.offerReservation.quantity.toLocaleString('uk-UA')} {state.offerReservation.unit}
      </Text>}
      {draft && openingWarning}
      {draft && reservedWarning}
      {draft && purchase && unlinked.length > 0 && (
        <Alert color="blue" variant="light">
          {unlinked.length === 1
            ? `Товар «${unlinked[0].title}» ще не прив’язаний до жодного складу вітрини.`
            : `${unlinked.length} товари ще не прив’язані до жодного складу вітрини.`}{' '}
          Під час проведення їх можна одразу підключити до складу «{state.store}», щоб залишок оновився на сайті.
        </Alert>
      )}
      <div className="invoice-totals">
        <div>
          <span>{isReturn ? 'Сума повернення' : 'Сума накладної'}</span>
          <strong>{amount(state.total)}</strong>
        </div>
        <div>
          <span>{isReturn ? 'Повернуто клієнту' : purchase ? 'Сплачено постачальнику' : 'Отримано від клієнта'}</span>
          <strong>{draft ? '—' : amount(state.paid)}</strong>
        </div>
        <div>
          <span>{isReturn ? 'До повернення клієнту' : purchase ? 'До сплати' : 'До отримання'}</span>
          <strong>{state.due == null ? 'Після проведення' : amount(state.due)}</strong>
        </div>
      </div>
      {state.payments.length > 0 && (
        <Grid columns={['Дата', 'Спосіб', 'Каса або рахунок', 'Номер платіжного документа', 'Сума', ...(canReversePayment ? ['Дії'] : [])]}>
          {state.payments.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.day}</Table.Td>
              <Table.Td>{p.method === 'cash' ? 'Готівка' : 'Банк'}</Table.Td>
              <Table.Td>{p.accountTitle}</Table.Td>
              <Table.Td>{p.reference}</Table.Td>
              <Table.Td>{amount(p.amount)}</Table.Td>
              {canReversePayment && (
                <Table.Td>
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    leftSection={<IconRotateClockwise size={13} />}
                    onClick={() => openReversePayment(p)}
                  >
                    Сторнувати
                  </Button>
                </Table.Td>
              )}
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
        title={isReturn ? 'Повернення від покупця на склад' : purchase ? 'Приймання на склад' : 'Відвантаження зі складу'}
        size="lg"
      >
        <Stack>
          <Text fw={600}>
            {state.store} · № {doc.number}
          </Text>
          <Impact state={state} />
          <Text>
            {isReturn ? 'До повернення клієнту' : purchase ? 'До сплати постачальнику' : 'До отримання від клієнта'} після проведення · {amount(state.total)}
          </Text>
          {openingWarning}
          {reservedWarning}
          {purchase && unlinked.length > 0 && (
            canLinkShop ? (
              <Checkbox
                checked={linkUnlinkedToShop}
                disabled={busy}
                onChange={(e) => setLinkUnlinkedToShop(e.currentTarget.checked)}
                label={`Прив’язати непідключені товари (${unlinked.length}) до вітрини складу «${state.store}»`}
                description="Одразу синхронізує новий складський залишок цих товарів із вітриною інтернет-магазину."
              />
            ) : (
              <Alert color="blue" variant="light">
                {unlinked.length} товар(ів) не прив’язано до складу вітрини — їхній залишок на сайті не зміниться, доки склад не підключить адміністратор.
              </Alert>
            )
          )}
          {negative && <Alert color="orange">На цьому складі бракує товару. Перевірте склад і надходження.</Alert>}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" onClick={close} disabled={busy}>
              Закрити
            </Button>
            <Button
              disabled={negative || reservedConflict || !draft}
              loading={busy}
              onClick={() => submit('post', { revision: state.revision, linkUnlinkedToShop: purchase && unlinked.length > 0 && canLinkShop && linkUnlinkedToShop })}
            >
              {isReturn ? 'Провести повернення' : 'Провести накладну'}
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={action === 'delete'} onClose={close} title="Видалити чернетку?" size="sm">
        <Stack>
          <Text size="sm">
            Чернетку № {doc.number || doc.sourceId} буде видалено без можливості відновлення.
          </Text>
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" onClick={close} disabled={busy}>
              Скасувати
            </Button>
            <Button color="red" loading={busy} onClick={deleteDraft}>
              Видалити чернетку
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={action === 'unpost'} onClose={close} title="Сторнувати проведення?" size="md">
        <Stack>
          <Text size="sm">
            Проведення документа № {doc.number || doc.sourceId} буде скасовано, а складські залишки — відкочені на протилежну кількість.
          </Text>
          {state.payments.length > 0 && (
            <Alert color="orange">
              У документа є зареєстровані оплати ({state.payments.length}). Спочатку сторнуйте їх, інакше документ не можна буде розпровести.
            </Alert>
          )}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" onClick={close} disabled={busy}>
              Скасувати
            </Button>
            <Button color="orange" loading={busy} onClick={unpostDocument}>
              Сторнувати проведення
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={reversingPayment !== null} onClose={close} title="Сторнувати оплату?" size="sm">
        <Stack>
          {reversingPayment && (
            <Text size="sm">
              Сторнувати платіж на суму <b>{amount(reversingPayment.amount)}</b> від {reversingPayment.day} ({reversingPayment.reference})? Залишок боргу за документом перерахується автоматично.
            </Text>
          )}
          {error && <Alert color="red">{error}</Alert>}
          <Group justify="end">
            <Button variant="default" onClick={close} disabled={busy}>
              Скасувати
            </Button>
            <Button color="red" loading={busy} onClick={reversePayment}>
              Сторнувати оплату
            </Button>
          </Group>
        </Stack>
      </Modal>
      {action === 'pay' && (
        <PaymentForm
          due={state.due ?? '0.00'}
          minDay={doc.day ?? ''}
          purchase={purchase || isReturn}
          titleOverride={isReturn ? 'Повернення коштів клієнту' : undefined}
          submitLabel={isReturn ? 'Зареєструвати повернення коштів' : undefined}
          error={error}
          busy={busy}
          close={close}
          submit={(body) => submit('payments', body)}
        />
      )}
      {action === 'edit' && doc.partnerId && (
        <EditRegister
          kind={isReturn ? 'customerReturn' : doc.kind!}
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
  const showReserved = state.stock.some((l) => l.reservedQuantity != null && l.reservedQuantity > 0)
  return (
    <Grid columns={['Товар', 'Було', 'Рух', 'Стане / стало', ...(showReserved ? ['У резерві'] : [])]}>
      {state.stock.map((l) => {
        const belowReserve = l.reservedQuantity != null && l.after < l.reservedQuantity
        return (
          <Table.Tr key={l.productId}>
            <Table.Td>{l.title}</Table.Td>
            <Table.Td>{qtyFmt.format(l.before)}</Table.Td>
            <Table.Td>
              {l.change > 0 ? '+' : ''}
              {qtyFmt.format(l.change)}
            </Table.Td>
            <Table.Td c={l.after < 0 || belowReserve ? 'red' : undefined}>{qtyFmt.format(l.after)}</Table.Td>
            {showReserved && (
              <Table.Td c={belowReserve ? 'orange' : undefined}>
                {l.reservedQuantity != null ? qtyFmt.format(l.reservedQuantity) : '—'}
              </Table.Td>
            )}
          </Table.Tr>
        )
      })}
    </Grid>
  )
}

export function PaymentForm({
  due,
  minDay,
  purchase,
  titleOverride,
  submitLabel,
  error,
  busy,
  close,
  submit,
  balanceLabel = 'Залишок за накладною',
}: {
  due: string
  minDay: string
  purchase: boolean
  titleOverride?: string
  submitLabel?: string
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
    <Modal opened onClose={close} title={titleOverride ?? (purchase ? 'Виплата постачальнику' : 'Оплата від клієнта')}>
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
            {submitLabel ?? `Зареєструвати ${purchase ? 'виплату' : 'оплату'}`}
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
