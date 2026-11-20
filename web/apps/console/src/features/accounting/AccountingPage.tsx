import { Button, Group, Pagination, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
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
import { PartnerOpeningList } from './PartnerOpenings'
import {
  kindName,
  money,
  paymentNames,
  statusNames,
  useRegister,
  type Card,
  type Doc,
  type Page,
  type Partner,
  type PartnerCard,
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
          <Table.Td>{d.day ?? '—'}</Table.Td>
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
  const result = useRegister<Card>('documents/' + id)
  if (!result.data)
    return <PageState kind={result.status === 'ready' ? 'empty' : result.status} onRetry={result.reload} />
  const { document: d, lines, parents, related } = result.data
  return (
    <Stack>
      <PageHeader title={kindName(d) + ' № ' + (d.number ?? d.sourceId)} />
      <Title order={2}>
        {kindName(d)} № {d.number ?? d.sourceId}
      </Title>
      <DocTable rows={[d]} />
      {d.sourceAccount === 'polivalko-native' && d.entityType === 'invoice' && (
        <InvoiceActions key={d.id} doc={d} lines={lines} refresh={result.reload} />
      )}
      <Text size="sm">
        Договір · {d.agreement || '—'} · Код документа · {d.sourceId}
      </Text>
      {d.partnerRef && !d.partnerId && (
        <Text c="orange">Контрагента з кодом {d.partnerRef} потрібно звірити з довідником.</Text>
      )}
      {lines.length > 0 && (
        <>
          <Title order={3}>Товари · {lines.length}</Title>
          <Grid columns={['№', 'Товар', 'Артикул', 'Склад', 'Кількість', 'Ціна', 'Сума']}>
            {lines.map((l) => (
              <Table.Tr key={l.position}>
                <Table.Td>{l.position}</Table.Td>
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
                <Table.Td>{l.sku || '—'}</Table.Td>
                <Table.Td>{l.store || '—'}</Table.Td>
                <Table.Td>{l.quantity ?? '—'}</Table.Td>
                <Table.Td>{money(l.price)}</Table.Td>
                <Table.Td>{money(l.total, d.currency)}</Table.Td>
              </Table.Tr>
            ))}
          </Grid>
        </>
      )}
      {d.parentRef && (
        <>
          <Title order={3}>Документ-підстава</Title>
          {parents.length === 1 ? <DocTable rows={parents} /> : <Text>Потребує звірки · {d.parentRef}</Text>}
        </>
      )}
      <Title order={3}>Пов’язані документи й оплати</Title>
      {related.length ? (
        <DocTable rows={related} />
      ) : (
        <Text c="dimmed">Документів із посиланням на цей запис немає.</Text>
      )}
    </Stack>
  )
}

function Register({ section, partnerId }: { section: string; partnerId?: string }) {
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState(false)
  const { can } = usePermissions()
  const partners = section === 'partners' && !partnerId
  const direction = section === 'incoming' ? 'in' : section === 'outgoing' ? 'out' : undefined
  const title = partners
    ? 'Контрагенти'
    : partnerId
      ? 'Документи контрагента'
      : direction === 'in'
        ? 'Прибуткові накладні'
        : 'Видаткові накладні'
  const filter = new URLSearchParams(params)
  if (direction) filter.set('register', direction)
  if (partnerId) filter.set('partnerId', partnerId)
  const people = useRegister<Page<Partner>>('partners?' + filter, partners)
  const docs = useRegister<Page<Doc>>('documents?' + filter, !partners)
  const query = partners ? people : docs
  const detail = useRegister<PartnerCard>('partners/' + partnerId, Boolean(partnerId))
  const positions = useRegister<{ organization: string; currency: string; receivable: string; payable: string }[]>(
    'partners/' + partnerId + '/positions',
    Boolean(partnerId),
  )
  const page = Math.max(1, Number(params.get('page')) || 1)
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return (
    <Stack>
      <PageHeader title={title} />
      <Group justify="space-between">
        <Title order={2}>{detail.data?.partner.title ?? title}</Title>
        {!partnerId && can(PermissionKeys.Accounting.Edit) && (
          <Button onClick={() => setEdit(true)}>{partners ? 'Додати контрагента' : 'Створити накладну'}</Button>
        )}
      </Group>
      {partnerId && detail.data && (
        <>
          <Text size="sm">
            Код · {detail.data.partner.sourceId} · {detail.data.partner.category || 'Без категорії'}
          </Text>
          {detail.data.agreements.length > 0 && (
            <Grid columns={['Договір', 'Валюта', 'Код договору']}>
              {detail.data.agreements.map((a, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{a.title || '—'}</Table.Td>
                  <Table.Td>{a.currency || '—'}</Table.Td>
                  <Table.Td>{a.id || '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Grid>
          )}
          <Title order={3}>Взаєморозрахунки контрагента</Title>
          <Text size="sm" c="dimmed">
            Залишки за підтвердженими початковими боргами й проведеними накладними після оплат.
          </Text>
          {(positions.status === 'error' || positions.status === 'forbidden') && (
            <PageState kind={positions.status} onRetry={positions.reload} />
          )}
          {positions.data && positions.data.length > 0 && (
            <Grid columns={['Організація', 'До отримання', 'До сплати']}>
              {positions.data.map((p, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{p.organization}</Table.Td>
                  <Table.Td>{money(p.receivable, p.currency)}</Table.Td>
                  <Table.Td>{money(p.payable, p.currency)}</Table.Td>
                </Table.Tr>
              ))}
            </Grid>
          )}
          <PartnerOpeningList partnerId={partnerId} refresh={positions.reload} />
          <Link to={'/accounting/balances?q=' + encodeURIComponent(detail.data.partner.title)}>
            Знайти вихідні рядки для звірки
          </Link>
          <Title order={3}>Документи контрагента</Title>
        </>
      )}
      <Group align="end">
        <TextInput
          label="Пошук"
          placeholder={partners ? 'Назва або код' : 'Номер, контрагент, організація'}
          value={params.get('q') ?? ''}
          onChange={(e) => change('q', e.currentTarget.value)}
        />
        {!partners && (
          <>
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
          </>
        )}
      </Group>
      {query.data ? (
        <>
          <Text size="sm" c="dimmed">
            Записів · {query.data.total}
          </Text>
          {!query.data.total ? (
            <PageState kind="empty" title="Записів за цими умовами немає" />
          ) : partners ? (
            <Grid columns={['Контрагент', 'Вид', 'Категорія', 'Код', 'Взаєморозрахунки']}>
              {people.data?.items.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Link to={'/accounting/partners/' + p.id}>{p.title}</Link>
                  </Table.Td>
                  <Table.Td>
                    {p.kind === 'juridical'
                      ? 'Юридична особа'
                      : p.kind === 'individual'
                        ? 'Фізична особа'
                        : p.kind || '—'}
                  </Table.Td>
                  <Table.Td>{p.category || '—'}</Table.Td>
                  <Table.Td>{p.sourceId}</Table.Td>
                  <Table.Td>
                    <Link to={'/accounting/balances?q=' + encodeURIComponent(p.title)}>Знайти за назвою</Link>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Grid>
          ) : (
            <DocTable rows={docs.data?.items ?? []} />
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
      {edit && (
        <EditRegister
          kind={partners ? 'partner' : direction!}
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
        <Register key={section + id} section={section} partnerId={id} />
      )}
    </div>
  )
}
