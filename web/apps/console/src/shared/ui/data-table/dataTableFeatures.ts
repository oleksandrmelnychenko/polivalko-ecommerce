import { columnSizingFeature, columnVisibilityFeature, createSortedRowModel, rowSortingFeature, sortFns, tableFeatures } from '@tanstack/react-table'

export const dataTableFeatures = tableFeatures({
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
})

export type DataTableFeatures = typeof dataTableFeatures
