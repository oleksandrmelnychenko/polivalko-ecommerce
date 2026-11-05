import { useMemo, useState, type CSSProperties } from 'react'
import { Checkbox, Table } from '@mantine/core'
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type OnChangeFn, type SortingState } from '@tanstack/react-table'
import { DataTableBody } from './DataTableBody'
import { DataTableHeaderCell } from './DataTableHeaderCell'
import { createRenderedColumnWidths, getFillColumnId } from './dataTableSizing'
import { useElementClientWidth } from './useElementClientWidth'
import type { DataTableColumn, DataTableColumnMeta, DataTableLabels, DataTableProps, DataTableSelection } from './types'
import './data-table.css'

const SELECT_COLUMN_ID = '__select'
const SELECT_COLUMN_WIDTH = 44

const DEFAULT_LABELS: DataTableLabels = {
  noData: 'Даних не знайдено',
  loadingData: 'Завантаження даних',
  emptyValue: '—',
  yes: 'Так',
  no: 'Ні',
  sortAscending: 'Сортувати за зростанням',
  sortDescending: 'Сортувати за спаданням',
  selectAll: 'Вибрати всі рядки на сторінці',
  selectRow: 'Вибрати рядок',
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  isLoading = false,
  isFetching = false,
  minWidth = 720,
  fillAvailableWidth = true,
  height,
  maxHeight,
  density = 'normal',
  emptyText,
  labels: labelsOverride,
  manualSorting = false,
  sorting: controlledSorting,
  onSortingChange,
  onRowClick,
  rowClassName,
  selection,
  footer,
  ariaLabel,
}: DataTableProps<TData>) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelsOverride }), [labelsOverride])
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const sorting = controlledSorting ?? internalSorting
  const [scrollNode, setScrollNode] = useState<HTMLDivElement | null>(null)
  const viewportWidth = useElementClientWidth(scrollNode)
  const pageRowIds = useMemo(() => data.map((row, index) => getRowId(row, index)), [data, getRowId])

  const tableColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    const regular = columns.map((column): ColumnDef<TData, unknown> => toColumnDef(column, labels))
    return selection ? [createSelectColumn<TData>(selection, pageRowIds, labels), ...regular] : regular
  }, [columns, labels, pageRowIds, selection])

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    if (!controlledSorting) setInternalSorting(next)
    onSortingChange?.(next)
  }

  const table = useReactTable({
    columns: tableColumns,
    data,
    defaultColumn: { minSize: 56, maxSize: 4096, size: 160 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getRowId,
    manualSorting,
    enableSortingRemoval: false,
    onSortingChange: handleSortingChange,
    state: { sorting },
  })

  const visibleColumns = table.getVisibleLeafColumns()
  const baseWidth = table.getTotalSize()
  const tableWidth = Math.ceil(Math.max(minWidth, baseWidth, viewportWidth))
  const renderedWidth = fillAvailableWidth ? tableWidth : baseWidth
  const { columnWidths, fillColumnId } = useMemo(() => {
    const fillId = fillAvailableWidth ? getFillColumnId(visibleColumns, renderedWidth, baseWidth) : undefined
    return { columnWidths: createRenderedColumnWidths(visibleColumns, fillId, renderedWidth - baseWidth), fillColumnId: fillId }
  }, [baseWidth, fillAvailableWidth, renderedWidth, visibleColumns])
  const renderedColumnsWidth = Array.from(columnWidths.values()).reduce((sum, width) => sum + width, 0)
  const fillerColumnWidth = fillAvailableWidth ? Math.max(0, tableWidth - renderedColumnsWidth) : 0
  const isEmpty = !isLoading && table.getRowModel().rows.length === 0
  const scrollStyle: CSSProperties = {
    ...(height !== undefined ? { height } : maxHeight !== undefined ? { maxHeight } : {}),
    ...(viewportWidth > 0 || !fillAvailableWidth ? {} : { visibility: 'hidden' }),
  }

  return (
    <div className={`data-table data-table-density-${density}`} data-fetching={isFetching && !isLoading ? 'true' : undefined}>
      <div ref={setScrollNode} className="data-table-scroll" style={scrollStyle}>
        <Table
          aria-busy={isLoading || isFetching || undefined}
          aria-label={ariaLabel}
          className="data-table-table"
          highlightOnHover={false}
          style={{ minWidth, width: fillAvailableWidth ? tableWidth : baseWidth }}
          withTableBorder={false}
        >
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.id} style={{ width: columnWidths.get(column.id) ?? column.getSize() }} />
            ))}
            {fillerColumnWidth > 0 ? <col style={{ width: fillerColumnWidth }} /> : null}
          </colgroup>
          <Table.Thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <DataTableHeaderCell
                    key={header.id}
                    columnWidth={columnWidths.get(header.column.id) ?? header.getSize()}
                    header={header}
                    isFillColumn={header.column.id === fillColumnId}
                    labels={labels}
                    sorted={header.column.getIsSorted()}
                  />
                ))}
                {fillerColumnWidth > 0 ? <Table.Th aria-hidden className="data-table-th data-table-filler-th" style={{ width: fillerColumnWidth }} /> : null}
              </Table.Tr>
            ))}
          </Table.Thead>
          <DataTableBody
            columnWidths={columnWidths}
            fillerColumnWidth={fillerColumnWidth}
            fillColumnId={fillColumnId}
            isLoading={isLoading && (!fillAvailableWidth || viewportWidth > 0)}
            selected={selection?.selected}
            table={table}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
          />
        </Table>
        {isEmpty ? (
          <div className="data-table-empty" style={{ width: viewportWidth ? `${viewportWidth}px` : '100%' }}>
            <div className="data-table-empty-content">{emptyText ?? labels.noData}</div>
          </div>
        ) : null}
      </div>
      {footer ? <div className="data-table-footer">{footer}</div> : null}
    </div>
  )
}

