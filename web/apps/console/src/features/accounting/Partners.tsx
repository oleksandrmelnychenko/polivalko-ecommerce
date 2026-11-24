import { Button, Group, SegmentedControl, Select, Table, Text, TextInput } from '@mantine/core'
import {
  IconBuilding,
  IconChevronRight,
  IconFileDescription,
  IconFilterOff,
  IconPencil,
  IconPlus,
  IconSparkles,
  IconScale,
  IconSearch,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { components } from '@polivalko/shared/api/schema'
import { usePermissions } from '@/features/auth'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { FilterBar } from '@/shared/ui/FilterBar'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { PartnerDetailLink } from '@/shared/ui/DocumentLink'
import { TableChip } from '@/shared/ui/TableChip'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { normalizePageSize } from '@/shared/ui/paginator/pageSize'
import { EditRegister } from './EditRegister'
import { duplicateKey, partnerRole, roleOptions } from './lib/partnerNames'
import { namesToClean, PARTNER_NAMES_CHANGED, PartnerNameCleanup, PartnerNameEditor } from './PartnerNames'
import { PartnerDocuments } from './PartnerDocuments'
import { PartnerOpeningList } from './PartnerOpenings'
import { Grid } from './RegisterTable'
import { currencyLabel, money, read, useRegister, type Page, type Partner, type PartnerCard } from './api'
import './partners.css'

const directory = '/finance/partners'
// The balance report matches rows by the card's current name as well, so search by it.
const balancesLink = (partner: Partner) =>
  '/finance/balances?' + new URLSearchParams({ q: partner.title.trim() })
const checks = [
  { value: 'cleanup', label: 'Назва потребує чистки' },
  { value: 'duplicates', label: 'Можливі дублікати' },
]
const kindLabel = (kind: Partner['kind']) =>
  ({ juridical: 'Юридична особа', individual: 'Фізична особа' })[kind ?? ''] ?? (kind || 'Вид не вказано')
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('uk-UA')

async function loadDirectory() {
  const first = await read<Page<Partner>>('partners')
  if (!first.data) return { ...first, data: undefined }
  const records = new Map(first.data.items.map((row) => [row.id, row]))
  const pages = Math.ceil(first.data.total / 50)
  for (let page = 2; page <= pages; page += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - page + 1) }, (_, index) =>
        read<Page<Partner>>('partners?page=' + (page + index)),
      ),
    )
    for (const result of batch) {
      if (!result.data) return { ...result, data: undefined }
      for (const row of result.data.items) records.set(row.id, row)
    }
  }
  return { response: first.response, data: [...records.values()] }
}

function PartnerMark({ kind }: { kind: Partner['kind'] }) {
  const Icon = kind === 'individual' ? IconUser : kind === 'juridical' ? IconBuilding : IconUsers
  return (
    <span className="partner-mark">
      <Icon size={17} stroke={1.7} aria-hidden />
    </span>
  )
}

export function PartnersDirectory({ id }: { id?: string }) {
  return id ? <PartnerProfile key={id} id={id} /> : <DirectoryList />
}

