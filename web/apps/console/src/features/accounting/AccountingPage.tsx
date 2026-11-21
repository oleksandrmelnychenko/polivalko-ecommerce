import { Button, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconArrowLeft, IconBox, IconFileInvoice, IconFiles, IconLink, IconPackageImport, IconPlus, IconSearch } from '@tabler/icons-react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { EditRegister } from './EditRegister'
import { Balances } from './Balances'
import { ProductHistory } from './ProductHistory'
import { Grid } from './RegisterTable'
import { Workplace, WarehousePage } from './Workplace'
import { InvoiceActions } from './InvoiceActions'
import { PartnersDirectory } from './Partners'
import {
  kindName,
  money,
  paymentNames,
  statusNames,
  useRegister,
  type Card,
  type Doc,
  type Page,
} from './api'
import './registers.css'

function PartnerLink({ doc }: { doc: Doc }) {
  return doc.partnerId
    ? <Link to={'/accounting/partners/' + doc.partnerId}>{doc.partnerTitle || 'Контрагент'}</Link>
    : <>{doc.partnerTitle || '—'}</>
}

function DocumentStatus({ doc }: { doc: Doc }) {
  return <span className="doc-status" data-status={doc.status}>{statusNames[doc.status ?? ''] ?? doc.status ?? '—'}</span>
}

function DocTable({ rows, incoming = false }: { rows: Doc[]; incoming?: boolean }) {
  const location = useLocation()
  const returnState = ['/accounting/documents', '/accounting/incoming', '/accounting/outgoing'].includes(location.pathname)
    ? { registerPath: location.pathname, registerSearch: location.search }
    : location.state
  return (
    <div className="doc-list">
      <Grid columns={['Документ', incoming ? 'Постачальник' : 'Контрагент', 'Дата', 'Стан документа', 'Сума', 'Оплата', ...(incoming ? ['До сплати'] : [])]}>
        {rows.map((d) => (
          <Table.Tr key={d.id}>
            <Table.Td className="doc-name">
              <Link to={'/accounting/documents/' + d.id} state={returnState}>
                {kindName(d) || 'Документ'} № <span>{d.number || d.sourceId}</span>
              </Link>
              {d.organization && <small>{d.organization}</small>}
            </Table.Td>
            <Table.Td data-label={incoming ? 'Постачальник' : 'Контрагент'}><PartnerLink doc={d} /></Table.Td>
            <Table.Td data-label="Дата" className="ledger-number">{d.day ?? '—'}</Table.Td>
            <Table.Td data-label="Стан документа"><DocumentStatus doc={d} /></Table.Td>
            <Table.Td data-label="Сума" className="register-money">{money(d.amount, d.currency)}</Table.Td>
            <Table.Td data-label="Оплата">{paymentNames[d.paymentStatus ?? ''] ?? d.paymentStatus ?? '—'}</Table.Td>
            {incoming && <Table.Td data-label="До сплати" className="register-money">{money(d.due ?? null, d.currency)}</Table.Td>}
          </Table.Tr>
        ))}
      </Grid>
    </div>
  )
}

