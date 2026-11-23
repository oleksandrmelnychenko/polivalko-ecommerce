import { Button, Select, Stack, Table, TextInput } from '@mantine/core'
import { IconBuildingWarehouse, IconFiles, IconListCheck, IconPackage, IconSearch } from '@tabler/icons-react'
import type { components } from '@polivalko/shared/api/schema'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar } from '@/shared/ui/FilterBar'
import { MetricLabel } from '@/shared/ui/MetricCard'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { useRegister } from './api'
import { Grid } from './RegisterTable'
import { count } from './WarehouseShop'

type Schema = components['schemas']

function reportDetails(report: Schema['InventoryReport']) {
  const day = report.day?.split('-').reverse().join('.')
  const kind = report.kind === 'cutover' ? 'Залишок на дату переходу' : 'Залишок і резерв'
  const range = report.firstRow != null && report.rows > 0
    ? `рядки ${count(report.firstRow)}–${count(report.firstRow + report.rows - 1)}`
    : null
  return [day, kind, range].filter(Boolean).join(' · ')
}

export function WarehouseReports() {
  const [params, setParams] = useSearchParams()
  const reports = useRegister<Schema['InventoryReport'][]>('inventory-reports')
  const available = reports.data?.filter(r => r.kind === 'cutover' || r.kind === 'balances') ?? []
  const report = params.has('report') ? available.find(r => r.id === params.get('report')) : available[0]
  const options = available.map(r => {
    const store = r.storeName || 'Склад не вказано'
    const details = reportDetails(r)
    return { value: r.id, label: store + ' · ' + details, store, details }
  })
  const optionsById = new Map(options.map(option => [option.value, option]))
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

  return (
    <Stack gap="sm" className="ledger-workspace doc-register warehouse-page wh-reports">
      <PageHeader title="Складські залишки" actions={
        <Button component={Link} radius="xl" variant="default" leftSection={<IconListCheck size={16} />}
          to={'?view=inventory' + (report ? '&report=' + encodeURIComponent(report.id) : '')}>Звірити залишки</Button>
      } />
      {!reports.data ? <PageState kind={reports.status === 'ready' ? 'empty' : reports.status} onRetry={reports.reload} />
        : available.length === 0 ? <PageState kind="empty" title="Звітів про залишки поки немає" /> : <>
          <section className="ledger-card wh-report-picker">
            <MetricLabel icon={IconFiles}>Склад і дата звіту</MetricLabel>
            <Select aria-label="Склад і дата звіту" placeholder="Оберіть звіт" searchable allowDeselect={false}
              nothingFoundMessage="Звітів за цим запитом немає" value={report?.id ?? null}
              data={options}
              renderOption={({ option }) => {
                const item = optionsById.get(option.value)
                return item ? <span className="wh-report-option"><strong>{item.store}</strong><span>{item.details}</span></span> : option.label
              }}
              onChange={v => change('report', v)} />
          </section>
          {report ? (
            <section className="ledger-card warehouse-list wh-report-products">
              <header className="ledger-card-head">
                <h2><MetricLabel icon={IconBuildingWarehouse}>Товари у звіті</MetricLabel></h2>
                <span className="ledger-count">Рядків у звіті · {count(report.rows)}</span>
              </header>
              <FilterBar label="Фільтри товарів у звіті" activeCount={Number(params.has('amount'))}
                search={<TextInput className="app-filter-wide" aria-label="Пошук у звіті" placeholder="Назва або код товару"
                  leftSection={<IconSearch size={16} />} maxLength={160} value={params.get('q') ?? ''}
                  onChange={e => change('q', e.currentTarget.value)} />}
                actions={<>
                  {rows.data && <span className="ledger-count">Знайдено · {count(rows.data.total)}</span>}
                  <Paginator page={page} pageSize={50} totalPages={rows.data ? Math.ceil(rows.data.total / 50) : undefined}
                    isLoading={rows.isFetching} onPageChange={p => change('page', String(p))} onRefresh={rows.reload} />
                </>}>
                <Select label="Кількість у звіті" placeholder="Усі залишки" clearable value={params.get('amount')}
                  data={[{ value: 'positive', label: 'Більше нуля' }, { value: 'zero', label: 'Нульова' }, { value: 'negative', label: 'Від’ємна' }]}
                  onChange={v => change('amount', v)} />
              </FilterBar>
              {!rows.data ? <PageState kind={rows.status === 'ready' ? 'empty' : rows.status} onRetry={rows.reload} />
                : rows.data.items.length === 0 ? <PageState kind="empty" title="За цими умовами товарів немає" /> : (
                  <Grid columns={['Товар', 'Код товару', 'Одиниця', 'Залишок на дату звіту', 'Резерв у звіті']}>
                    {rows.data.items.map(r => {
                      // The catalog name once the line is linked to a product; the report's own DNTrade text stays as a tooltip.
                      const name = r.productName || r.title || r.code || '—'
                      const source = r.productName && r.title && r.title !== r.productName ? r.title : undefined
                      return (
                        <Table.Tr key={r.position}>
                          <Table.Td className="wh-name"><div className="wh-report-name"><IconPackage size={16} aria-hidden="true" />
                            {r.productId ? <Link to={'/catalog/products/' + r.productId} title={source}>{name}</Link> : <span>{name}</span>}
                          </div></Table.Td>
                          <Table.Td className="ledger-number" data-label="Код товару">{r.code || '—'}</Table.Td>
                          <Table.Td data-label="Одиниця">{r.unit || '—'}</Table.Td>
                          <Table.Td data-label="Залишок на дату звіту" className="wh-quantity" data-negative={(r.quantity ?? 0) < 0 || undefined}>
                            {r.quantityText || count(r.quantity)}
                          </Table.Td>
                          <Table.Td className="wh-quantity" data-label="Резерв у звіті">{count(r.booked)}</Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Grid>
                )}
            </section>
          ) : <PageState kind="empty" title="Оберіть складський звіт" />}
        </>}
    </Stack>
  )
}
