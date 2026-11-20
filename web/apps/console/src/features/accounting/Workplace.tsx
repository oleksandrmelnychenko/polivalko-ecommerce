import { Button, Group, Pagination, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import { IconArrowDownLeft, IconArrowUpRight, IconBuildingWarehouse } from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { EditRegister } from './EditRegister'
import { Grid } from './RegisterTable'
import { StockOpeningForm } from './StockOpeningForm'
import { InventoryReview } from './InventoryReview'
import { activeSource, count, ShopSourceForm, MovementHistory, type WarehouseRow } from './WarehouseShop'
import { money, paymentNames, useRegister, type Doc, type Page, type Ref } from './api'

type S = components['schemas']
const queues = [
  { id: 'drafts', title: 'До проведення', empty: 'Чернеток немає' },
  { id: 'receivable', title: 'До отримання', empty: 'Усі проведені продажі оплачені' },
  { id: 'payable', title: 'До сплати', empty: 'Немає відкритих оплат постачальникам' },
  { id: 'settled', title: 'Закриті', empty: 'Повністю оплачених накладних ще немає' },
] as const

export function Workplace() {
  const [params, setParams] = useSearchParams()
  const queue = queues.find((q) => q.id === params.get('queue')) ?? queues[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const counts = useRegister<S['WorkCounts']>('work')
  const docs = useRegister<Page<Doc>>('documents?' + new URLSearchParams({ queue: queue.id, page: String(page) }))
  const [create, setCreate] = useState<'in' | 'out' | null>(null)
  const { can } = usePermissions()
  return (
    <Stack gap="lg">
      <PageHeader title="Робоче місце" />
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Робоче місце</Title>
          <Text size="sm" c="dimmed">
            Накладні та розрахунки вашої команди
          </Text>
        </div>
        <Group gap="xs">
          {can(PermissionKeys.Accounting.Edit) && (
            <>
              <Button variant="default" leftSection={<IconArrowDownLeft size={17} />} onClick={() => setCreate('in')}>
                Прийняти товар
              </Button>
              <Button leftSection={<IconArrowUpRight size={17} />} onClick={() => setCreate('out')}>
                Оформити продаж
              </Button>
            </>
          )}
        </Group>
      </Group>
      <nav aria-label="Черги документів" className="work-queues">
        {queues.map((q) => (
          <button
            type="button"
            key={q.id}
            className={q.id === queue.id ? 'is-active' : ''}
            aria-pressed={q.id === queue.id}
            onClick={() => setParams({ queue: q.id })}
          >
            <span>{q.title}</span>
            <strong>{counts.data?.[q.id] ?? '—'}</strong>
          </button>
        ))}
      </nav>
      <Group justify="space-between">
        <Title order={3}>{queue.title}</Title>
        <Button
          component={Link}
          to="/accounting/warehouse"
          variant="subtle"
          size="compact-sm"
          leftSection={<IconBuildingWarehouse size={16} />}
        >
          Залишки по складах
        </Button>
      </Group>
      {counts.status === 'error' && (
        <Button variant="subtle" onClick={counts.reload}>
          Оновити лічильники
        </Button>
      )}
      {docs.data ? (
        docs.data.total ? (
          <>
            <Grid columns={['Накладна', 'Дата', 'Контрагент', 'Організація', 'Сума', 'Залишок до оплати']}>
              {docs.data.items.map((d) => (
                <Table.Tr key={d.id}>
                  <Table.Td>
                    <Link to={'/accounting/documents/' + d.id}>
                      {d.kind === 'in' ? 'Прибуткова' : 'Видаткова'} № {d.number}
                    </Link>
                  </Table.Td>
                  <Table.Td>{d.day}</Table.Td>
                  <Table.Td>{d.partnerTitle}</Table.Td>
                  <Table.Td>{d.organization}</Table.Td>
                  <Table.Td className="register-money">{money(d.amount, d.currency)}</Table.Td>
                  <Table.Td className="register-money">
                    {money(d.due, d.currency)}
                    {d.paymentStatus && (
                      <Text size="xs" c="dimmed">
                        {paymentNames[d.paymentStatus]}
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Grid>
            {docs.data.total > 50 && (
              <Pagination
                total={Math.ceil(docs.data.total / 50)}
                value={page}
                onChange={(p) => setParams({ queue: queue.id, page: String(p) })}
              />
            )}
          </>
        ) : (
          <PageState
            kind="empty"
            title={queue.empty}
            description="Тут відображаються накладні, створені працівниками консолі."
            action={
              <Group>
                <Link to="/accounting/incoming">Журнал надходжень</Link>
                <Link to="/accounting/outgoing">Журнал продажів</Link>
              </Group>
            }
          />
        )
      ) : (
        <PageState kind={docs.status === 'ready' ? 'empty' : docs.status} onRetry={docs.reload} />
      )}
      {create && (
        <EditRegister
          kind={create}
          onClose={() => setCreate(null)}
          onSaved={() => {
            setCreate(null)
            counts.reload()
            docs.reload()
          }}
        />
      )}
    </Stack>
  )
}

export function WarehousePage() {
  const [params] = useSearchParams()
  return params.get('view') === 'inventory' ? <InventoryReview /> : <WarehouseBalances />
}

function WarehouseBalances() {
  const [params, setParams] = useSearchParams()
  const [opening, setOpening] = useState(false)
  const [source, setSource] = useState<WarehouseRow | null>(null)
  const [history, setHistory] = useState<WarehouseRow | null>(null)
  const { can } = usePermissions()
  const refs = useRegister<{ stores: Ref[] }>('references')
  const result = useRegister<Page<S['WarehouseBalance']>>('warehouse?' + params)
  const page = Math.max(1, Number(params.get('page')) || 1)
  function filter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack>
      <PageHeader title="Складські залишки" />
      <Group justify="space-between">
        <Title order={2}>Складські залишки</Title>
        <Button component={Link} to="/accounting/warehouse?view=inventory" variant="default">
          Звірити перенесені залишки
        </Button>
        {can(PermissionKeys.Accounting.Opening) && (
          <Button variant="default" onClick={() => setOpening(true)}>
            Ввести початковий залишок
          </Button>
        )}
      </Group>
      <Text size="sm" c="dimmed">
        Звірена початкова кількість і проведені в консолі надходження та відвантаження.
      </Text>
      <Group align="end">
        <TextInput
          label="Пошук товару"
          placeholder="Назва або артикул"
          value={params.get('q') ?? ''}
          onChange={(e) => filter('q', e.currentTarget.value)}
        />
        <Select
          label="Склад"
          placeholder="Усі склади"
          clearable
          data={(refs.data?.stores ?? []).map((s) => ({ value: s.id, label: s.title }))}
          value={params.get('store')}
          onChange={(v) => filter('store', v)}
        />
      </Group>
      {result.data ? (
        result.data.total ? (
          <>
            <Grid
              columns={[
                'Товар',
                'Артикул',
                'Організація',
                'Склад',
                'На початок',
                'Залишок',
                'Інтернет-магазин',
                'Операції',
              ]}
            >
              {result.data.items.map((r) => (
                <Table.Tr key={[r.orgId, r.storeId, r.productId].join(':')}>
                  <Table.Td>
                    <Link to={'/catalog/products/' + r.productId}>{r.product}</Link>
                  </Table.Td>
                  <Table.Td>{r.sku}</Table.Td>
                  <Table.Td>{r.organization}</Table.Td>
                  <Table.Td>{r.store}</Table.Td>
                  <Table.Td>{r.opening}</Table.Td>
                  <Table.Td>{r.quantity}</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {activeSource(r)
                        ? 'Підключено цей склад'
                        : r.sourceStore
                          ? 'Інший склад · ' + r.sourceStore
                          : 'Залишок із каталогу'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Доступно ·{' '}
                      {count(r.shopQuantity == null || r.reserved == null ? null : r.shopQuantity - r.reserved)} ·
                      резерв {count(r.reserved)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Button size="compact-xs" variant="subtle" onClick={() => setHistory(r)}>
                      Рух товару
                    </Button>
                    {!activeSource(r) && r.shopQuantity != null && can(PermissionKeys.Catalog.RunImport) && (
                      <Button size="compact-xs" variant="default" onClick={() => setSource(r)}>
                        Підключити склад
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Grid>
            {result.data.total > 50 && (
              <Pagination
                total={Math.ceil(result.data.total / 50)}
                value={page}
                onChange={(p) => filter('page', String(p))}
              />
            )}
          </>
        ) : (
          <PageState kind="empty" title="Немає залишків за цими умовами" />
        )
      ) : (
        <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />
      )}
      {source && (
        <ShopSourceForm
          row={source}
          close={() => {
            setSource(null)
            result.reload()
          }}
          saved={() => {
            setSource(null)
            result.reload()
          }}
        />
      )}
      {history && <MovementHistory row={history} close={() => setHistory(null)} />}
      {opening && (
        <StockOpeningForm
          close={() => setOpening(false)}
          saved={() => {
            setOpening(false)
            result.reload()
          }}
        />
      )}
    </Stack>
  )
}
