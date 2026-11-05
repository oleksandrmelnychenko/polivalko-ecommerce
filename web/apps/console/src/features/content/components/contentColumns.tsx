import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { CellStack } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { PageListItem, ServiceDirection } from '../api/contentApi'
import { pageEditorHref } from '../lib/contentLinks'

export const pagesColumns: DataTableColumn<PageListItem>[] = [
  {
    id: 'title',
    header: 'Сторінка',
    accessor: (row) => row.title,
    fill: true,
    width: 280,
    cell: (row) => <CellStack title={<Link to={pageEditorHref(row.slug)}>{row.title}</Link>} />,
  },
  {
    id: 'slug',
    header: 'Адреса на сайті',
    accessor: (row) => row.slug,
    width: 240,
    cell: (row) => (
      <a href={siteUrl(`/${row.slug}`)} className="content-code" target="_blank" rel="noopener">
        /{row.slug}
      </a>
    ),
  },
  {
    id: 'updatedAt',
    header: 'Оновлено',
    accessor: (row) => row.updatedAt,
    sortDescFirst: true,
    width: 240,
    cell: (row) => <CellStack title={formatDateTime(row.updatedAt)} sub={row.updatedBy ?? undefined} />,
  },
]

export const servicesColumns: DataTableColumn<ServiceDirection>[] = [
  {
    id: 'sortOrder',
    header: 'Порядок',
    accessor: (row) => row.sortOrder,
    align: 'right',
    numeric: true,
    width: 104,
  },
  {
    id: 'image',
    header: 'Фото',
    width: 104,
    cell: (row) =>
      row.imageUrl ? (
        <span className="content-thumb">
          <img src={row.imageUrl} alt="" loading="lazy" />
        </span>
      ) : (
        <span className="content-muted">немає</span>
      ),
  },
  {
    id: 'name',
    header: 'Напрямок',
    accessor: (row) => row.name,
    width: 280,
    cell: (row) => <CellStack title={row.name} sub={row.code} />,
  },
  {
    id: 'description',
    header: 'Опис',
    fill: true,
    width: 360,
    cell: (row) => (row.description ? <span className="content-clamp">{row.description}</span> : <span className="content-muted">немає</span>),
  },
  {
    id: 'isVisible',
    header: 'На сайті',
    accessor: (row) => row.isVisible,
    width: 190,
    cell: (row) => (row.isVisible ? <TableChip dot tone="success" value="Показується" /> : <TableChip dot tone="neutral" value="Прихований на сайті" />),
  },
]
