import type { ReactNode } from 'react'
import type { SortingState } from '@tanstack/react-table'

export type DataTableSortingState = SortingState
export type DataTableDensity = 'compact' | 'normal'
export type DataTableAlign = 'left' | 'center' | 'right'

export type DataTableColumn<TData> = {
  id: string
  header: ReactNode
  accessor?: (row: TData) => unknown
  cell?: (row: TData) => ReactNode
  width?: number
  minWidth?: number
  maxWidth?: number
  align?: DataTableAlign
  className?: string
  numeric?: boolean
  fill?: boolean
  enableSorting?: boolean
  sortDescFirst?: boolean
}

export type DataTableSelection = {
  selected: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
  rowLabel?: (rowId: string) => string
}

export type DataTableLabels = {
  noData: string
  loadingData: string
  emptyValue: string
  yes: string
  no: string
  sortAscending: string
  sortDescending: string
  selectAll: string
  selectRow: string
}

export type DataTableProps<TData> = {
  columns: DataTableColumn<TData>[]
  data: TData[]
  getRowId: (row: TData, index: number) => string
  isLoading?: boolean
  isFetching?: boolean
  minWidth?: number
  fillAvailableWidth?: boolean
  height?: string | number
  maxHeight?: string | number
  density?: DataTableDensity
  emptyText?: ReactNode
  labels?: Partial<DataTableLabels>
  manualSorting?: boolean
  sorting?: DataTableSortingState
  onSortingChange?: (sorting: DataTableSortingState) => void
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
  selection?: DataTableSelection
  footer?: ReactNode
  ariaLabel?: string
}

export type DataTableColumnMeta = {
  align?: DataTableAlign
  className?: string
  fill?: boolean
  numeric?: boolean
  select?: boolean
}
