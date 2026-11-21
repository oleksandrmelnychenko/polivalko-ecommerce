import { DocumentLink } from '@/shared/ui/DocumentLink'
import { Button, Group, Pagination, SegmentedControl, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconArrowDownLeft, IconArrowUpRight, IconBuildingWarehouse, IconChecklist, IconFilePencil, IconFiles, IconWallet, IconHistory, IconPackage, IconPlus, IconSearch, IconListCheck } from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { EditRegister } from './EditRegister'
import { Grid } from './RegisterTable'
import { StockOpeningForm } from './StockOpeningForm'
import './warehouse.css'
import { InventoryReview } from './InventoryReview'
import { WarehouseReports } from './WarehouseReports'
import { activeSource, count, ShopSourceForm, MovementHistory, type WarehouseRow } from './WarehouseShop'
import { money, paymentNames, useRegister, type Doc, type Page, type Ref } from './api'

type S = components['schemas']
const queues = [
  { id: 'drafts', icon: IconFilePencil, title: 'До проведення', empty: 'Чернеток немає' },
  { id: 'receivable', icon: IconArrowDownLeft, title: 'До отримання', empty: 'Усі проведені продажі оплачені' },
  { id: 'payable', icon: IconWallet, title: 'До сплати', empty: 'Немає відкритих оплат постачальникам' },
  { id: 'settled', icon: IconChecklist, title: 'Закриті', empty: 'Повністю оплачених накладних ще немає' },
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
    <Stack gap="sm" className="ledger-workspace">
      <PageHeader title="Робоче місце" actions={can(PermissionKeys.Accounting.Edit) && (
        <Group gap="xs">
          <Button radius="xl" variant="default" leftSection={<IconArrowDownLeft size={16} />} onClick={() => setCreate('in')}>Прийняти товар</Button>
          <Button radius="xl" leftSection={<IconArrowUpRight size={16} />} onClick={() => setCreate('out')}>Оформити продаж</Button>
        </Group>
      )} />
      <nav aria-label="Черги документів" className="work-queues">
        {queues.map((q) => (
          <button
            type="button"
            key={q.id}
            className={q.id === queue.id ? 'is-active' : ''}
            aria-pressed={q.id === queue.id}
            onClick={() => setParams({ queue: q.id })}
          >
            <MetricLabel icon={q.icon}>{q.title}</MetricLabel>
            <strong>{counts.data?.[q.id]?.toLocaleString('uk-UA') ?? '—'}</strong>
          </button>
        ))}
      </nav>
      <section className="ledger-card">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={IconFiles}>{queue.title}</MetricLabel></h2>
          <Button
            component={Link}
            to="/accounting/warehouse"
            variant="default"
            size="xs"
            leftSection={<IconBuildingWarehouse size={16} />}
          >
            Залишки на складах
          </Button>
        </header>
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
                      <DocumentLink id={d.id}>
                        {d.kind === 'in' ? 'Прибуткова' : 'Видаткова'} № {d.number}
                      </DocumentLink>
                    </Table.Td>
                    <Table.Td className="ledger-number">{d.day}</Table.Td>
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
              action={
                <Group>
                  <Button component={Link} to="/accounting/incoming" variant="default" size="xs">Журнал надходжень</Button>
                  <Button component={Link} to="/accounting/outgoing" variant="default" size="xs">Журнал продажів</Button>
                </Group>
              }
            />
          )
        ) : (
          <PageState kind={docs.status === 'ready' ? 'empty' : docs.status} onRetry={docs.reload} />
        )}
      </section>
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
  const [params, setParams] = useSearchParams()
  const requested = params.get('view') ?? (params.size ? 'current' : null)
  const current = useRegister<Page<WarehouseRow>>('warehouse', requested === null)
  if (requested === 'inventory') return <InventoryReview />
  const view = requested ?? (current.data ? (current.data.total ? 'current' : 'reports') : null)
  return <Stack gap="sm">
    <Group><SegmentedControl aria-label="Джерело складських залишків" value={view ?? ''}
      data={[{ value: 'reports', label: 'Звіти DNTrade' }, { value: 'current', label: 'Проведені залишки' }]}
      onChange={value => setParams({ view: value })} /></Group>
    {view === 'reports' ? <WarehouseReports /> : view ? <WarehouseBalances /> :
      <PageState kind={current.status === 'ready' ? 'empty' : current.status} onRetry={current.reload} />}
  </Stack>
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
    <Stack gap="sm" className="ledger-workspace warehouse-page">
      <PageHeader title="Складські залишки" actions={
        <Group gap="xs">
          <Button component={Link} to="/accounting/warehouse?view=inventory" radius="xl" variant="default"
            leftSection={<IconListCheck size={16} />}>Звірити залишки</Button>
          {can(PermissionKeys.Accounting.Opening) && <Button radius="xl" leftSection={<IconPlus size={16} />}
            onClick={() => setOpening(true)}>Ввести початковий залишок</Button>}
        </Group>
      } />
      <Group align="end" className="ledger-card ledger-filters">
        <TextInput
          leftSection={<IconSearch size={16} />} type="search"
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
      <section className="ledger-card warehouse-list">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={IconBuildingWarehouse}>Залишки за складами</MetricLabel></h2>
          {result.data && <span className="ledger-count">Позицій · {count(result.data.total)}</span>}
        </header>
        {result.data ? result.data.total ? <>
          <Grid columns={['Товар', 'Артикул', 'Склад', 'На початок', 'Залишок', 'Інтернет-магазин', 'Операції']}>
            {result.data.items.map(r => (
              <Table.Tr key={[r.orgId, r.storeId, r.productId].join(':')}>
                <Table.Td className="wh-name"><Link to={'/catalog/products/' + r.productId}>
                  <IconPackage size={16} aria-hidden="true" />{r.product}</Link></Table.Td>
                <Table.Td data-label="Артикул" className="ledger-number">{r.sku}</Table.Td>
                <Table.Td data-label="Склад">{r.store}<small>{r.organization}</small></Table.Td>
                <Table.Td data-label="На початок" className="wh-quantity">{count(r.opening)}</Table.Td>
                <Table.Td data-label="Залишок" className="wh-quantity"><b>{count(r.quantity)}</b></Table.Td>
                <Table.Td className="wh-online" data-label="Інтернет-магазин">
                  <span className="wh-source" data-connected={activeSource(r) || undefined}>
                    {activeSource(r) ? 'Підключено цей склад' : r.sourceStore ? 'Інший склад · ' + r.sourceStore : 'Залишок із каталогу'}
                  </span>
                  <small>Доступно <b>{count(r.shopQuantity == null || r.reserved == null ? null : r.shopQuantity - r.reserved)}</b> · резерв <b>{count(r.reserved)}</b></small>
                </Table.Td>
                <Table.Td className="wh-actions"><Group gap={6}>
                  <Button size="compact-xs" variant="default" leftSection={<IconHistory size={14} />} onClick={() => setHistory(r)}>Рух товару</Button>
                  {!activeSource(r) && r.shopQuantity != null && can(PermissionKeys.Catalog.RunImport) &&
                    <Button size="compact-xs" variant="default" onClick={() => setSource(r)}>Підключити склад</Button>}
                </Group></Table.Td>
              </Table.Tr>
            ))}
          </Grid>
          {result.data.total > 50 && <Pagination total={Math.ceil(result.data.total / 50)} value={page} onChange={p => filter('page', String(p))} />}
        </> : <PageState kind="empty" title={params.has('q') || params.has('store') ? 'За цими умовами позицій немає' : 'Проведених складських залишків поки немає'} /> :
          <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />}
      </section>
      {source && (
        <ShopSourceForm
          row={source}
          close={() => {
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
