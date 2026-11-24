import {
  Alert,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { IconArrowLeft, IconChecklist, IconFileText, IconAdjustmentsHorizontal, IconListCheck, IconPackage, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import './inventory-review.css'
import { Link, useSearchParams } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { problemMessage } from '@/shared/api/problem'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Grid } from './RegisterTable'
import { InactiveProductCards } from './InactiveProductCards'
import { save, useRegister, type Ref } from './api'

type S = components['schemas']
type Row = S['InventoryRow']
const descriptions: Record<string, string> = {
  ready: 'Готово до підтвердження',
  confirmed: 'Введено',
  reference: 'Довідковий звіт',
  incomplete: 'Перевірити повноту частин',
  store: 'Перевірити дату або склад',
  duplicate: 'Код повторюється',
  unmatched: 'Немає точного збігу в каталозі',
  quantity: 'Перевірити кількість',
  difference: 'Не сходиться з даними джерела',
  reserved: 'Є резерв у джерелі',
  existing: 'Вже є залишок або рух',
}
const kinds: Record<string, string> = {
  cutover: 'Залишок на дату переходу',
  balances: 'Залишок і резерв',
  reference: 'Попередня оцінка',
  inactive: 'Деактивовані товари',
  unknown: 'Інший формат',
}

export function InventoryReview() {
  const [params, setParams] = useSearchParams()
  const reports = useRegister<S['InventoryReport'][]>('inventory-reports')
  const refs = useRegister<{ organizations: Ref[] }>('references')
  const report = reports.data?.find((r) => r.id === params.get('report')) ?? reports.data?.[0]
  const org = refs.data?.organizations.find((r) => r.id === params.get('org'))
  function filter(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    next.set('view', 'inventory')
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack gap="sm" className="ledger-workspace doc-register inventory-review">
      <PageHeader title="Звірка складських залишків" actions={
        <Button component={Link} to="/warehouse/inventory?view=reports" variant="default" radius="xl" leftSection={<IconArrowLeft size={16} />}>
          Звіти про залишки
        </Button>
      } />
      <section className="ledger-card">
        <header className="ledger-card-head"><h2><MetricLabel icon={IconAdjustmentsHorizontal}>Параметри звірки</MetricLabel></h2></header>
        <div className="inventory-fields">
          <Select
            label="Вихідний звіт"
            searchable
            value={report?.id ?? null}
            data={(reports.data ?? []).map((r) => ({
              value: r.id,
              label: [r.storeName, r.day, kinds[r.kind], r.firstRow != null ? 'з рядка ' + r.firstRow : null]
                .filter(Boolean)
                .join(' · '),
            }))}
            onChange={(v) => filter('report', v)}
          />
          <Select
            label="Організація для початкового залишку"
            searchable
            clearable
            placeholder="Оберіть організацію"
            value={org?.id ?? null}
            data={(refs.data?.organizations ?? []).map((r) => ({ value: r.id, label: r.title }))}
            onChange={(v) => filter('org', v)}
          />
        </div>
        <FilterBar label="Фільтри звірки" activeCount={Number(params.has('status')) + Number(params.has('amount'))}
          search={<TextInput className="app-filter-wide"
          leftSection={<IconSearch size={16} />}
          aria-label="Товар у звіті"
          placeholder="Код або назва"
          maxLength={160}
          value={params.get('q') ?? ''}
          onChange={(e) => filter('q', e.currentTarget.value)}
        />}>
          <Select
            label="Стан звірки"
            value={params.get('status') ?? 'all'}
            onChange={(v) => filter('status', v === 'all' ? null : v)}
            data={[
              { value: 'all', label: 'Усі рядки' },
              { value: 'review', label: 'Усі винятки' },
              ...Object.entries(descriptions).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Select
            label="Кількість у джерелі"
            clearable
            placeholder="Усі залишки"
            value={params.get('amount')}
            onChange={(v) => filter('amount', v)}
            data={[
              { value: 'positive', label: 'Більше нуля' },
              { value: 'zero', label: 'Нульові' },
              { value: 'negative', label: 'Від’ємні' },
            ]}
          />
        </FilterBar>
        {refs.status === 'error' && (
          <Button variant="subtle" onClick={refs.reload}>
            Завантажити організації знову
          </Button>
        )}
        {!org && (
          <Text className="ledger-note" size="sm" c="dimmed">
            Оберіть організацію, щоб перевірити наявні рухи перед введенням залишків.
          </Text>
        )}
      </section>
      {report ? (
        <InventoryRows
          key={report.id + params.toString()}
          report={report}
          org={org}
          params={params}
          changePage={(p) => filter('page', String(p))}
          changeStatus={value => filter('status', value)}
        />
      ) : (
        <PageState
          kind={reports.status === 'ready' ? 'empty' : reports.status}
          title="Складських звітів немає"
          onRetry={reports.reload}
        />
      )}
    </Stack>
  )
}

function InventoryRows({
  report,
  org,
  params,
  changePage,
  changeStatus,
}: {
  report: S['InventoryReport']
  org?: Ref
  params: URLSearchParams
  changeStatus: (value: string | null) => void
  changePage: (page: number) => void
}) {
  const filter = new URLSearchParams(params)
  filter.delete('view')
  filter.delete('report')
  const url = 'inventory-reports/' + report.id
  const query = useRegister<S['InventoryPage']>(url + '?' + filter)
  const [selected, setSelected] = useState<number[]>([])
  const [confirm, setConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { can } = usePermissions()
  const editable = !!org && can(PermissionKeys.Accounting.Opening)
  const rows = query.data?.items ?? []
  const ready = rows.filter((r) => r.status === 'ready')
  const chosen = ready.filter((r) => selected.includes(r.position))
  function toggle(r: Row) {
    setSelected((v) => (v.includes(r.position) ? v.filter((p) => p !== r.position) : [...v, r.position]))
    setMessage('')
  }
  async function submit() {
    if (!editable || !chosen.length || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await save(url + '/confirm', {
        orgId: org!.id,
        storeId: chosen[0].storeId,
        lines: chosen.map((r) => ({ position: r.position, productId: r.productId, quantity: r.quantity })),
      })
      if (result.response.ok) {
        setMessage('Початкові залишки введено · ' + chosen.length)
        setSelected([])
        setConfirm(false)
        query.reload()
      } else {
        setError(problemMessage(result.error, 'Не вдалося ввести залишки.'))
        setConfirm(false)
        setSelected([])
        query.reload()
      }
    } catch {
      setError('Немає відповіді сервера. Можна повторити підтвердження тих самих рядків.')
    } finally {
      setBusy(false)
    }
  }
  if (!query.data) return <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
  const counts = query.data.counts
  return (
    <Stack gap="sm">
      {report.kind === 'cutover' && <InactiveProductCards reportUrl={url} reloadRows={query.reload} />}
      <section className="ledger-card warehouse-list inventory-list">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={IconFileText}>Рядки звіту</MetricLabel></h2>
          <span className="ledger-count">У звіті · {report.rows.toLocaleString('uk-UA')}</span>
        </header>
        <div className="inventory-report-id">{report.sourceId}</div>
        {counts.length > 0 && <div className="inventory-counts" role="group" aria-label="Рядки за станом звірки">
          {counts.map(c => {
            const active = params.get('status') === c.status
            return <button key={c.status} type="button" aria-pressed={active} onClick={() => changeStatus(active ? null : c.status)}>
              {descriptions[c.status] ?? c.status} <strong>{c.count.toLocaleString('uk-UA')}</strong>
            </button>
          })}
        </div>}
        <div className="inventory-toolbar">
          <span className="ledger-count">За фільтром · {query.data.total.toLocaleString('uk-UA')}</span>
          <Paginator page={Number(params.get('page')) || 1} totalPages={Math.ceil(query.data.total / 50)}
            pageSize={50} onPageChange={changePage} isLoading={query.isFetching} onRefresh={query.reload} />
        </div>
        {editable && ready.length > 0 && (
          <Group className="inventory-bulk" justify="space-between">
            <Checkbox
              label="Готові на цій сторінці"
              checked={chosen.length === ready.length}
              indeterminate={chosen.length > 0 && chosen.length < ready.length}
              onChange={(e) => setSelected(e.currentTarget.checked ? ready.map((r) => r.position) : [])}
            />
            <Button
              disabled={!chosen.length}
              onClick={() => {
                setError('')
                setConfirm(true)
              }}
            >
              Перевірити вибрані ({chosen.length})
            </Button>
          </Group>
        )}
        {message && <Alert color="green">{message}</Alert>}
        {error && !confirm && <Alert color="red">{error}</Alert>}
        {rows.length ? (
          <Grid columns={['Рядок', 'Код', 'Товар у джерелі', 'Товар каталогу', 'Залишок', 'Резерв у джерелі', 'Стан']}>
            {rows.map((r) => (
              <Table.Tr key={r.position} data-selected={chosen.some(item => item.position === r.position) || undefined}>
                <Table.Td data-label="Рядок" className="ledger-number">
                  {editable && r.status === 'ready' ? (
                    <Checkbox
                      label={String(r.position)}
                      checked={selected.includes(r.position)}
                      onChange={() => toggle(r)}
                    />
                  ) : (
                    r.position
                  )}
                </Table.Td>
                <Table.Td className="ledger-number" data-label="Код">{r.code}</Table.Td>
                <Table.Td className="inventory-product" data-label="Товар у джерелі">{r.title}</Table.Td>
                <Table.Td data-label="Товар каталогу">
                  {r.productId ? <Link to={'/catalog/products/' + r.productId}>{r.productName}</Link> : '—'}
                </Table.Td>
                <Table.Td className="inventory-number" data-label="Залишок">
                  {r.quantityText ?? '—'} {r.unit}
                </Table.Td>
                <Table.Td className="inventory-number" data-label="Резерв у джерелі">{r.booked ?? '—'}</Table.Td>
                <Table.Td data-label="Стан"><span className="inventory-status" data-status={r.status}>{descriptions[r.status] ?? r.status}</span></Table.Td>
              </Table.Tr>
            ))}
          </Grid>
        ) : (
          <PageState kind="empty" title="Рядків за цими умовами немає" />
        )}
      </section>
      <AppEditorModal opened={confirm} onClose={() => { if (!busy) setConfirm(false) }}
        title={<MetricLabel icon={IconListCheck}>Підтвердження початкових залишків</MetricLabel>}
        size="standard" className="ledger-editor inventory-modal"
        footer={<>
          <span className="ledger-count">Вибрано рядків · {chosen.length}</span>
          <Group gap="xs">
            <Button variant="default" disabled={busy} onClick={() => setConfirm(false)}>Назад</Button>
            <Button loading={busy} disabled={!chosen.length} onClick={submit}>Ввести залишки</Button>
          </Group>
        </>}>
        <Stack gap="sm">
          <section className="ledger-form-block">
            <h3><MetricLabel icon={IconChecklist}>Реквізити звірки</MetricLabel></h3>
            <dl className="inventory-facts">
              <div><dt>Організація</dt><dd>{org?.title}</dd></div>
              <div><dt>Склад</dt><dd>{report.storeName ?? '—'}</dd></div>
              <div><dt>Дата залишків</dt><dd className="ledger-number">{report.day ?? '—'}</dd></div>
            </dl>
          </section>
          <section className="ledger-card inventory-confirm-lines">
            <header className="ledger-card-head"><h2><MetricLabel icon={IconPackage}>Вибрані товари</MetricLabel></h2></header>
            <Grid columns={['Рядок', 'Товар', 'Звірена кількість']}>
              {chosen.map((r) => (
                <Table.Tr key={r.position}>
                  <Table.Td className="ledger-number">{r.position}</Table.Td>
                  <Table.Td>{r.productName}</Table.Td>
                  <Table.Td className="inventory-number">
                    {r.quantityText} {r.unit}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Grid>
          </section>
          <Text size="sm" c="dimmed">
            Підтвердження запише початкову кількість на цей склад. Вибір складу для магазину виконується окремо.
          </Text>
          {error && <Alert color="red">{error}</Alert>}
        </Stack>
      </AppEditorModal>
    </Stack>
  )
}
