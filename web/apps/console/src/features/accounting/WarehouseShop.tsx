import { Alert, Button, Group, Modal, Pagination, Stack, Table, Text } from '@mantine/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { PageState } from '@/shared/ui/PageState'
import { problemMessage } from '@/shared/api/problem'
import { Grid } from './RegisterTable'
import { save, useRegister, type Page } from './api'

export type WarehouseRow = components['schemas']['WarehouseBalance']
type Movement = components['schemas']['WarehouseMovement']
const quantity = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
export const count = (n: number | null) => (n == null ? '—' : quantity.format(n))
export const activeSource = (r: WarehouseRow) => r.sourceStoreId === r.storeId && r.sourceOrgId === r.orgId

export function ShopSourceForm({ row, close, saved }: { row: WarehouseRow; close: () => void; saved: () => void }) {
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
      if (result.response.ok) saved()
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
    <Modal
      opened
      onClose={() => {
        if (!busy) close()
      }}
      title="Склад для інтернет-магазину"
    >
      <Stack>
        <div>
          <Text fw={600}>{row.product}</Text>
          <Text size="sm" c="dimmed">
            {row.sku}
          </Text>
        </div>
        <Text>
          Поточне джерело ·{' '}
          {row.sourceStore ? [row.sourceOrganization, row.sourceStore].join(' / ') : 'Залишок у каталозі'}
        </Text>
        <Text>
          Вибраний склад ·{' '}
          <b>
            {row.organization} / {row.store}
          </b>
        </Text>
        <Grid columns={['Показник', 'Кількість']}>
          {[
            ['У каталозі зараз', row.shopQuantity],
            ['На вибраному складі', row.quantity],
            ['Резерв замовлень', row.reserved],
            ['Доступно після підключення', available],
          ].map(([label, n]) => (
            <Table.Tr key={String(label)}>
              <Table.Td>{label}</Table.Td>
              <Table.Td>{count(n as number | null)}</Table.Td>
            </Table.Tr>
          ))}
        </Grid>
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
        <Group justify="end">
          <Button variant="default" onClick={close} disabled={busy}>
            Закрити
          </Button>
          <Button
            onClick={submit}
            loading={busy}
            disabled={
              available < 0 || row.quantity > 999999999.999 || (changing && !!row.reserved) || row.shopQuantity == null
            }
          >
            Підключити склад
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function MovementHistory({ row, close }: { row: WarehouseRow; close: () => void }) {
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
    <Modal opened size="lg" onClose={close} title="Рух товару">
      <Stack>
        <Text fw={600}>
          {row.product} · {row.store}
        </Text>
        {query.data ? (
          query.data.items.length ? (
            <>
              <Grid columns={['Дата документа', 'Операція', 'Документ', 'Кількість', 'Після руху']}>
                {query.data.items.map((m) => {
                  const url =
                    m.kind === 'order' && m.reference
                      ? '/sales/orders/' + encodeURIComponent(m.reference)
                      : ['in', 'out'].includes(m.kind)
                        ? '/accounting/documents/' + m.id
                        : null
                  return (
                    <Table.Tr key={m.kind + m.id}>
                      <Table.Td>{m.day}</Table.Td>
                      <Table.Td>{kinds[m.kind]}</Table.Td>
                      <Table.Td>{url ? <Link to={url}>{m.reference || m.id}</Link> : m.reference}</Table.Td>
                      <Table.Td>
                        {m.change > 0 ? '+' : ''}
                        {count(m.change)}
                      </Table.Td>
                      <Table.Td>{count(m.balance)}</Table.Td>
                    </Table.Tr>
                  )
                })}
              </Grid>
              {query.data.total > 50 && (
                <Pagination value={page} total={Math.ceil(query.data.total / 50)} onChange={setPage} />
              )}
            </>
          ) : (
            <Text>Рухів ще немає.</Text>
          )
        ) : (
          <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
        )}
      </Stack>
    </Modal>
  )
}
