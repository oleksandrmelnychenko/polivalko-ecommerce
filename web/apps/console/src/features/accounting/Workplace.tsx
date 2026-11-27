import { DocTable } from './DocumentTable'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { Button, Group, Select, Stack, Table, TextInput } from '@mantine/core'
import { StockOperationRegister } from './StockOperations'
import { IconArrowDownLeft, IconBuilding, IconBuildingWarehouse, IconChecklist, IconFiles, IconWallet, IconHistory, IconLink, IconLinkOff, IconPackage, IconPlus, IconSearch, IconListCheck } from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { MetricLabel, MetricTrack } from '@/shared/ui/MetricCard'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { StockOpeningForm } from './StockOpeningForm'
import './warehouse.css'
import { InventoryReview } from './InventoryReview'
import { ReferencesModal } from './ReferencesModal'
import { activeSource, BulkShopSourceModal, count, DisconnectShopSourceModal, ShopSourceForm, MovementHistory, type WarehouseRow } from './WarehouseShop'
import { useRegister, type Doc, type Page, type Ref } from './api'

type S = components['schemas']
const queues = [
  { id: 'receivable', icon: IconArrowDownLeft, title: 'До отримання', empty: 'Усі проведені продажі оплачені' },
  { id: 'payable', icon: IconWallet, title: 'До сплати', empty: 'Немає відкритих оплат постачальникам' },
  { id: 'settled', icon: IconChecklist, title: 'Закриті', empty: 'Повністю оплачених накладних ще немає' },
] as const

export function Workplace() {
  const [params, setParams] = useSearchParams()
  const queue = queues.find((q) => q.id === params.get('queue')) ?? queues[0]
  const page = Math.max(1, Number(params.get('page')) || 1)
  const counts = useRegister<S['WorkCounts']>('work')
  const search = params.get('q') ?? ''
  const filter = new URLSearchParams({ queue: queue.id, page: String(page) })
  if (search) filter.set('q', search)
  const docs = useRegister<Page<Doc>>('documents?' + filter)
  const totalCount = queues.reduce((sum, q) => sum + (counts.data?.[q.id] ?? 0), 0)
  function updateList(nextQueue: typeof queue.id, nextSearch = search, nextPage = 1) {
    const next = new URLSearchParams({ queue: nextQueue })
    if (nextSearch) next.set('q', nextSearch)
    if (nextPage > 1) next.set('page', String(nextPage))
    setParams(next, { replace: nextQueue === queue.id && nextPage === page })
  }
  return (
    <Stack gap="sm" className="ledger-workspace doc-register work-page">
      <PageHeader title="Оплати й борги" />
      <nav aria-label="Черги документів" className="work-queues">
        {queues.map((q) => (
          <button
            type="button"
            key={q.id}
            className={q.id === queue.id ? 'metric-tile is-active' : 'metric-tile'}
            aria-pressed={q.id === queue.id}
            onClick={() => updateList(q.id)}
          >
            <MetricLabel icon={q.icon}>{q.title}</MetricLabel>
            <strong>{counts.data?.[q.id]?.toLocaleString('uk-UA') ?? '—'}</strong>
            <MetricTrack value={counts.data?.[q.id] ?? 0} max={totalCount} />
          </button>
        ))}
      </nav>
      <section className="ledger-card work-documents">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={IconFiles}>{queue.title}</MetricLabel></h2>
        </header>
        <FilterBar label="Пошук у черзі" search={<TextInput
          className="app-filter-wide" aria-label="Пошук документів" placeholder="Номер, контрагент, організація"
          leftSection={<IconSearch size={16} />} maxLength={160} value={search}
          onChange={event => updateList(queue.id, event.currentTarget.value)} />}
          actions={<Paginator page={page} pageSize={50} totalPages={docs.data && Math.ceil(docs.data.total / 50)}
            isLoading={docs.isFetching} onPageChange={p => updateList(queue.id, search, p)}
            onRefresh={() => { docs.reload(); counts.reload() }} />} />
        {counts.status === 'error' && (
          <Button variant="subtle" onClick={counts.reload}>
            Оновити лічильники
          </Button>
        )}
        {docs.data ? (
          docs.data.total ? (
            <DocTable rows={docs.data.items} direction={queue.id === 'receivable' ? 'out' : queue.id === 'payable' ? 'in' : null}
              balanceLabel={queue.id === 'receivable' ? 'До отримання' : queue.id === 'payable' ? 'До сплати' : 'Залишок до оплати'} />
          ) : (
            <PageState
              kind="empty"
              title={search ? 'Документів за цим запитом немає' : queue.empty}
              action={search ? <Button variant="default" onClick={() => updateList(queue.id, '')}>Очистити пошук</Button> :
                <Group>
                  <Button component={Link} to="/warehouse/incoming" variant="default" size="xs">Прибуткові накладні</Button>
                  <Button component={Link} to="/sales/outgoing" variant="default" size="xs">Видаткові накладні</Button>
                </Group>
              }
            />
          )
        ) : (
          <PageState kind={docs.status === 'ready' ? 'empty' : docs.status} onRetry={docs.reload} />
        )}
      </section>
    </Stack>
  )
}

