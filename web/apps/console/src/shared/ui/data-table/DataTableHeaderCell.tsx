import { memo } from 'react'
import { Table, UnstyledButton } from '@mantine/core'
import { IconArrowsSort, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { flexRender, type Header } from '@tanstack/react-table'
import type { DataTableColumnMeta, DataTableLabels } from './types'

type DataTableHeaderCellProps<TData> = {
  columnWidth: number
  header: Header<TData, unknown>
  isFillColumn: boolean
  labels: DataTableLabels
  sorted: false | 'asc' | 'desc'
}

function DataTableHeaderCellInner<TData>({ columnWidth, header, isFillColumn, labels, sorted }: DataTableHeaderCellProps<TData>) {
  const meta = header.column.columnDef.meta as DataTableColumnMeta | undefined
  const align = meta?.align ?? 'left'
  const canSort = header.column.getCanSort()
  const nextSortLabel = sorted === 'asc' ? labels.sortDescending : labels.sortAscending
  const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined
  const content = flexRender(header.column.columnDef.header, header.getContext())

  return (
    <Table.Th
      aria-sort={ariaSort}
      className={['data-table-th', meta?.select ? 'data-table-select-th' : '', meta?.className ?? ''].filter(Boolean).join(' ')}
      data-align={align}
      scope="col"
      style={{
        width: columnWidth,
        minWidth: header.column.columnDef.minSize,
        maxWidth: isFillColumn ? undefined : header.column.columnDef.maxSize,
        textAlign: align,
      }}
    >
      {canSort ? (
        <UnstyledButton className="data-table-header-button" data-sortable="true" title={nextSortLabel} onClick={header.column.getToggleSortingHandler()}>
          <span className="data-table-header-label">{content}</span>
          <span className="data-table-sort-icon" data-sorted={sorted ? 'true' : 'false'} aria-hidden="true">
            {sorted === 'asc' ? <IconChevronUp size={14} stroke={2} /> : sorted === 'desc' ? <IconChevronDown size={14} stroke={2} /> : <IconArrowsSort size={13} stroke={1.8} />}
          </span>
        </UnstyledButton>
      ) : (
        <div className="data-table-header-static">{content}</div>
      )}
    </Table.Th>
  )
}

export const DataTableHeaderCell = memo(DataTableHeaderCellInner) as typeof DataTableHeaderCellInner
