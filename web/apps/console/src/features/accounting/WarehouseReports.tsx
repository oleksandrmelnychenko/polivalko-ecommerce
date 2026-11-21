import { Button, Group, Pagination, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconBuildingWarehouse, IconListCheck } from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { Link, useSearchParams } from 'react-router-dom'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { useRegister } from './api'
import { Grid } from './RegisterTable'
import { count } from './WarehouseShop'

type Schema = components['schemas']

function reportLabel(r: Schema['InventoryReport']) {
  const range = r.firstRow == null ? '' : ` · рядки ${r.firstRow}–${r.firstRow + r.rows - 1}`
  return [r.storeName, r.day].filter(Boolean).join(' · ') + range
}

export function WarehouseReports() {
  const [params, setParams] = useSearchParams()
  const reports = useRegister<Schema['InventoryReport'][]>('inventory-reports')
  const available = reports.data?.filter(r => r.kind === 'cutover' || r.kind === 'balances') ?? []
  const report = params.has('report') ? available.find(r => r.id === params.get('report')) : available[0]
  const query = new URLSearchParams()
  for (const key of ['q', 'amount', 'page']) {
    const value = params.get(key)
    if (value) query.set(key, value)
  }
  const rows = useRegister<Schema['InventoryPage']>(`inventory-reports/${report?.id}?${query}`, !!report)
  const page = Math.max(1, Number(params.get('page')) || 1)
  function change(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    next.set('view', 'reports')
    next.delete('page')
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  return <Stack gap="sm" className="ledger-workspace warehouse-page">
    <PageHeader title="Складські залишки" actions={<Button component={Link} radius="xl" variant="default"
      leftSection={<IconListCheck size={16} />} to={'?view=inventory' + (report ? '&report=' + report.id : '')}>Звірити залишки</Button>} />
    {reports.data ? <>
      <Group align="end" className="ledger-card ledger-filters">
        <Select label="Склад і дата звіту" searchable allowDeselect={false} value={report?.id ?? null}
          data={available.map(r => ({ value: r.id, label: reportLabel(r) }))} onChange={v => change('report', v)} />
        <TextInput label="Пошук у звіті" placeholder="Назва або код товару" maxLength={160}
          value={params.get('q') ?? ''} onChange={e => change('q', e.currentTarget.value)} />
        <Select label="Кількість у звіті" placeholder="Усі" clearable value={params.get('amount')}
          data={[{ value: 'positive', label: 'Більше нуля' }, { value: 'zero', label: 'Нульова' }, { value: 'negative', label: 'Від’ємна' }]}
          onChange={v => change('amount', v)} />
      </Group>
      {report ? <section className="ledger-card warehouse-list">
        <header className="ledger-card-head"><h2><MetricLabel icon={IconBuildingWarehouse}>{report.storeName || 'Склад'} · {report.day}</MetricLabel></h2>
          <span className="ledger-count">Рядків у звіті · {count(report.rows)}</span></header>
        {rows.data ? <>
          {rows.data.items.length ? <Grid columns={['Товар', 'Код товару', 'Одиниця', 'Залишок на дату звіту', 'Резерв у звіті']}>
            {rows.data.items.map(r => <Table.Tr key={r.position}>
              <Table.Td className="wh-name">{r.productId ? <Link to={'/catalog/products/' + r.productId}>{r.title || r.productName || r.code}</Link> : r.title || r.code || '—'}</Table.Td>
              <Table.Td data-label="Код товару">{r.code || '—'}</Table.Td><Table.Td data-label="Одиниця">{r.unit || '—'}</Table.Td>
              <Table.Td data-label="Залишок на дату звіту">{r.quantityText || count(r.quantity)}</Table.Td>
              <Table.Td data-label="Резерв у звіті">{count(r.booked)}</Table.Td>
            </Table.Tr>)}
          </Grid> : <PageState kind="empty" title="У цьому звіті за фільтром немає рядків" />}
          <Text className="ledger-note">За фільтром · {count(rows.data.total)}</Text>
          {rows.data.total > 50 && <Pagination value={page} total={Math.ceil(rows.data.total / 50)} onChange={p => change('page', String(p))} />}
        </> : <PageState kind={rows.status === 'ready' ? 'empty' : rows.status} onRetry={rows.reload} />}
      </section> : <PageState kind="empty" title={available.length ? 'Оберіть складський звіт' : 'Звітів про залишки поки немає'} />}
    </> : <PageState kind={reports.status === 'ready' ? 'empty' : reports.status} onRetry={reports.reload} />}
  </Stack>
}