// Console recounts; the reconciliation of stock reports against the catalog opens from «Залишки».
export function InventoryPage() {
  const [params] = useSearchParams()
  return params.get('view') === 'inventory' ? <InventoryReview /> : <StockOperationRegister kind="recount" />
}

export function WarehouseBalances() {
  const [params, setParams] = useSearchParams()
  const [opening, setOpening] = useState(false)
  const [referencesOpen, setReferencesOpen] = useState(false)
  const [bulkConnectOpen, setBulkConnectOpen] = useState(false)
  const [source, setSource] = useState<WarehouseRow | null>(null)
  const [disconnectRow, setDisconnectRow] = useState<WarehouseRow | null>(null)
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
    <Stack gap="sm" className="ledger-workspace warehouse-page wh-current doc-register">
      <PageHeader title="Залишки" actions={
        <Group gap="xs" wrap="wrap">
          {can(PermissionKeys.Accounting.Edit) && (
            <Button radius="xl" variant="default" leftSection={<IconBuilding size={16} />} onClick={() => setReferencesOpen(true)}>
              Організації та склади
            </Button>
          )}
          {can(PermissionKeys.Catalog.RunImport) && (
            <Button radius="xl" variant="default" leftSection={<IconLink size={16} />} onClick={() => setBulkConnectOpen(true)}>
              Прив’язати до вітрини
            </Button>
          )}
          <Button component={Link} to="/warehouse/inventory?view=inventory" radius="xl" variant="default"
            leftSection={<IconListCheck size={16} />}>Звірити залишки</Button>
          {can(PermissionKeys.Accounting.Opening) && <Button radius="xl" leftSection={<IconPlus size={16} />}
            onClick={() => setOpening(true)}>Ввести початковий залишок</Button>}
        </Group>
      } />
      <section className="ledger-card warehouse-list">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={IconBuildingWarehouse}>Залишки за складами</MetricLabel></h2>
          {result.data && <span className="ledger-count">Позицій · {count(result.data.total)}</span>}
        </header>
        <FilterBar label="Фільтри проведених залишків"
          search={<>
            <TextInput className="app-filter-wide" leftSection={<IconSearch size={16} />} type="search"
              aria-label="Пошук товару" placeholder="Назва або артикул" maxLength={160}
              value={params.get('q') ?? ''} onChange={e => filter('q', e.currentTarget.value)} />
            <Select aria-label="Склад" placeholder="Усі склади" clearable searchable
              data={(refs.data?.stores ?? []).map(s => ({ value: s.id, label: s.title }))}
              value={params.get('store')} onChange={v => filter('store', v)} />
          </>}
          actions={<Paginator page={page} pageSize={50} totalPages={result.data && Math.ceil(result.data.total / 50)}
            isLoading={result.isFetching} onPageChange={p => filter('page', String(p))} onRefresh={result.reload} />} />
        {refs.status === 'error' && <Button variant="subtle" onClick={refs.reload}>Повторити завантаження складів</Button>}
        {result.data ? result.data.total ? (
          <Grid columns={['Артикул', 'Товар', 'Склад', 'На початок', 'Залишок', 'Інтернет-магазин', 'Операції']}>
            {result.data.items.map(r => (
              <Table.Tr key={[r.orgId, r.storeId, r.productId].join(':')}>
                <Table.Td className="wh-code ledger-number" data-label="Артикул"><IconPackage className="doc-row-icon" size={32} aria-hidden="true" />{r.sku || '—'}</Table.Td>
                <Table.Td className="wh-name"><Link to={'/catalog/products/' + r.productId}>{r.product}</Link></Table.Td>
                <Table.Td data-label="Склад">{r.store}<small>{r.organization}</small></Table.Td>
                <Table.Td data-label="На початок" className="wh-quantity">{count(r.opening)}</Table.Td>
                <Table.Td data-label="Залишок" className="wh-quantity"><strong className="wh-stock-value" data-direction={Math.sign(r.quantity)}>{count(r.quantity)}</strong></Table.Td>
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
                  {activeSource(r) && can(PermissionKeys.Catalog.RunImport) &&
                    <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconLinkOff size={13} />} onClick={() => setDisconnectRow(r)}>Відв’язати</Button>}
                </Group></Table.Td>
              </Table.Tr>
            ))}
          </Grid>
        ) : <PageState kind="empty" title={params.has('q') || params.has('store') ? 'За цими умовами позицій немає' : 'Проведених складських залишків поки немає'} /> :
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
      {disconnectRow && (
        <DisconnectShopSourceModal
          row={disconnectRow}
          close={() => setDisconnectRow(null)}
          onDisconnected={result.reload}
        />
      )}
      {bulkConnectOpen && (
        <BulkShopSourceModal
          defaultStoreId={params.get('store')}
          close={() => setBulkConnectOpen(false)}
          onConnected={result.reload}
        />
      )}
      {referencesOpen && (
        <ReferencesModal
          close={() => setReferencesOpen(false)}
          onChanged={() => {
            refs.reload()
            result.reload()
          }}
        />
      )}
      {history && <MovementHistory row={result.data?.items.find(r => r.orgId === history.orgId && r.storeId === history.storeId && r.productId === history.productId) ?? history}
        onRefresh={result.reload} close={() => setHistory(null)} />}
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
