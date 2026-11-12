import { ActionIcon, Tooltip } from '@mantine/core'
import { IconExternalLink } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@polivalko/shared/lib/format'
import { siteUrl } from '@/shared/lib/siteUrl'
import type { DataTableColumn } from '@/shared/ui/data-table/types'
import { Money } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { ProductRow } from '../api/catalogApi'
import { productHref, productName } from '../lib/productFilters'
import { LabelChip } from './LabelChip'
import { ProductThumb } from './ProductThumb'
import { StockText } from './StockText'

export const productsColumns: DataTableColumn<ProductRow>[] = [
  {
    id: 'photo',
    header: 'Фото',
    width: 64,
    align: 'center',
    cell: (row) => <ProductThumb url={row.imageUrl} />,
  },
  {
    id: 'name',
    header: 'Назва',
    width: 280,
    minWidth: 200,
    fill: true,
    cell: (row) => (
      <Link className="catalog-product-name" to={productHref(row.id)} title={productName(row)}>
        {productName(row)}
      </Link>
    ),
  },
  { id: 'sku', header: 'Артикул', width: 130, cell: (row) => <span className="catalog-code">{row.sku}</span> },
  { id: 'category', header: 'Категорія', width: 190, cell: (row) => <span className="catalog-ellipsis">{row.categoryName}</span> },
  {
    id: 'labels',
    header: 'Мітки',
    width: 170,
    cell: (row) =>
      row.labels && row.labels.length > 0 ? (
        <span className="catalog-label-list">
          {row.labels.map((label) => (
            <LabelChip key={label.id} name={label.name} tone={label.tone} />
          ))}
        </span>
      ) : (
        <span className="catalog-muted">немає</span>
      ),
  },
  { id: 'price', header: 'Ціна', width: 120, align: 'right', numeric: true, className: 'catalog-cell-strong', cell: (row) => <Money value={row.price} /> },
  { id: 'stock', header: 'Залишок', width: 120, align: 'right', numeric: true, className: 'catalog-cell-strong', cell: (row) => <StockText stock={row.stock} /> },
  {
    id: 'visible',
    header: 'На сайті',
    width: 136,
    cell: (row) => (row.isVisible ? <TableChip tone="success" dot value="Показується" /> : <TableChip value="Прихований" />),
  },
  { id: 'updated', header: 'Змінено', width: 170, cell: (row) => <span className="catalog-muted">{formatDateTime(row.updatedAt)}</span> },
  {
    id: 'site',
    header: <span className="visually-hidden">Дії</span>,
    width: 56,
    align: 'center',
    cell: (row) => (
      <Tooltip label="На сайті">
        <ActionIcon
          component="a"
          href={siteUrl(`/product/${row.slug}`)}
          target="_blank"
          rel="noopener"
          variant="subtle"
          color="gray"
          aria-label={`Відкрити «${productName(row)}» на сайті`}
        >
          <IconExternalLink size={16} stroke={1.7} />
        </ActionIcon>
      </Tooltip>
    ),
  },
]
