import { DocTable, DocumentStatus, PartnerLink, documentIcon } from './DocumentTable'
import { TableChip } from '@/shared/ui/TableChip'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { Button, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconArrowBackUp, IconBox, IconChevronDown, IconFileInvoice, IconFiles, IconLink, IconPackageExport, IconPackageImport, IconPlus, IconSearch } from '@tabler/icons-react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
  ACCOUNTING_DOCUMENT_CHANGED,
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

function Document({ id }: { id: string }) {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [opened, setOpened] = useState(true)
  const [operationOpen, setOperationOpen] = useState(false)
  const result = useRegister<Card>('documents/' + id)
  const card = result.data
  const title = card ? (kindName(card.document) || 'Документ') + ' № ' + (card.document.number || card.document.sourceId) : 'Картка документа'
  return (
    <AppEditorModal opened={opened} onClose={() => setOpened(false)} size="wide" className="ledger-editor document-modal"
      closeOnEscape={!operationOpen} closeOnClickOutside={!operationOpen} trapFocus={!operationOpen}
      onExitTransitionEnd={() => {
        if (state?.documentBackground) navigate(-1)
        else navigate('/accounting/documents', { replace: true })
      }}
      title={<MetricLabel icon={card ? documentIcon(card.document) : IconFileInvoice}>{title}</MetricLabel>}>
      {card ? <DocumentDetails card={card} onDialogChange={setOperationOpen} reload={() => {
        result.reload()
        window.dispatchEvent(new Event(ACCOUNTING_DOCUMENT_CHANGED))
      }} /> :
        <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />}
    </AppEditorModal>
  )
}

function DocumentDetails({ card, reload, onDialogChange }: { card: Card; reload: () => void; onDialogChange: (opened: boolean) => void }) {
  const { document: d, lines, parents, related } = card
  const partnerLabel = d.entityType === 'invoice' && d.kind === 'in' ? 'Постачальник'
    : d.entityType === 'invoice' && d.kind === 'out' ? 'Покупець' : 'Контрагент'
  return (
    <Stack gap="sm" className="ledger-workspace ledger-document">
      <section className="ledger-card doc-summary">
        <div className="doc-heading">
          <div className="doc-amount"><span>Сума документа</span><div className="doc-value"><strong>{money(d.amount, d.currency)}</strong><DocumentStatus doc={d} /></div></div>
          <time dateTime={d.day ?? undefined}>{d.day ?? '—'}</time>
        </div>
        <dl className="doc-facts">
          <div><dt>{partnerLabel}</dt><dd><PartnerLink doc={d} chip /></dd></div>
          <div><dt>Організація</dt><dd>{d.organization || '—'}</dd></div>
          <div><dt>Договір</dt><dd>{d.agreement || '—'}</dd></div>
          <div><dt>Оплата</dt><dd>{paymentNames[d.paymentStatus ?? ''] ?? d.paymentStatus ?? '—'}</dd></div>
          <div><dt>Код документа</dt><dd className="doc-code">{d.sourceId}</dd></div>
        </dl>
      </section>
      {d.sourceAccount === 'polivalko-native' && d.entityType === 'invoice' && (
        <InvoiceActions key={d.id} doc={d} lines={lines} refresh={reload} onDialogChange={onDialogChange} />
      )}
      {d.partnerRef && !d.partnerId && (
        <Text c="orange">Контрагента з кодом {d.partnerRef} потрібно звірити з довідником.</Text>
      )}
      {lines.length > 0 && (
        <section className="ledger-card doc-lines">
          <header className="ledger-card-head"><h2><MetricLabel icon={IconBox}>Товари</MetricLabel></h2><TableChip value={lines.length} /></header>
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
                  <Text c="dimmed" size="xs" className="doc-line-catalog">
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
        <details className="ledger-card doc-disclosure">
          <summary><MetricLabel icon={IconFileInvoice}>Документ-підстава</MetricLabel>
            {parents.length !== 1 && <TableChip tone="warning" value="Потребує звірки" />}<IconChevronDown size={16} /></summary>
          {parents.length === 1 ? <DocTable rows={parents} separateNumber /> : <Text className="ledger-note">Код документа-підстави · {d.parentRef}</Text>}
        </details>
      )}
      <details className="ledger-card doc-disclosure">
        <summary><MetricLabel icon={IconLink}>Пов’язані документи й оплати</MetricLabel><TableChip value={related.length} /><IconChevronDown size={16} /></summary>
        {related.length ? (
          <DocTable rows={related} separateNumber />
        ) : (
          <Text className="ledger-note" c="dimmed">Документів із посиланням на цей запис немає.</Text>
        )}
      </details>
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
    <Stack gap="sm" className="ledger-workspace doc-register" data-invoice={direction ?? undefined}>
      <PageHeader title={title} actions={sourceSwitch ?? (direction && can(PermissionKeys.Accounting.Edit) && (
        <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => setEdit(true)}>Створити накладну</Button>
      ))} />
      <section className={section === 'documents' ? 'ledger-card document-register-list' : 'ledger-card'}>
        <header className="ledger-card-head"><h2><MetricLabel icon={returns ? IconArrowBackUp : direction === 'out' ? IconPackageExport : direction === 'in' ? IconPackageImport : IconFiles}>{returns ? 'Повернення від покупців' : direction === 'in' ? 'Надходження від постачальників' : direction ? 'Відвантаження покупцям' : 'Реєстр документів'}</MetricLabel></h2>
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
              placeholder={direction === 'in' ? 'Номер, постачальник, організація' : direction === 'out' ? 'Номер, покупець, організація' : 'Номер, контрагент, організація'}
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
            ? <DocTable rows={query.data.items} direction={direction} separateNumber />
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
  if (section === 'documents' && id) return <Document key={id} id={id} />
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
      ) : (
        <Register key={section} section={section} />
      )}
    </div>
  )
}
