import { DocTable, DocumentStatus, PartnerLink, documentIcon } from './DocumentTable'
import { TableChip } from '@/shared/ui/TableChip'
import { AppEditorModal } from '@/shared/ui/AppEditorModal'
import { Button, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconArrowBackUp, IconBox, IconChevronDown, IconFileInvoice, IconFilePencil, IconFiles, IconLink, IconPackageExport, IconPackageImport, IconPlus, IconSearch } from '@tabler/icons-react'
import { FilterBar } from '@/shared/ui/FilterBar'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useContext, useState } from 'react'
import { usePermissions } from '@/features/auth'
import { PermissionKeys } from '@/shared/auth/permissionKeys'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { EditRegister } from './EditRegister'
import { Balances } from './Balances'
import { ProductHistory } from './ProductHistory'
import { Grid } from './RegisterTable'
import { InventoryPage, Workplace, WarehouseBalances } from './Workplace'
import { DOCUMENTS_PATH, OverlayRouteContext } from '@/shared/ui/DocumentLink'
import { InvoiceActions } from './InvoiceActions'
import { StockOperationActions, StockOperationRegister } from './StockOperations'
import { PartnersDirectory } from './Partners'
import {
  ACCOUNTING_DOCUMENT_CHANGED,
  kindName,
  money,
  paymentNames,
  quantityText,
  statusNames,
  useRegister,
  type Card,
  type Doc,
  type Page,
} from './api'
import './registers.css'

function Document({ id, overlayState }: { id: string; overlayState?: unknown }) {
  const location = useLocation()
  const navState = (overlayState ?? location.state) as { documentBackground?: unknown } | null
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
        if (navState?.documentBackground) navigate(-1)
        else navigate(DOCUMENTS_PATH, { replace: true })
      }}
      title={<MetricLabel icon={card ? documentIcon(card.document) : IconFileInvoice}>{title}</MetricLabel>}>
      {card ? <DocumentDetails card={card} onDialogChange={setOperationOpen} onDeleted={() => {
        window.dispatchEvent(new Event(ACCOUNTING_DOCUMENT_CHANGED))
        setOpened(false)
      }} reload={() => {
        result.reload()
        window.dispatchEvent(new Event(ACCOUNTING_DOCUMENT_CHANGED))
      }} /> :
        <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />}
    </AppEditorModal>
  )
}

