import { IconFileText, IconPhoto } from '@tabler/icons-react'
import { shortWhen } from '@/shared/lib/when'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { TableChip } from '@/shared/ui/TableChip'
import type { PageListItem, ServiceDirection } from '../api/contentApi'

export const pagesColumns: DataTableColumn<PageListItem>[] = [
  {
    id: 'title',
    header: 'Сторінка',
    accessor: (row) => row.title,
    fill: true,
    width: 300,
    minWidth: 220,
    cell: (row) => (
      <span className="app-split-name-cell">
        <span className="app-split-kind-icon">
          <IconFileText size={16} stroke={1.6} />
        </span>
        <span className="app-split-row-text">
          <span className="app-split-item-name">{row.title}</span>
          <span className="app-split-row-sub">/{row.slug}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'updatedAt',
    header: 'Оновлено',
    accessor: (row) => row.updatedAt,
    sortDescFirst: true,
    width: 190,
    cell: (row) => <span className="app-split-item-meta">{shortWhen(row.updatedAt)}</span>,
  },
]

export const servicesColumns: DataTableColumn<ServiceDirection>[] = [
  {
    id: 'sortOrder',
    header: 'Порядок',
    accessor: (row) => row.sortOrder,
    align: 'right',
    numeric: true,
    width: 96,
    cell: (row) => <span className="app-split-item-count">{row.sortOrder}</span>,
  },
  {
    id: 'name',
    header: 'Напрямок',
    accessor: (row) => row.name,
    fill: true,
    width: 300,
    minWidth: 220,
    cell: (row) => (
      <span className="app-split-name-cell">
        <span className="content-thumb">{row.imageUrl ? <img src={row.imageUrl} alt="" loading="lazy" /> : <IconPhoto size={15} stroke={1.5} aria-hidden="true" />}</span>
        <span className="app-split-row-text">
          <span className="app-split-item-name">{row.name}</span>
          <span className="app-split-row-sub">{row.description ?? 'без опису'}</span>
        </span>
      </span>
    ),
  },
  {
    id: 'isVisible',
    header: 'На сайті',
    accessor: (row) => row.isVisible,
    width: 150,
    cell: (row) => (row.isVisible ? <TableChip dot tone="success" value="Показується" /> : <TableChip dot tone="neutral" value="Прихований" />),
  },
]