function toColumnDef<TData>(column: DataTableColumn<TData>, labels: DataTableLabels): ColumnDef<TData, unknown> {
  const meta: DataTableColumnMeta = {
    align: column.align ?? 'left',
    className: column.className,
    fill: column.fill,
    numeric: column.numeric,
  }
  return {
    id: column.id,
    header: () => column.header,
    accessorFn: column.accessor ?? (() => null),
    cell: (context) => (column.cell ? column.cell(context.row.original) : formatCellValue(context.getValue(), labels)),
    enableSorting: column.enableSorting ?? Boolean(column.accessor),
    sortDescFirst: column.sortDescFirst,
    maxSize: column.maxWidth,
    minSize: column.minWidth,
    size: column.width,
    meta,
  }
}

function createSelectColumn<TData>(selection: DataTableSelection, pageRowIds: string[], labels: DataTableLabels): ColumnDef<TData, unknown> {
  const selectedOnPage = pageRowIds.filter((id) => selection.selected.has(id)).length
  const allSelected = pageRowIds.length > 0 && selectedOnPage === pageRowIds.length

  function toggleAll(checked: boolean) {
    const next = new Set(selection.selected)
    for (const id of pageRowIds) {
      if (checked) next.add(id)
      else next.delete(id)
    }
    selection.onChange(next)
  }

  function toggleRow(id: string) {
    const next = new Set(selection.selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.onChange(next)
  }

  const meta: DataTableColumnMeta = { align: 'center', select: true }
  return {
    id: SELECT_COLUMN_ID,
    size: SELECT_COLUMN_WIDTH,
    minSize: SELECT_COLUMN_WIDTH,
    maxSize: SELECT_COLUMN_WIDTH,
    enableSorting: false,
    meta,
    header: () => (
      <Checkbox
        aria-label={labels.selectAll}
        checked={allSelected}
        disabled={pageRowIds.length === 0}
        indeterminate={selectedOnPage > 0 && !allSelected}
        size="xs"
        onChange={(event) => toggleAll(event.currentTarget.checked)}
      />
    ),
    cell: (context) => (
      <Checkbox
        aria-label={selection.rowLabel?.(context.row.id) ?? labels.selectRow}
        checked={selection.selected.has(context.row.id)}
        size="xs"
        onChange={() => toggleRow(context.row.id)}
      />
    ),
  }
}

function formatCellValue(value: unknown, labels: DataTableLabels): string {
  if (value === null || value === undefined || value === '') return labels.emptyValue
  if (typeof value === 'boolean') return value ? labels.yes : labels.no
  return String(value)
}
