import { memo, type CSSProperties } from 'react'
import { Table } from '@mantine/core'
import { flexRender, type Cell, type Column, type Row, type Table as TableInstance } from '@tanstack/react-table'
import { hasTextSelectionWithin, isInteractiveTarget } from './dataTableRowInteraction'
import type { DataTableColumnMeta } from './types'

const SKELETON_ROW_COUNT = 10
const SKELETON_LINE_WIDTHS = ['78%', '62%', '46%', '70%', '54%', '84%', '58%', '38%'] as const

type DataTableBodyProps<TData> = {
  columnWidths: ReadonlyMap<string, number>
  fillerColumnWidth: number
  fillColumnId?: string
  isLoading: boolean
  selected?: ReadonlySet<string>
  table: TableInstance<TData>
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

type DataTableBodyRowProps<TData> = {
  columnWidths: ReadonlyMap<string, number>
  fillerColumnWidth: number
  fillColumnId?: string
  isSelected: boolean
  row: Row<TData>
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

function cellClassName(meta?: DataTableColumnMeta): string {
  return ['data-table-cell', meta?.numeric ? 'data-table-numeric-cell' : '', meta?.select ? 'data-table-select-cell' : '', meta?.className ?? '']
    .filter(Boolean)
    .join(' ')
}

function cellStyle<TData>(column: Column<TData, unknown>, width: number, fillColumnId?: string): CSSProperties {
  const meta = column.columnDef.meta as DataTableColumnMeta | undefined
  return {
    width,
    minWidth: column.columnDef.minSize,
    maxWidth: column.id === fillColumnId ? undefined : column.columnDef.maxSize,
    textAlign: meta?.align ?? 'left',
  }
}

function DataTableBodyRowInner<TData>({ columnWidths, fillerColumnWidth, fillColumnId, isSelected, row, onRowClick, rowClassName }: DataTableBodyRowProps<TData>) {
  function renderCell(cell: Cell<TData, unknown>) {
    const meta = cell.column.columnDef.meta as DataTableColumnMeta | undefined
    return (
      <Table.Td key={cell.id} className={cellClassName(meta)} style={cellStyle(cell.column, columnWidths.get(cell.column.id) ?? cell.column.getSize(), fillColumnId)}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </Table.Td>
    )
  }

  const className = ['data-table-row', onRowClick ? 'data-table-row-clickable' : '', isSelected ? 'is-selected' : '', rowClassName?.(row.original) ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <Table.Tr
      aria-selected={isSelected || undefined}
      className={className}
      onClick={
        onRowClick
          ? (event) => {
              if (isInteractiveTarget(event.target, event.currentTarget)) return
              if (!hasTextSelectionWithin(event.currentTarget)) onRowClick(row.original)
            }
          : undefined
      }
    >
      {row.getVisibleCells().map(renderCell)}
      {fillerColumnWidth > 0 ? <Table.Td aria-hidden className="data-table-cell data-table-filler-cell" style={{ width: fillerColumnWidth }} /> : null}
    </Table.Tr>
  )
}

const DataTableBodyRow = memo(DataTableBodyRowInner) as typeof DataTableBodyRowInner

export function DataTableBody<TData>({ columnWidths, fillerColumnWidth, fillColumnId, isLoading, selected, table, onRowClick, rowClassName }: DataTableBodyProps<TData>) {
  if (isLoading) {
    const columns = table.getVisibleLeafColumns()
    return (
      <Table.Tbody aria-busy="true" className="data-table-skeleton-body">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, rowIndex) => (
          <Table.Tr key={`loading-${rowIndex}`} className="data-table-row data-table-skeleton-row">
            {columns.map((column, columnIndex) => {
              const meta = column.columnDef.meta as DataTableColumnMeta | undefined
              const align = meta?.align ?? 'left'
              return (
                <Table.Td
                  key={column.id}
                  className={`${cellClassName(meta)} data-table-skeleton-cell data-table-skeleton-cell-align-${align}`}
                  style={cellStyle(column, columnWidths.get(column.id) ?? column.getSize(), fillColumnId)}
                >
                  <span
                    className={`data-table-skeleton-line${meta?.select ? ' data-table-skeleton-line-icon' : columnIndex === 0 ? ' data-table-skeleton-line-primary' : ''}`}
                    style={{ '--data-table-skeleton-width': SKELETON_LINE_WIDTHS[(rowIndex + columnIndex) % SKELETON_LINE_WIDTHS.length] } as CSSProperties}
                  />
                </Table.Td>
              )
            })}
            {fillerColumnWidth > 0 ? <Table.Td aria-hidden className="data-table-cell data-table-filler-cell" style={{ width: fillerColumnWidth }} /> : null}
          </Table.Tr>
        ))}
      </Table.Tbody>
    )
  }

  const rows = table.getRowModel().rows
  if (rows.length === 0) return <Table.Tbody />

  return (
    <Table.Tbody>
      {rows.map((row) => (
        <DataTableBodyRow
          key={row.id}
          columnWidths={columnWidths}
          fillerColumnWidth={fillerColumnWidth}
          fillColumnId={fillColumnId}
          isSelected={Boolean(selected?.has(row.id))}
          row={row}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
        />
      ))}
    </Table.Tbody>
  )
}