function Document({ id }: { id: string }) {
  const { state } = useLocation()
  const result = useRegister<Card>('documents/' + id)
  if (!result.data)
    return <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />
  const { document: d, lines, parents, related } = result.data
  const title = (kindName(d) || 'Документ') + ' № ' + (d.number || d.sourceId)
  const fromPartner = typeof state?.partnerId === 'string'
  const registerPath = ['/accounting/documents', '/accounting/incoming', '/accounting/outgoing'].includes(state?.registerPath)
    ? state.registerPath : '/accounting/documents'
  return (
    <Stack gap="sm" className="ledger-workspace ledger-document">
      <PageHeader title={title} />
      <Button component={Link} variant="default" radius="xl" className="partner-return" leftSection={<IconArrowLeft size={16} />}
        to={fromPartner
          ? { pathname: '/accounting/partners/' + encodeURIComponent(state.partnerId), search: state.documentSearch }
          : { pathname: registerPath, search: state?.registerSearch }}
        state={fromPartner ? state.partnerState : undefined}>
        {fromPartner ? 'До картки контрагента' : 'До списку документів'}
      </Button>
      <section className="ledger-card doc-summary">
        <div className="doc-heading">
          <span className="doc-symbol"><IconFileInvoice size={23} aria-hidden="true" /></span>
          <div><h2>{title}</h2><div className="doc-meta"><time>{d.day ?? '—'}</time><DocumentStatus doc={d} /></div></div>
          <div className="doc-amount"><span>Сума документа</span><strong>{money(d.amount, d.currency)}</strong></div>
        </div>
        <dl className="doc-facts">
          <div><dt>Контрагент</dt><dd><PartnerLink doc={d} /></dd></div>
          <div><dt>Організація</dt><dd>{d.organization || '—'}</dd></div>
          <div><dt>Договір</dt><dd>{d.agreement || '—'}</dd></div>
          <div><dt>Оплата</dt><dd>{paymentNames[d.paymentStatus ?? ''] ?? d.paymentStatus ?? '—'}</dd></div>
          <div><dt>Код документа</dt><dd className="doc-code">{d.sourceId}</dd></div>
        </dl>
      </section>
      {d.sourceAccount === 'polivalko-native' && d.entityType === 'invoice' && (
        <InvoiceActions key={d.id} doc={d} lines={lines} refresh={result.reload} />
      )}
      {d.partnerRef && !d.partnerId && (
        <Text c="orange">Контрагента з кодом {d.partnerRef} потрібно звірити з довідником.</Text>
      )}
      {lines.length > 0 && (
        <section className="ledger-card doc-lines">
          <header className="ledger-card-head"><h2><MetricLabel icon={IconBox}>Товари</MetricLabel></h2><span className="ledger-count">{lines.length}</span></header>
          <Grid columns={['№', 'Товар', 'Артикул', 'Склад', 'Кількість', 'Ціна', 'Сума']}>
            {lines.map((l) => (
              <Table.Tr key={l.position}>
                <Table.Td data-label="№" className="ledger-number">{l.position}</Table.Td>
                <Table.Td>
                  {l.productRef ? (
                    <Link
                      to={
                        '/accounting/product-history?' +
                        new URLSearchParams({ account: d.sourceAccount, productRef: l.productRef })
                      }
                    >
                      {l.product || l.productRef}
                    </Link>
                  ) : (
                    l.product || '—'
                  )}
                  <Text c="dimmed" size="xs">
                    {l.catalogId ? (
                      <Link to={'/catalog/products/' + l.catalogId}>Картка в каталозі</Link>
                    ) : (
                      'Історичний товар'
                    )}
                  </Text>
                </Table.Td>
                <Table.Td data-label="Артикул" className="ledger-number">{l.sku || '—'}</Table.Td>
                <Table.Td data-label="Склад">{l.store || '—'}</Table.Td>
                <Table.Td data-label="Кількість" className="ledger-number">{l.quantity ?? '—'}</Table.Td>
                <Table.Td data-label="Ціна" className="ledger-number">{money(l.price)}</Table.Td>
                <Table.Td data-label="Сума" className="ledger-number">{money(l.total, d.currency)}</Table.Td>
              </Table.Tr>
            ))}
          </Grid>
        </section>
      )}
      {d.parentRef && (
        <section className="ledger-card">
          <header className="ledger-card-head"><h2><MetricLabel icon={IconFileInvoice}>Документ-підстава</MetricLabel></h2></header>
          {parents.length === 1 ? <DocTable rows={parents} /> : <Text>Потребує звірки · {d.parentRef}</Text>}
        </section>
      )}
      <section className="ledger-card">
        <header className="ledger-card-head"><h2><MetricLabel icon={IconLink}>Пов’язані документи й оплати</MetricLabel></h2></header>
        {related.length ? (
          <DocTable rows={related} />
        ) : (
          <Text className="ledger-note" c="dimmed">Документів із посиланням на цей запис немає.</Text>
        )}
      </section>
    </Stack>
  )
}

