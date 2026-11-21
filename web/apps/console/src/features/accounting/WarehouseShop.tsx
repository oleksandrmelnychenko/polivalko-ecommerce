import { DocumentLink, DocumentOverlayContext } from '@/shared/ui/DocumentLink'
import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core'
import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { IconBuildingStore, IconHistory, IconPackage } from '@tabler/icons-react'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { problemMessage } from '@/shared/api/problem'
import { Grid } from './RegisterTable'
import { save, useRegister, type Page } from './api'

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
    order: 'Відвантаження замовлення',
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
                    m.kind === 'order' && m.reference
                      ? '/sales/orders/' + encodeURIComponent(m.reference)
                      : null
                  return (
                    <Table.Tr key={m.kind + m.id}>
                      <Table.Td data-label="Дата">{m.day}</Table.Td>
                      <Table.Td data-label="Операція">{kinds[m.kind] ?? m.kind}</Table.Td>
                      <Table.Td data-label="Документ">{m.kind === 'in' || m.kind === 'out' ? <DocumentLink id={m.id}>{m.reference || m.id}</DocumentLink> : url ? <Link to={url}>{m.reference || m.id}</Link> : m.reference || '—'}</Table.Td>
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
