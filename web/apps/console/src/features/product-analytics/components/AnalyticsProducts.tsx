import { Button, CloseButton, TextInput } from '@mantine/core'
import { IconArrowUpRight, IconSearch } from '@tabler/icons-react'
import type { FormEvent } from 'react'
import { Paginator } from '@/shared/ui/paginator/Paginator'
import { TableChip } from '@/shared/ui/TableChip'
import type { ProductAnalytics } from '../api/productAnalyticsApi'
import { dateLabel, formatAmount, formatChange, formatDays, formatPrice, formatUnits } from '../lib/format'
import { AnalyticsCard } from './AnalyticsCard'

type Props = {
  products: ProductAnalytics['products']
  search: string
  draft: string
  productKey: string | undefined
  returnsAvailable: boolean
  isFetching: boolean
  onDraftChange: (value: string) => void
  onSearch: (value: string) => void
  onPageChange: (page: number) => void
  onSelect: (key: string) => void
}

export function AnalyticsProducts({ products, search, draft, productKey, returnsAvailable, isFetching, onDraftChange, onSearch, onPageChange, onSelect }: Props) {
  return (
    <AnalyticsCard
      id="analytics-products"
      title="Товари за виручкою"
      description={`Товарів у списку: ${formatAmount(products.total)}. Виберіть товар, щоб відкрити його звіт.`}
      actions={<ProductSearch value={draft} onChange={onDraftChange} onSearch={onSearch} />}
    >
      {products.items.length > 0 ? (
        <div className="pa-table-scroll" tabIndex={0} role="region" aria-label="Товари за виручкою">
          <table className="pa-table pa-products-table">
            <thead>
              <tr>
                <th scope="col">Товар</th>
                <th scope="col">Продано</th>
                <th scope="col">{returnsAvailable ? 'Чиста виручка' : 'Виручка'}</th>
                <th scope="col" title="Зміна кількості продажів проти попереднього періоду">Зміна попиту</th>
                <th scope="col" title="ABC-клас за часткою у виручці">ABC</th>
                <th scope="col">Залишок сайту зараз</th>
                <th scope="col">Запас на</th>
                <th scope="col">Останній продаж</th>
              </tr>
            </thead>
            <tbody>
              {products.items.map((row) => (
                <tr key={row.productKey} data-selected={row.productKey === productKey || undefined}>
                  <th scope="row">
                    <button type="button" className="pa-product-link" onClick={() => onSelect(row.productKey)} aria-current={row.productKey === productKey || undefined}>
                      <span><strong>{row.name}</strong><small>{row.sku || 'Без артикула'}</small></span>
                      <IconArrowUpRight size={15} stroke={1.8} aria-hidden="true" />
                    </button>
                  </th>
                  <td>{formatUnits(row.soldUnits)}</td>
                  <td>{formatPrice(row.netRevenue)}</td>
                  <td><DemandChange current={row.soldUnits} previous={row.previousSoldUnits} /></td>
                  <td>{row.abcClass ? <TableChip value={row.abcClass} tone={row.abcClass === 'A' ? 'success' : 'neutral'} /> : '—'}</td>
                  <td>{row.stock == null ? '—' : formatUnits(row.stock)}</td>
                  <td>{row.stockDays == null ? '—' : formatDays(row.stockDays)}</td>
                  <td>{row.lastSaleDay ? dateLabel(row.lastSaleDay) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pa-empty">{search ? 'За цим пошуком товарів немає.' : 'За цей період товарів із продажами немає.'}</p>
      )}
      {products.total > products.pageSize ? (
        <div className="pa-table-footer">
          <Paginator
            page={products.page}
            pageSize={products.pageSize}
            totalPages={Math.ceil(products.total / products.pageSize)}
            isLoading={isFetching}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </AnalyticsCard>
  )
}

function ProductSearch({ value, onChange, onSearch }: { value: string; onChange: (value: string) => void; onSearch: (value: string) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(value.trim())
  }

  function clear() {
    onChange('')
    onSearch('')
  }

  return (
    <form className="pa-search" onSubmit={submit} role="search" aria-label="Пошук товарів">
      <TextInput
        aria-label="Назва або артикул"
        placeholder="Назва або артикул…"
        leftSection={<IconSearch size={16} stroke={1.7} />}
        rightSection={value ? <CloseButton aria-label="Очистити пошук" onClick={clear} /> : null}
        rightSectionPointerEvents={value ? 'all' : 'none'}
        maxLength={120}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <Button type="submit" variant="default">Знайти</Button>
    </form>
  )
}

export function DemandChange({ current, previous }: { current: number; previous?: number | null }) {
  if (previous == null || previous <= 0) return <span className="pa-muted">—</span>
  const change = (current - previous) / previous
  const tone = change === 0 ? 'flat' : change > 0 ? 'up' : 'down'
  return <span className="pa-change" data-change={tone}>{formatChange(change)}</span>
}
