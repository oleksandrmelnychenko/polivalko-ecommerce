import { Button, Select, Table, TextInput } from '@mantine/core'
import {
  IconBuilding,
  IconChevronRight,
  IconFileDescription,
  IconFilterOff,
  IconPlus,
  IconScale,
  IconSearch,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import { useState } from 'react'
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
import { PartnerDocuments } from './PartnerDocuments'
import { PartnerOpeningList } from './PartnerOpenings'
import { Grid } from './RegisterTable'
import { currencyLabel, money, read, useRegister, type Page, type Partner, type PartnerCard } from './api'
import './partners.css'

const directory = '/accounting/partners'
const balancesLink = (title: string) => '/accounting/balances?' + new URLSearchParams({ q: title })
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
  const { can } = usePermissions()
  const query = useApiQuery('partner-directory', loadDirectory)
  const search = list.get('q') ?? ''
  const category = list.get('category') ?? ''
  const kind = list.get('kind') ?? ''
  const size = normalizePageSize(list.get('pageSize'))
  const rows = query.data ?? []
  const categories = [...new Set(rows.flatMap((row) => (row.category ? [row.category] : [])))].sort((a, b) =>
    a.localeCompare(b, 'uk'),
  )
  const kinds = [...new Set(rows.flatMap((row) => (row.kind ? [row.kind] : [])))]
  const term = normalize(search)
  const filtered = rows.filter(
    (row) =>
      (!kind || row.kind === kind) &&
      (!category || row.category === category) &&
      (!term || normalize(row.title).includes(term) || normalize(row.sourceId).includes(term)),
  )
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
            <Button size="sm" radius="xl" leftSection={<IconPlus size={15} />} onClick={() => setAdding(true)}>
              Додати контрагента
            </Button>
          )}
        </header>
      <FilterBar
        activeCount={Number(Boolean(kind)) + Number(Boolean(category))}
        search={
          <TextInput
            className="app-filter-wide"
            type="search"
            aria-label="Пошук контрагента"
            placeholder="Назва або код…"
            value={search}
            leftSection={<IconSearch size={16} stroke={1.7} />}
            onChange={(e) => update({ q: e.currentTarget.value })}
          />
        }
        actions={
          <>
            {(kind || category || search) && (
              <Button
                variant="subtle"
                aria-label="Скинути фільтри"
                onClick={() => update({ q: '', kind: '', category: '' })}
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
                      <strong>{row.title}</strong>
                    </PartnerDetailLink>
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
  const [params] = useSearchParams()
  const section = params.get('section')
  const active = section === 'balances' || section === 'agreements' ? section : 'documents'
  const detail = useRegister<PartnerCard>('partners/' + id)
  const positions = useRegister<components['schemas']['PartnerPosition'][]>('partners/' + id + '/positions', active === 'balances')
  const partner = detail.data?.partner
  return (
    <AppEditorModal opened={opened} onClose={() => setOpened(false)} size="wide" className="ledger-editor partner-modal"
      closeOnEscape={!operationOpen} closeOnClickOutside={!operationOpen} trapFocus={!operationOpen}
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
            <span className="partner-id">Код <code>{partner.sourceId}</code></span>
            {can(PermissionKeys.Analytics.ViewProducts) && can(PermissionKeys.Accounting.Edit) &&
              <Button component={Link} size="xs" to={'/sales/business-analytics?tab=offers&partner=' + id}>Підготувати пропозицію</Button>}
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
                <Button component={Link} size="xs" rightSection={<IconChevronRight size={15} />} to={balancesLink(partner.title)}>
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
    </div>
    </AppEditorModal>
  )
}