function DocumentDetails({ card, reload, onDeleted, onDialogChange }: { card: Card; reload: () => void; onDeleted: () => void; onDialogChange: (opened: boolean) => void }) {
  const { document: d, lines, parents, related } = card
  const partnerLabel = d.entityType === 'invoice' && d.kind === 'in' ? 'Постачальник'
    : (d.entityType === 'invoice' && d.kind === 'out') || d.entityType === 'customerReturn' ? 'Покупець' : 'Контрагент'
  const isNativeInvoice = d.sourceAccount === 'polivalko-native' && (d.entityType === 'invoice' || d.entityType === 'customerReturn')
  return (
    <Stack gap="sm" className="ledger-workspace ledger-document">
      <section className="ledger-card doc-summary">
        <div className="doc-heading">
          <div className="doc-amount"><span>Сума документа</span><div className="doc-value"><strong>{money(d.amount, d.currency)}</strong><DocumentStatus doc={d} /></div></div>
          <time dateTime={d.day ?? undefined}>{d.day ?? '—'}</time>
        </div>
        <dl className="doc-facts">
          {d.entityType !== 'stockOperation' && <div><dt>{partnerLabel}</dt><dd><PartnerLink doc={d} chip /></dd></div>}
          <div><dt>Організація</dt><dd>{d.organization || '—'}</dd></div>
          {d.entityType !== 'stockOperation' && <>
            <div><dt>Договір</dt><dd>{d.agreement || '—'}</dd></div>
            <div><dt>Оплата</dt><dd>{paymentNames[d.paymentStatus ?? ''] ?? d.paymentStatus ?? '—'}</dd></div>
          </>}
          <div><dt>Код документа</dt><dd className="doc-code">{d.sourceId}</dd></div>
        </dl>
      </section>
      {isNativeInvoice && (
        <InvoiceActions key={d.id} doc={d} lines={lines} refresh={reload} onDeleted={onDeleted} onDialogChange={onDialogChange} />
      )}
      {d.sourceAccount === 'polivalko-native' && d.entityType === 'stockOperation' && (
        <StockOperationActions key={d.id} doc={d} refresh={reload} onDeleted={onDeleted} onDialogChange={onDialogChange} />
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
                        '/warehouse/product-history?' +
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
                <Table.Td data-label="Кількість" className="ledger-number">{quantityText(l.quantity)}</Table.Td>
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
  const editableKind = returns ? 'customerReturn' : direction
  const title = returns ? 'Повернення' : direction === 'in' ? 'Прибуткові накладні' : direction === 'out' ? 'Видаткові накладні' : 'Документи'
  const filter = new URLSearchParams(params)
  filter.delete('source')
  if (returns) filter.set('register', 'customerReturn')
  else if (direction) filter.set('register', direction)
  else filter.delete('register')
  const query = useRegister<Page<Doc>>('documents?' + filter)
  // Drafts waiting to be posted are part of the invoice journal, not a separate workplace queue.
  const drafts = useRegister<Page<Doc>>('documents?' + new URLSearchParams({ register: editableKind ?? 'in', status: 'draft' }), !!editableKind)
  const draftsOnly = params.get('status') === 'draft'
  const page = Math.max(1, Number(params.get('page')) || 1)
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (returns) next.set('source', 'accounting')
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const createLabel = returns ? 'Оформити повернення' : direction === 'in' ? 'Прийняти товар' : 'Оформити продаж'
  return (
    <Stack gap="sm" className="ledger-workspace doc-register" data-invoice={direction ?? undefined}>
      <PageHeader title={title} actions={(sourceSwitch || editableKind) ? (
        <Group gap="xs" wrap="wrap">
          {sourceSwitch}
          {editableKind && (draftsOnly || !!drafts.data?.total) && (
            <Button radius="xl" variant={draftsOnly ? 'filled' : 'default'} leftSection={<IconFilePencil size={16} />}
              aria-pressed={draftsOnly} onClick={() => change('status', draftsOnly ? '' : 'draft')}>
              Чернетки · {drafts.data?.total.toLocaleString('uk-UA') ?? '—'}
            </Button>
          )}
          {editableKind && can(PermissionKeys.Accounting.Edit) && (
            <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => setEdit(true)}>
              {createLabel}
            </Button>
          )}
        </Group>
      ) : undefined} />
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
      {edit && editableKind && (
        <EditRegister
          kind={editableKind}
          onClose={() => setEdit(false)}
          onSaved={() => {
            setEdit(false)
            query.reload()
            drafts.reload()
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
  const overlay = useContext(OverlayRouteContext)
  const pathname = useLocation().pathname
  const { id: paramId } = useParams()
  if (overlay?.section === 'documents') return <Document key={overlay.id} id={overlay.id} overlayState={overlay.state} />
  if (overlay?.section === 'partners') return <PartnersDirectory id={overlay.id} overlayState={overlay.state} />
  const section = pathname.split('/')[2]
  if (section === 'documents' && paramId) return <Document key={paramId} id={paramId} />
  if (section === 'partners') return <PartnersDirectory id={paramId} />
  if (section === 'payments' || section === 'stock' || section === 'inventory')
    return <div className="accounting-register">{section === 'payments' ? <Workplace /> : section === 'stock' ? <WarehouseBalances /> : <InventoryPage />}</div>
  if (section === 'income' || section === 'write-offs' || section === 'transfers') {
    const kind = section === 'income' ? 'income' : section === 'write-offs' ? 'writeOff' : 'transfer'
    return <div className="accounting-register"><StockOperationRegister key={section} kind={kind} /></div>
  }
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
