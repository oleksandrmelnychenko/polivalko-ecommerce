import { Button, Group, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconArrowLeft, IconBox, IconFileInvoice, IconFiles, IconLink, IconPlus } from '@tabler/icons-react'
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

function DocTable({ rows }: { rows: Doc[] }) {
  return (
    <Grid columns={['Документ', 'Дата', 'Контрагент', 'Організація', 'Стан документа', 'Сума', 'Оплата']}>
      {rows.map((d) => (
        <Table.Tr key={d.id}>
          <Table.Td>
            <Link to={'/accounting/documents/' + d.id}>
              {kindName(d)} № {d.number || d.sourceId}
            </Link>
          </Table.Td>
          <Table.Td className="ledger-number">{d.day ?? '—'}</Table.Td>
          <Table.Td>
            {d.partnerId ? (
              <Link to={'/accounting/partners/' + d.partnerId}>{d.partnerTitle || 'Контрагент'}</Link>
            ) : (
              d.partnerTitle || '—'
            )}
          </Table.Td>
          <Table.Td>{d.organization || '—'}</Table.Td>
          <Table.Td>{statusNames[d.status ?? ''] ?? d.status ?? '—'}</Table.Td>
          <Table.Td className="register-money">{money(d.amount, d.currency)}</Table.Td>
          <Table.Td>{d.paymentStatus ? paymentNames[d.paymentStatus] : '—'}</Table.Td>
        </Table.Tr>
      ))}
    </Grid>
  )
}

function Document({ id }: { id: string }) {
  const { state } = useLocation()
  const result = useRegister<Card>('documents/' + id)
  if (!result.data)
    return <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />
  const { document: d, lines, parents, related } = result.data
  return (
    <Stack gap="sm" className="ledger-workspace ledger-document">
      <PageHeader title={kindName(d) + ' № ' + (d.number ?? d.sourceId)} />
      {typeof state?.partnerId === 'string' && (
        <Button component={Link} variant="default" radius="xl" className="partner-return" leftSection={<IconArrowLeft size={16} />}
          to={{ pathname: '/accounting/partners/' + encodeURIComponent(state.partnerId), search: state.documentSearch }}
          state={state.partnerState}>До картки контрагента</Button>
      )}
      <section className="ledger-card">
        <header className="ledger-card-head"><h2><MetricLabel icon={IconFileInvoice}>{kindName(d)} № {d.number ?? d.sourceId}</MetricLabel></h2></header>
        <DocTable rows={[d]} />
        <Text className="ledger-note" size="sm">Договір · {d.agreement || '—'} · Код документа · {d.sourceId}</Text>
      </section>
      {d.sourceAccount === 'polivalko-native' && d.entityType === 'invoice' && (
        <InvoiceActions key={d.id} doc={d} lines={lines} refresh={result.reload} />
      )}
      {d.partnerRef && !d.partnerId && (
        <Text c="orange">Контрагента з кодом {d.partnerRef} потрібно звірити з довідником.</Text>
      )}
      {lines.length > 0 && (
        <section className="ledger-card">
          <header className="ledger-card-head"><h2><MetricLabel icon={IconBox}>Товари</MetricLabel></h2><span className="ledger-count">{lines.length}</span></header>
          <Grid columns={['№', 'Товар', 'Артикул', 'Склад', 'Кількість', 'Ціна', 'Сума']}>
            {lines.map((l) => (
              <Table.Tr key={l.position}>
                <Table.Td className="ledger-number">{l.position}</Table.Td>
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
                <Table.Td className="ledger-number">{l.sku || '—'}</Table.Td>
                <Table.Td>{l.store || '—'}</Table.Td>
                <Table.Td className="ledger-number">{l.quantity ?? '—'}</Table.Td>
                <Table.Td className="ledger-number">{money(l.price)}</Table.Td>
                <Table.Td className="ledger-number">{money(l.total, d.currency)}</Table.Td>
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

function Register({ section }: { section: string }) {
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState(false)
  const { can } = usePermissions()
  const direction = section === 'incoming' ? 'in' : 'out'
  const title = direction === 'in' ? 'Прибуткові накладні' : 'Видаткові накладні'
  const filter = new URLSearchParams(params)
  filter.set('register', direction)
  const query = useRegister<Page<Doc>>('documents?' + filter)
  const page = Math.max(1, Number(params.get('page')) || 1)
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack gap="sm" className="ledger-workspace">
      <PageHeader title={title} actions={can(PermissionKeys.Accounting.Edit) && (
        <Button radius="xl" leftSection={<IconPlus size={16} />} onClick={() => setEdit(true)}>Створити накладну</Button>
      )} />
      <Group className="ledger-card ledger-filters" align="end">
        <TextInput
          label="Пошук"
          placeholder="Номер, контрагент, організація"
          value={params.get('q') ?? ''}
          onChange={(e) => change('q', e.currentTarget.value)}
        />
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
      </Group>
      <section className="ledger-card">
        <header className="ledger-card-head"><h2><MetricLabel icon={IconFiles}>Журнал накладних</MetricLabel></h2>
          {query.data && <span className="ledger-count">Записів · {query.data.total.toLocaleString('uk-UA')}</span>}
        </header>
        {query.data ? (
          <>
            {!query.data.total ? (
              <PageState kind="empty" title="Записів за цими умовами немає" />
            ) : (
              <DocTable rows={query.data.items} />
            )}
            {query.data.total > 50 && (
              <Pagination
                total={Math.ceil(query.data.total / 50)}
                value={page}
                onChange={(p) => change('page', String(p))}
              />
            )}
          </>
        ) : (
          <PageState kind={query.status === 'ready' ? 'empty' : query.status} onRetry={query.reload} />
        )}
      </section>
      {edit && (
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
