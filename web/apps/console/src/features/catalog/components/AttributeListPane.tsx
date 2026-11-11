import { useCallback, type ReactNode } from 'react'
import { plural } from '@polivalko/shared/lib/format'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import type { AttributeDefinition } from '../api/dictionariesApi'
import { AttributeKindIcon } from './AttributeKindIcon'

const countFormat = new Intl.NumberFormat('uk-UA')
const getRowId = (row: AttributeDefinition) => row.id

const COLUMNS: DataTableColumn<AttributeDefinition>[] = [
  {
    id: 'name',
    header: 'Характеристика',
    width: 260,
    minWidth: 180,
    fill: true,
    accessor: (row) => row.name,
    cell: (row) => (
      <span className="catalog-split-name-cell">
        <AttributeKindIcon kind={row.kind} size={15} />
        <span className="catalog-split-item-name">{row.name}</span>
      </span>
    ),
  },
  {
    id: 'categories',
    header: 'Фільтр на сайті',
    width: 190,
    sortDescFirst: true,
    accessor: (row) => row.categoryCount,
    cell: (row) =>
      row.categoryCount ? (
        <span className="catalog-split-item-meta">
          у {row.categoryCount} {plural(row.categoryCount, 'категорії', 'категоріях', 'категоріях')}
        </span>
      ) : (
        <span className="catalog-split-item-meta is-off">не фільтр</span>
      ),
  },
  {
    id: 'products',
    header: 'Товарів',
    width: 110,
    align: 'right',
    numeric: true,
    sortDescFirst: true,
    accessor: (row) => row.productCount,
    cell: (row) => <span className="catalog-split-item-count">{countFormat.format(row.productCount)}</span>,
  },
]

type AttributeListPaneProps = {
  rows: AttributeDefinition[]
  selectedId: string | null
  isLoading: boolean
  isFetching: boolean
  emptyText: ReactNode
  onSelect: (id: string) => void
}

export function AttributeListPane({ rows, selectedId, isLoading, isFetching, emptyText, onSelect }: AttributeListPaneProps) {
  const rowClassName = useCallback((row: AttributeDefinition) => (row.id === selectedId ? 'catalog-split-row-active' : undefined), [selectedId])
  const select = useCallback((row: AttributeDefinition) => onSelect(row.id), [onSelect])

  return (
    <div className="catalog-split-list">
      <DataTable
        ariaLabel="Характеристики"
        columns={COLUMNS}
        data={rows}
        getRowId={getRowId}
        isLoading={isLoading}
        isFetching={isFetching}
        minWidth={460}
        height="100%"
        emptyText={emptyText}
        onRowClick={select}
        rowClassName={rowClassName}
      />
    </div>
  )
}