function DirectoryList() {
  const [list] = useSearchParams()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const { can } = usePermissions()
  const query = useApiQuery('partner-directory', loadDirectory)
  const { reload } = query
  useEffect(() => {
    window.addEventListener(PARTNER_NAMES_CHANGED, reload)
    return () => window.removeEventListener(PARTNER_NAMES_CHANGED, reload)
  }, [reload])
  const search = list.get('q') ?? ''
  const category = list.get('category') ?? ''
  const kind = list.get('kind') ?? ''
  const role = list.get('role') ?? ''
  const check = list.get('check') ?? ''
  const size = normalizePageSize(list.get('pageSize'))
  const rows = useMemo(() => query.data ?? [], [query.data])
  const keys = useMemo(() => new Map(rows.map((row) => [row.id, duplicateKey(row.title)])), [rows])
  const keyCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const key of keys.values()) counts.set(key, (counts.get(key) ?? 0) + 1)
    return counts
  }, [keys])
  const unclean = useMemo(() => new Set(namesToClean(rows).map(({ row }) => row.id)), [rows])
  const duplicate = (row: Partner) => (keyCounts.get(keys.get(row.id) ?? '') ?? 0) > 1
  const categories = [...new Set(rows.flatMap((row) => (row.category ? [row.category] : [])))].sort((a, b) =>
    a.localeCompare(b, 'uk'),
  )
  const kinds = [...new Set(rows.flatMap((row) => (row.kind ? [row.kind] : [])))]
  const term = normalize(search)
  const filtered = rows.filter(
    (row) =>
      (!kind || row.kind === kind) &&
      (!category || row.category === category) &&
      (!role || partnerRole(row.category) === role) &&
      (check !== 'cleanup' || unclean.has(row.id)) &&
      (check !== 'duplicates' || duplicate(row)) &&
      (!term || [row.title, row.sourceId, row.note ?? '', row.sourceTitle ?? ''].some((text) => normalize(text).includes(term))),
  )
  if (check === 'duplicates')
    filtered.sort((a, b) => (keys.get(a.id) ?? '').localeCompare(keys.get(b.id) ?? '', 'uk') || a.title.localeCompare(b.title, 'uk'))
  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const requestedPage = Math.trunc(Number(list.get('page'))) || 1
  const page = Math.min(pages, Math.max(1, requestedPage))
  const visible = filtered.slice((page - 1) * size, page * size)

  function update(values: Record<string, string>) {
    const next = new URLSearchParams(window.location.search)
    next.delete('page')
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    navigate({ pathname: directory, search: next.toString() }, { replace: true })
  }

  return (
    <div className="partners-workspace ledger-workspace partner-directory doc-register">
      <PageHeader title="Контрагенти" />
      <section className="ledger-card partner-list" aria-label="Список контрагентів">
        <header className="ledger-card-head">
          <h2><MetricLabel icon={IconUsers}>Довідник контрагентів</MetricLabel></h2>
          {can(PermissionKeys.Accounting.Edit) && (
            <Group gap="xs">
              {unclean.size > 0 && (
                <Button size="sm" radius="xl" variant="default" leftSection={<IconSparkles size={15} />} onClick={() => setCleaning(true)}>
                  Чистка назв · {unclean.size}
                </Button>
              )}
              <Button size="sm" radius="xl" leftSection={<IconPlus size={15} />} onClick={() => setAdding(true)}>
                Додати контрагента
              </Button>
            </Group>
          )}
        </header>
      <FilterBar
        activeCount={[kind, category, check].filter(Boolean).length}
        search={
          <>
            <TextInput
              className="app-filter-wide"
              type="search"
              aria-label="Пошук контрагента"
              placeholder="Назва, опис або код…"
              value={search}
              leftSection={<IconSearch size={16} stroke={1.7} />}
              onChange={(e) => update({ q: e.currentTarget.value })}
            />
            <SegmentedControl
              aria-label="Роль контрагента"
              className="partner-role-switch"
              value={role || 'all'}
              data={[{ value: 'all', label: 'Усі' }, ...roleOptions]}
              onChange={(value) => update({ role: value === 'all' ? '' : value })}
            />
          </>
        }
        actions={
          <>
            {(kind || category || search || role || check) && (
              <Button
                variant="subtle"
                aria-label="Скинути фільтри"
                onClick={() => update({ q: '', kind: '', category: '', role: '', check: '' })}
              >
                <IconFilterOff size={17} />
              </Button>
            )}
            {query.data && (
              <span className="app-filter-summary">Знайдено: {filtered.length.toLocaleString('uk-UA')}</span>
            )}
            <Paginator
              page={page}
              pageSize={size}
              totalPages={pages}
              isLoading={query.isFetching}
              onPageChange={(n) => update({ page: String(n) })}
              onPageSizeChange={(n) => update({ pageSize: String(n) })}
              onRefresh={query.reload}
            />
          </>
        }
      >
        <Select
          label="Перевірка"
          placeholder="Без перевірки"
          clearable
          value={check || null}
          data={checks}
          onChange={(value) => update({ check: value ?? '' })}
        />
        <Select
          label="Вид"
          placeholder="Усі види"
          clearable
          value={kind || null}
          data={kinds.map((value) => ({ value, label: kindLabel(value) }))}
          onChange={(value) => update({ kind: value ?? '' })}
        />
        <Select
          label="Категорія"
          placeholder="Усі категорії"
          searchable
          clearable
          value={category || null}
          data={categories}
          onChange={(value) => update({ category: value ?? '' })}
        />
      </FilterBar>
        {query.status !== 'ready' ? (
          <PageState kind={query.status} onRetry={query.reload} />
        ) : !visible.length ? (
          <PageState kind="empty" title="Контрагентів не знайдено" />
        ) : (
          <table className="partner-table">
            <thead>
              <tr>
                <th scope="col">Контрагент</th>
                <th scope="col">Код</th>
                <th scope="col">Категорія</th>
                <th scope="col">Вид</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>
                    <PartnerDetailLink
                      className="partner-person"
                      id={row.id}
                    >
                      <PartnerMark kind={row.kind} />
                      <span className="partner-name">
                        <strong>{row.title}</strong>
                        {row.note && <small>{row.note}</small>}
                      </span>
                    </PartnerDetailLink>
                    {duplicate(row) && <TableChip tone="warning" value="Можливий дубль" />}
                  </td>
                  <td data-label="Код" className="partner-code">{row.sourceId}</td>
                  <td data-label="Категорія"><TableChip tone={row.category === 'Постачальники' ? 'document' : 'neutral'} value={row.category || 'Без категорії'} /></td>
                  <td data-label="Вид">{kindLabel(row.kind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {cleaning && (
        <PartnerNameCleanup
          rows={rows}
          close={() => setCleaning(false)}
          saved={() => {
            setCleaning(false)
            query.reload()
          }}
        />
      )}
      {adding && (
        <EditRegister
          kind="partner"
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            query.reload()
          }}
        />
      )}
    </div>
  )
}

function PartnerProfile({ id }: { id: string }) {
  const { can } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  const [opened, setOpened] = useState(true)
  const [operationOpen, setOperationOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [params] = useSearchParams()
  const section = params.get('section')
  const active = section === 'balances' || section === 'agreements' ? section : 'documents'
  const detail = useRegister<PartnerCard>('partners/' + id)
  const positions = useRegister<components['schemas']['PartnerPosition'][]>('partners/' + id + '/positions', active === 'balances')
  const partner = detail.data?.partner
  return (
    <AppEditorModal opened={opened} onClose={() => setOpened(false)} size="wide" className="ledger-editor partner-modal"
      closeOnEscape={!operationOpen && !renaming} closeOnClickOutside={!operationOpen && !renaming}
      trapFocus={!operationOpen && !renaming}
      title={<MetricLabel icon={IconUsers}>{partner?.title || 'Картка контрагента'}</MetricLabel>}
      onExitTransitionEnd={() => {
        if (location.state?.documentBackground || location.state?.marketSearch != null || location.state?.balanceSearch != null) navigate(-1)
        else navigate(directory, { replace: true })
      }}>
    <div className="partners-page ledger-workspace">
      {!detail.data || !partner ? (
        <PageState kind={detail.status === 'ready' ? 'empty' : detail.status} onRetry={detail.reload} />
      ) : (
        <>
          <header className="ledger-card partner-identity">
            <PartnerMark kind={partner.kind} />
            <div className="partner-meta">
              <span>{kindLabel(partner.kind)}</span>
              <TableChip tone={partner.category === 'Постачальники' ? 'document' : 'neutral'} value={partner.category || 'Без категорії'} />
            </div>
            {partner.note && <Text size="sm" className="partner-note">{partner.note}</Text>}
            {partner.sourceTitle && partner.sourceTitle.trim() !== partner.title && (
              <Text size="xs" className="partner-note">Назва в DNTrade: {partner.sourceTitle.trim()}</Text>
            )}
            <span className="partner-id">Код <code>{partner.sourceId}</code></span>
            {can(PermissionKeys.Accounting.Edit) && (
              <Button size="xs" variant="default" leftSection={<IconPencil size={14} />} onClick={() => setRenaming(true)}>
                Змінити назву
              </Button>
            )}
            {can(PermissionKeys.Analytics.ViewProducts) && can(PermissionKeys.Accounting.Edit) &&
              <Button component={Link} size="xs" to={'/analytics/business?tab=offers&partner=' + id}>Підготувати пропозицію</Button>}
          </header>
          <nav className="partner-sections" aria-label="Розділи картки контрагента">
            {Object.entries({ documents: 'Документи', balances: 'Взаєморозрахунки', agreements: 'Договори' }).map(([key, label]) => {
              const next = new URLSearchParams(params)
              if (key === 'documents') next.delete('section')
              else next.set('section', key)
              return <Link key={key} replace to={{ search: next.toString() }} state={location.state}
                aria-current={active === key ? 'page' : undefined}>{label}</Link>
            })}
          </nav>
          {active === 'documents' && <section className="ledger-card partner-block"><PartnerDocuments id={id} /></section>}
          {active === 'balances' && <>
            <section className="ledger-card partner-block">
              <header className="partner-balance-heading">
                <h2><MetricLabel icon={IconScale}>Взаєморозрахунки</MetricLabel></h2>
                <Button component={Link} size="xs" rightSection={<IconChevronRight size={15} />} to={balancesLink(partner)}>
                  Перейти до звірки
                </Button>
              </header>
              {!positions.data ? (
                <PageState
                  kind={positions.status === 'ready' ? 'empty' : positions.status}
                  onRetry={positions.reload}
                />
              ) : positions.data.length ? (
                <Grid columns={['Організація', 'До отримання', 'До сплати']}>
                  {positions.data.map((p) => (
                    <Table.Tr key={JSON.stringify([p.organization, p.currency])}>
                      <Table.Td>{p.organization}</Table.Td>
                      <Table.Td data-label="До отримання" className="register-money">{money(p.receivable, p.currency)}</Table.Td>
                      <Table.Td data-label="До сплати" className="register-money">{money(p.payable, p.currency)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Grid>
              ) : (
                <p className="partner-balance-empty">Облікових залишків немає.</p>
              )}
            </section>
            <section className="ledger-card partner-block">
              <PartnerOpeningList partnerId={id} refresh={positions.reload} onDialogChange={setOperationOpen} />
            </section>
          </>}
          {active === 'agreements' && (
            <section className="ledger-card partner-block">
              <h2>
                <MetricLabel icon={IconFileDescription}>Договори · {detail.data.agreements.length}</MetricLabel>
              </h2>
              {detail.data.agreements.length ? (
                <Grid columns={['Договір', 'Валюта', 'Код договору']}>
                  {detail.data.agreements.map((a, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{a.title || '—'}</Table.Td>
                      <Table.Td data-label="Валюта">{currencyLabel(a.currency) || '—'}</Table.Td>
                      <Table.Td data-label="Код договору" className="partner-code">{a.id || '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Grid>
              ) : (
                <p>Договорів немає.</p>
              )}
            </section>
          )}
        </>
      )}
      {renaming && partner && (
        <PartnerNameEditor
          partner={partner}
          close={() => setRenaming(false)}
          saved={() => {
            setRenaming(false)
            detail.reload()
          }}
        />
      )}
    </div>
    </AppEditorModal>
  )
}
