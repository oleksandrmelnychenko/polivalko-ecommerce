import type { Column } from '@tanstack/react-table'
import type { DataTableColumnMeta } from './types'

export function getFillColumnId<TData>(columns: Column<TData, unknown>[], tableWidth: number, baseTableWidth: number): string | undefined {
  if (tableWidth <= baseTableWidth) return undefined
  const preferred = columns.find((column) => (column.columnDef.meta as DataTableColumnMeta | undefined)?.fill)
  if (preferred) return preferred.id
  const pool = columns.filter((column) => !(column.columnDef.meta as DataTableColumnMeta | undefined)?.select)
  const dataColumns = pool.filter((column) => column.getCanSort())
  const candidates = dataColumns.length > 0 ? dataColumns : pool
  if (candidates.length === 0) return undefined
  return candidates.reduce((widest, column) => (column.getSize() > widest.getSize() ? column : widest)).id
}

export function createRenderedColumnWidths<TData>(
  columns: Column<TData, unknown>[],
  fillColumnId: string | undefined,
  extraWidth: number,
): ReadonlyMap<string, number> {
  const widths = new Map<string, number>()
  for (const column of columns) {
    widths.set(column.id, Math.round(column.getSize() + (column.id === fillColumnId ? Math.max(0, extraWidth) : 0)))
  }
  return widths
}
