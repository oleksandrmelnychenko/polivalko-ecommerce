import { DocumentLink, DocumentOverlayContext } from '@/shared/ui/DocumentLink'
import { Alert, Button, Checkbox, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { IconBuildingStore, IconHistory, IconLink, IconLinkOff, IconPackage } from '@tabler/icons-react'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { notifySuccess } from '@/shared/ui/notify'
import { PageState } from '@/shared/ui/PageState'
import { problemMessage } from '@/shared/api/problem'
import { Grid } from './RegisterTable'
import { remove, save, stockOperationNames, useRegister, type Page, type Ref } from './api'

type BulkWarehouseConnection = { connected: number; skipped: number; conflicts: string[] }
export type DefaultWarehouseSetting = { orgId: string; storeId: string; organization: string; store: string }
type CatalogWarehouseInitResult = { initialized: number; connected: number; skipped: number; conflicts: string[] }
const todayIso = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date())

export type WarehouseRow = components['schemas']['WarehouseBalance']
type Movement = components['schemas']['WarehouseMovement']
const quantity = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
export const count = (n: number | null) => (n == null ? '—' : quantity.format(n))
export const activeSource = (r: WarehouseRow) => r.sourceStoreId === r.storeId && r.sourceOrgId === r.orgId

export function ShopSourceForm({ row, close }: { row: WarehouseRow; close: () => void }) {
  const [opened, setOpened] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save(
        'warehouse/shop-source/' + row.productId,
        {
          orgId: row.orgId,
          storeId: row.storeId,
          expectedOrgId: row.sourceOrgId,
          expectedStoreId: row.sourceStoreId,
          warehouseQuantity: row.quantity,
          shopQuantity: row.shopQuantity,
          reserved: row.reserved,
        },
        'PUT',
      )
      if (result.response.ok) setOpened(false)
      else setError(problemMessage(result.error, 'Не вдалося підключити склад.'))
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }
  const available = row.quantity - (row.reserved ?? 0)
  const changing = !!row.sourceStoreId
  return (
    <AppEditorModal opened={opened} className="ledger-editor warehouse-modal" onExitTransitionEnd={close}
      onClose={() => { if (!busy) setOpened(false) }}
      title={<MetricLabel icon={IconBuildingStore}>Склад для інтернет-магазину</MetricLabel>}
      footer={<Group gap="xs">
        <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Закрити</Button>
        <Button onClick={submit} loading={busy}
          disabled={available < 0 || row.quantity > 999999999.999 || (changing && !!row.reserved) || row.shopQuantity == null}>
          Підключити склад
        </Button>
      </Group>}>
      <Stack gap="sm">
        <section className="ledger-form-block">
          <MetricLabel icon={IconPackage}>{row.product}</MetricLabel>
          <dl className="wh-facts">
            <div><dt>Артикул</dt><dd className="ledger-number">{row.sku}</dd></div>
            <div><dt>Поточне джерело</dt><dd>{row.sourceStore ? [row.sourceOrganization, row.sourceStore].filter(Boolean).join(' / ') : 'Залишок у каталозі'}</dd></div>
            <div><dt>Вибраний склад</dt><dd>{row.organization} / {row.store}</dd></div>
          </dl>
        </section>
        <section className="ledger-form-block">
          <dl className="wh-facts wh-amounts">
            <div><dt>У каталозі зараз</dt><dd>{count(row.shopQuantity)}</dd></div>
            <div><dt>На вибраному складі</dt><dd>{count(row.quantity)}</dd></div>
            <div><dt>Резерв замовлень</dt><dd>{count(row.reserved)}</dd></div>
            <div><dt>Доступно після підключення</dt><dd>{count(available)}</dd></div>
          </dl>
        </section>
        {!row.visible && (
          <Alert color="blue">Товар прихований у каталозі. Публікацію можна змінити у картці товару.</Alert>
        )}
        <Text size="sm">
          Прибуткові й видаткові накладні цього складу змінюватимуть наявність у магазині. Відвантаження
          інтернет-замовлення спише товар із його резерву.
        </Text>
        {changing && !!row.reserved && (
          <Alert color="orange">На поточному складі є резерви. Спочатку завершіть відповідні замовлення.</Alert>
        )}
        {available < 0 && <Alert color="orange">На вибраному складі бракує товару для наявних резервів.</Alert>}
        {error && <Alert color="red">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

export function MovementHistory({ row, close, onRefresh }: { row: WarehouseRow; close: () => void; onRefresh: () => void }) {
  const [opened, setOpened] = useState(true)
  const documentOpen = useContext(DocumentOverlayContext)
  const [page, setPage] = useState(1)
  const query = useRegister<Page<Movement>>(
    'warehouse/' +
      row.productId +
      '/movements?' +
      new URLSearchParams({ org: row.orgId, store: row.storeId, page: String(page) }),
  )
  const kinds: Record<string, string> = {
    opening: 'Початковий залишок',
    in: 'Надходження',
    out: 'Видаткова накладна',
    customerReturn: 'Повернення від покупця',
    order: 'Відвантаження замовлення',
    orderReturn: 'Повернення за замовленням',
    storno: 'Сторно',
    ...stockOperationNames,
  }
  return (
    <AppEditorModal opened={opened} size="standard" className="ledger-editor warehouse-modal" onClose={() => setOpened(false)}
      closeOnEscape={!documentOpen} closeOnClickOutside={!documentOpen} trapFocus={!documentOpen}
      onExitTransitionEnd={close} title={<MetricLabel icon={IconHistory}>Рух товару</MetricLabel>}>
      <Stack gap="sm" className="wh-history">
        <section className="ledger-form-block wh-history-summary">
          <h3><MetricLabel icon={IconPackage}>{row.product}</MetricLabel></h3>
          <dl>
            <div><dt>Артикул</dt><dd className="ledger-number">{row.sku}</dd></div>
            <div><dt>Склад</dt><dd>{row.store}</dd></div>
            <div><dt>Організація</dt><dd>{row.organization}</dd></div>
            <div><dt>На початок</dt><dd className="ledger-number">{count(row.opening)}</dd></div>
            <div><dt>Поточний залишок</dt><dd className="wh-history-balance">{count(row.quantity)}</dd></div>
          </dl>
        </section>
        <section className="ledger-card wh-movements">
          <header className="ledger-card-head">
            <h3><MetricLabel icon={IconHistory}>Історія операцій</MetricLabel></h3>
            <Paginator page={page} pageSize={50} totalPages={query.data && Math.ceil(query.data.total / 50)}
              isLoading={query.isFetching} onPageChange={setPage} onRefresh={() => { query.reload(); onRefresh() }} />
          </header>
          {query.data ? (
            query.data.items.length ? (
              <Grid columns={['Дата документа', 'Операція', 'Документ', 'Зміна', 'Після руху']}>
                {query.data.items.map((m) => {
                  const url =
                    (m.kind === 'order' || m.kind === 'orderReturn') && m.reference
                      ? '/sales/orders/' + encodeURIComponent(m.reference)
                      : null
                  return (
                    <Table.Tr key={m.kind + m.id}>
                      <Table.Td data-label="Дата">{m.day}</Table.Td>
                      <Table.Td data-label="Операція">{kinds[m.kind] ?? m.kind}</Table.Td>
                      <Table.Td data-label="Документ">{m.kind === 'in' || m.kind === 'out' || m.kind === 'customerReturn' || m.kind === 'storno' || m.kind in stockOperationNames ? <DocumentLink id={m.id}>{m.reference || m.id}</DocumentLink> : url ? <Link to={url}>{m.reference || m.id}</Link> : m.reference || '—'}</Table.Td>
                      <Table.Td data-label="Зміна"><span className="wh-change" data-direction={Math.sign(m.change)}>
                        {m.change > 0 ? '+' : ''}
                        {count(m.change)}</span>
                      </Table.Td>
                      <Table.Td data-label="Після руху">{count(m.balance)}</Table.Td>
                    </Table.Tr>
                  )
                })}
              </Grid>
            ) : (
              <p className="ledger-note">Рухів ще немає.</p>
            )
          ) : (
            <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
          )}
        </section>
      </Stack>
    </AppEditorModal>
  )
}

export function BulkShopSourceModal({
  defaultStoreId,
  close,
  onConnected,
}: {
  defaultStoreId?: string | null
  close: () => void
  onConnected: () => void
}) {
  const [opened, setOpened] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [storeId, setStoreId] = useState<string | null>(defaultStoreId ?? null)
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<BulkWarehouseConnection | null>(null)
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')

  const organizations = refs.data?.organizations ?? []
  const stores = refs.data?.stores ?? []
  const effectiveOrgId = orgId ?? (organizations.length === 1 ? organizations[0].id : null)

  async function submit() {
    if (busy || !effectiveOrgId || !storeId) return
    setBusy(true)
    setError('')
    try {
      const result = await save<BulkWarehouseConnection>('warehouse/shop-source/bulk', {
        orgId: effectiveOrgId,
        storeId,
        overwriteExisting,
      })
      if (!result.response.ok || !result.data) {
        setError(problemMessage(result.error, 'Не вдалося прив’язати товари складу до вітрини.'))
        return
      }
      setSummary(result.data)
      notifySuccess(`Прив’язано товарів: ${result.data.connected}.`)
      onConnected()
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppEditorModal
      opened={opened}
      className="ledger-editor warehouse-modal"
      onExitTransitionEnd={close}
      onClose={() => { if (!busy) setOpened(false) }}
      title={<MetricLabel icon={IconLink}>Прив’язати всі товари складу до вітрини</MetricLabel>}
      footer={
        <Group gap="xs">
          <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Закрити</Button>
          {!summary && (
            <Button onClick={submit} loading={busy} disabled={!effectiveOrgId || !storeId}>
              Прив’язати товари
            </Button>
          )}
        </Group>
      }
    >
      <Stack gap="sm">
        <section className="ledger-form-block">
          <Select
            required
            searchable
            label="Організація"
            placeholder="Оберіть організацію"
            data={organizations.map((r) => ({ value: r.id, label: r.title }))}
            value={effectiveOrgId}
            disabled={busy || Boolean(summary)}
            onChange={setOrgId}
          />
          <Select
            required
            searchable
            label="Склад"
            placeholder="Оберіть склад"
            data={stores.map((r) => ({ value: r.id, label: r.title }))}
            value={storeId}
            disabled={busy || Boolean(summary)}
            onChange={setStoreId}
          />
          <Checkbox
            label="Перезаписати товари, вже прив’язані до іншого складу"
            description="Без цієї позначки прив’язуються лише товари, які ще не мають прив’язки до складу."
            checked={overwriteExisting}
            disabled={busy || Boolean(summary)}
            onChange={(e) => setOverwriteExisting(e.currentTarget.checked)}
          />
        </section>
        {summary && (
          <Alert color={summary.conflicts.length > 0 ? 'orange' : 'green'} title="Масову прив’язку завершено">
            <Text size="sm">
              Прив’язано: <b>{summary.connected}</b> · Пропущено: <b>{summary.skipped}</b>
            </Text>
            {summary.conflicts.length > 0 && (
              <Text size="xs" mt={6}>
                Конфлікти ({summary.conflicts.length}): {summary.conflicts.slice(0, 10).join(', ')}
                {summary.conflicts.length > 10 ? '…' : ''}
              </Text>
            )}
          </Alert>
        )}
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

export function DisconnectShopSourceModal({
  row,
  close,
  onDisconnected,
}: {
  row: WarehouseRow
  close: () => void
  onDisconnected: () => void
}) {
  const [opened, setOpened] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await remove('warehouse/shop-source/' + row.productId)
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Не вдалося відв’язати товар від складу.'))
        return
      }
      notifySuccess('Товар відв’язано від складу.')
      onDisconnected()
      setOpened(false)
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppEditorModal
      opened={opened}
      className="ledger-editor warehouse-modal"
      onExitTransitionEnd={close}
      onClose={() => { if (!busy) setOpened(false) }}
      title={<MetricLabel icon={IconLinkOff}>Відв’язати товар від складу</MetricLabel>}
      footer={
        <Group gap="xs">
          <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Скасувати</Button>
          <Button color="red" onClick={submit} loading={busy} disabled={Boolean(row.reserved)}>
            Відв’язати
          </Button>
        </Group>
      }
    >
      <Stack gap="sm">
        <Text size="sm">
          Відв’язати <b>{row.product}</b> від складу «{row.store}»? Залишок на вітрині перестане автоматично оновлюватися від складських документів.
        </Text>
        {Boolean(row.reserved) && (
          <Alert color="orange">
            У товару є активний резерв інтернет-замовлень ({count(row.reserved)}). Спочатку завершіть або скасуйте відповідні замовлення.
          </Alert>
        )}
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

export function DefaultWarehouseModal({
  current,
  close,
  onSaved,
}: {
  current: DefaultWarehouseSetting | null
  close: () => void
  onSaved: () => void
}) {
  const [opened, setOpened] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(current?.orgId ?? null)
  const [storeId, setStoreId] = useState<string | null>(current?.storeId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')
  const organizations = refs.data?.organizations ?? []
  const stores = refs.data?.stores ?? []
  const effectiveOrgId = orgId ?? (organizations.length === 1 ? organizations[0].id : null)

  async function submit(nextOrg: string | null, nextStore: string | null) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save('warehouse/default-shop-source', { orgId: nextOrg, storeId: nextStore }, 'PUT')
      if (!result.response.ok) {
        setError(problemMessage(result.error, 'Не вдалося зберегти основний склад вітрини.'))
        return
      }
      notifySuccess(nextStore ? 'Основний склад вітрини збережено.' : 'Автоприв’язку нових товарів вимкнено.')
      onSaved()
      setOpened(false)
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppEditorModal
      opened={opened}
      className="ledger-editor warehouse-modal"
      onExitTransitionEnd={close}
      onClose={() => { if (!busy) setOpened(false) }}
      title={<MetricLabel icon={IconBuildingStore}>Основний склад вітрини</MetricLabel>}
      footer={
        <Group gap="xs">
          <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Закрити</Button>
          {current && (
            <Button variant="subtle" color="red" loading={busy} onClick={() => void submit(null, null)}>
              Вимкнути автоприв’язку
            </Button>
          )}
          <Button loading={busy} disabled={!effectiveOrgId || !storeId} onClick={() => void submit(effectiveOrgId, storeId)}>
            Зберегти
          </Button>
        </Group>
      }
    >
      <Stack gap="sm">
        <Text size="sm">
          Усі нові товари, створені в каталозі, автоматично прив’язуватимуться до вибраного складу: щойно товар оприбуткують, його залишок одразу оновиться на вітрині.
        </Text>
        <section className="ledger-form-block">
          <Select
            required
            searchable
            label="Організація"
            placeholder="Оберіть організацію"
            data={organizations.map((r) => ({ value: r.id, label: r.title }))}
            value={effectiveOrgId}
            disabled={busy}
            onChange={setOrgId}
          />
          <Select
            required
            searchable
            label="Склад"
            placeholder="Оберіть склад"
            data={stores.map((r) => ({ value: r.id, label: r.title }))}
            value={storeId}
            disabled={busy}
            onChange={setStoreId}
          />
        </section>
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}

export function InitializeFromCatalogModal({
  defaultOrgId,
  defaultStoreId,
  close,
  onInitialized,
}: {
  defaultOrgId?: string | null
  defaultStoreId?: string | null
  close: () => void
  onInitialized: () => void
}) {
  const [opened, setOpened] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(defaultOrgId ?? null)
  const [storeId, setStoreId] = useState<string | null>(defaultStoreId ?? null)
  const [day, setDay] = useState(todayIso)
  const [reference, setReference] = useState('Перенесення залишків із каталогу')
  const [includeZeroStock, setIncludeZeroStock] = useState(false)
  const [setAsDefault, setSetAsDefault] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<CatalogWarehouseInitResult | null>(null)
  const refs = useRegister<{ organizations: Ref[]; stores: Ref[] }>('references')

  const organizations = refs.data?.organizations ?? []
  const stores = refs.data?.stores ?? []
  const effectiveOrgId = orgId ?? (organizations.length === 1 ? organizations[0].id : null)

  async function submit() {
    if (busy || !effectiveOrgId || !storeId || !day || !reference.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await save<CatalogWarehouseInitResult>('warehouse/initialize-from-catalog', {
        orgId: effectiveOrgId,
        storeId,
        day,
        reference: reference.trim(),
        includeZeroStock,
        setAsDefault,
      })
      if (!result.response.ok || !result.data) {
        setError(problemMessage(result.error, 'Не вдалося перенести залишки з каталогу.'))
        return
      }
      setSummary(result.data)
      notifySuccess(`Перенесено на склад і прив’язано товарів: ${result.data.initialized}.`)
      onInitialized()
    } catch {
      setError('Немає зв’язку із сервером. Повторіть дію.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppEditorModal
      opened={opened}
      className="ledger-editor warehouse-modal"
      onExitTransitionEnd={close}
      onClose={() => { if (!busy) setOpened(false) }}
      title={<MetricLabel icon={IconBuildingStore}>Перенести залишки з каталогу на склад</MetricLabel>}
      footer={
        <Group gap="xs">
          <Button variant="default" onClick={() => setOpened(false)} disabled={busy}>Закрити</Button>
          {!summary && (
            <Button onClick={submit} loading={busy} disabled={!effectiveOrgId || !storeId || !day || !reference.trim()}>
              Перенести та прив’язати
            </Button>
          )}
        </Group>
      }
    >
      <Stack gap="sm">
        <Text size="sm">
          Створить початкові залишки на вибраному складі для всіх неархівних товарів каталогу, які ще не прив’язані до складу, й одразу підключить цей склад до вітрини.
        </Text>
        <section className="ledger-form-block">
          <Select
            required
            searchable
            label="Організація"
            placeholder="Оберіть організацію"
            data={organizations.map((r) => ({ value: r.id, label: r.title }))}
            value={effectiveOrgId}
            disabled={busy || Boolean(summary)}
            onChange={setOrgId}
          />
          <Select
            required
            searchable
            label="Склад"
            placeholder="Оберіть склад"
            data={stores.map((r) => ({ value: r.id, label: r.title }))}
            value={storeId}
            disabled={busy || Boolean(summary)}
            onChange={setStoreId}
          />
          <Group grow>
            <TextInput
              required
              type="date"
              label="Дата початкових залишків"
              value={day}
              disabled={busy || Boolean(summary)}
              onChange={(e) => setDay(e.currentTarget.value)}
            />
            <TextInput
              required
              label="Підстава"
              maxLength={150}
              value={reference}
              disabled={busy || Boolean(summary)}
              onChange={(e) => setReference(e.currentTarget.value)}
            />
          </Group>
          <Checkbox
            label="Встановити як основний склад вітрини для нових товарів"
            checked={setAsDefault}
            disabled={busy || Boolean(summary)}
            onChange={(e) => setSetAsDefault(e.currentTarget.checked)}
          />
          <Checkbox
            label="Також перенести товари з нульовим залишком"
            description="Без позначки переносяться лише позиції з додатним залишком у каталозі."
            checked={includeZeroStock}
            disabled={busy || Boolean(summary)}
            onChange={(e) => setIncludeZeroStock(e.currentTarget.checked)}
          />
        </section>
        {summary && (
          <Alert color={summary.conflicts.length > 0 ? 'orange' : 'green'} title="Перенесення залишків завершено">
            <Text size="sm">
              Перенесено й прив’язано: <b>{summary.initialized}</b> · Пропущено: <b>{summary.skipped}</b>
            </Text>
            {summary.conflicts.length > 0 && (
              <Text size="xs" mt={6}>
                Конфлікти ({summary.conflicts.length}): {summary.conflicts.slice(0, 10).join(', ')}
                {summary.conflicts.length > 10 ? '…' : ''}
              </Text>
            )}
          </Alert>
        )}
        {error && <Alert color="red" role="alert">{error}</Alert>}
      </Stack>
    </AppEditorModal>
  )
}