function Register({ section, sourceSwitch }: { section: string; sourceSwitch?: React.ReactNode }) {
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState(false)
  const { can } = usePermissions()
  const direction = section === 'incoming' ? 'in' : section === 'outgoing' ? 'out' : null
  const returns = section === 'returns'
  const title = returns ? 'Повернення' : direction === 'in' ? 'Прибуткові накладні' : direction === 'out' ? 'Видаткові накладні' : 'Документи'
  const filter = new URLSearchParams(params)
  filter.delete('source')
  if (returns) filter.set('register', 'customerReturn')
  else if (direction) filter.set('register', direction)
  else filter.delete('register')
  const query = useRegister<Page<Doc>>('documents?' + filter)
  const page = Math.max(1, Number(params.get('page')) || 1)
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (returns) next.set('source', 'accounting')
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack gap="sm" className="ledger-workspace doc-register" data-incoming={direction === 'in' || undefined}>
      <PageHeader title={title} actions={sourceSwitch ?? (direction && can(PermissionKeys.Accounting.Edit) && (
        <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => setEdit(true)}>Створити накладну</Button>
      ))} />
      <section className="ledger-card">
        <header className="ledger-card-head"><h2><MetricLabel icon={direction === 'in' ? IconPackageImport : IconFiles}>{returns ? 'Повернення від покупців' : direction === 'in' ? 'Надходження від постачальників' : direction ? 'Журнал накладних' : 'Реєстр документів'}</MetricLabel></h2>
          {query.data && <span className="ledger-count">Записів · {query.data.total.toLocaleString('uk-UA')}</span>}
        </header>
        <FilterBar label="Фільтри документів" activeCount={['from', 'to', 'status'].filter((key) => params.has(key)).length}
          actions={<Paginator page={page} pageSize={50} totalPages={query.data && Math.ceil(query.data.total / 50)}
            isLoading={query.isFetching} onPageChange={(p) => change('page', String(p))} onRefresh={query.reload} />}
          search={
            <TextInput
              aria-label="Пошук"
              maxLength={160}
              className="app-filter-wide"
              leftSection={<IconSearch size={16} />}
              placeholder={direction === 'in' ? 'Номер, постачальник, організація' : 'Номер, контрагент, організація'}
              value={params.get('q') ?? ''}
              onChange={(e) => change('q', e.currentTarget.value)}
            />
          }
        >
          <TextInput
            type="date"
            label="З дати"
            value={params.get('from') ?? ''}
            max={params.get('to') ?? undefined}
            onChange={(e) => change('from', e.currentTarget.value)}
          />
          <TextInput
            type="date"
            label="До дати"
            value={params.get('to') ?? ''}
            min={params.get('from') ?? undefined}
            onChange={(e) => change('to', e.currentTarget.value)}
          />
          <Select
            label="Статус"
            clearable
            placeholder="Усі"
            data={Object.entries(statusNames).map(([value, label]) => ({ value, label }))}
            value={params.get('status')}
            onChange={(v) => change('status', v ?? '')}
          />
        </FilterBar>
        {query.data ? (
          query.data.total
            ? <DocTable rows={query.data.items} incoming={direction === 'in'} />
            : <PageState kind="empty" title="Записів за цими умовами немає" />
        ) : (
          <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
        )}
      </section>
      {edit && direction && (
        <EditRegister
          kind={direction}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false)
            query.reload()
          }}
        />
      )}
    </Stack>
  )
}

export function AccountingReturnsPage({ sourceSwitch }: { sourceSwitch?: React.ReactNode }) {
  return <div className="accounting-register"><Register section="returns" sourceSwitch={sourceSwitch} /></div>
}

export default function AccountingPage() {
  const section = useLocation().pathname.split('/')[2]
  const { id } = useParams()
  if (section === 'partners') return <PartnersDirectory id={id} />
  if (section === 'work' || section === 'warehouse')
    return <div className="accounting-register">{section === 'work' ? <Workplace /> : <WarehousePage />}</div>
  if (section === 'product-history')
    return (
      <div className="accounting-register">
        <ProductHistory />
      </div>
    )
  return (
    <div className="accounting-register">
      {section === 'balances' ? (
        <Balances />
      ) : section === 'documents' && id ? (
        <Document id={id} />
      ) : (
        <Register key={section} section={section} />
      )}
    </div>
  )
}
