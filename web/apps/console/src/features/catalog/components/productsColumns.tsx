import { IconArrowUpRight } from '@tabler/icons-react'
import { Link, useLocation } from 'react-router-dom'
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

function ProductIdentity({ row }: { row: ProductRow }) {
  const { search } = useLocation()
  const name = productName(row)
  return (
    <div className="catalog-row-identity">
      <ProductThumb url={row.imageUrl} size={44} />
      <Link className="catalog-product-name" to={{ pathname: productHref(row.id), search }} state={{ fromProductList: true }} title={name}>{name}</Link>
    </div>
  )
}

function CategoryAndLabels({ row }: { row: ProductRow }) {
  return (
    <div className="catalog-row-category">
      <span>{row.categoryName}</span>
      {(!!row.labels?.length || !row.hasDescription) && (
        <span className="catalog-label-list">
          {row.labels?.map((label) => <LabelChip key={label.id} name={label.name} tone={label.tone} />)}
          {row.hasDescription ? null : <TableChip tone="warning" value="Без опису" />}
        </span>
      )}
    </div>
  )
}

function SiteLink({ row }: { row: ProductRow }) {
  return (
    <a className="catalog-row-site" data-visible={row.isVisible} href={siteUrl(`/product/${row.slug}`)}
      target="_blank" rel="noopener" aria-label={`Відкрити «${productName(row)}» на сайті (${row.isVisible ? 'показується' : 'прихований'})`}>
      {row.isVisible ? 'Показується' : 'Прихований'} <IconArrowUpRight size={14} aria-hidden="true" />
    </a>
  )
}

function UpdatedAt({ row }: { row: ProductRow }) {
  return <time className="catalog-row-date" dateTime={row.updatedAt}>{formatDateTime(row.updatedAt)}</time>
}

const skuColumn: DataTableColumn<ProductRow> = {
  id: 'sku',
  header: 'Артикул',
  width: 104,
  className: 'catalog-sku-column',
  cell: (row) => <span className="catalog-row-sku">{row.sku}</span>,
}

export const productsColumns: DataTableColumn<ProductRow>[] = [
  { id: 'name', header: 'Товар', width: 285, fill: true, cell: (row) => <ProductIdentity row={row} /> },
  skuColumn,
  { id: 'price', header: 'Ціна', width: 120, align: 'right', numeric: true, className: 'catalog-cell-strong', cell: (row) => <Money value={row.price} /> },
  { id: 'stock', header: 'Залишок', width: 108, align: 'right', numeric: true, className: 'catalog-cell-strong', cell: (row) => <StockText stock={row.stock} /> },
  { id: 'category', header: 'Категорія та мітки', width: 174, cell: (row) => <CategoryAndLabels row={row} /> },
  { id: 'visible', header: 'На сайті', width: 140, cell: (row) => <SiteLink row={row} /> },
  { id: 'updated', header: 'Змінено', width: 142, cell: (row) => <UpdatedAt row={row} /> },
]

export const mobileProductsColumns: DataTableColumn<ProductRow>[] = [
  {
    id: 'product', header: 'Товар', width: 146, fill: true,
    cell: (row) => (
      <div className="catalog-row-mobile">
        <ProductIdentity row={row} />
        <CategoryAndLabels row={row} />
        <dl className="catalog-row-figures">
          <div><dt>Ціна</dt><dd><Money value={row.price} /></dd></div>
          <div><dt>Залишок</dt><dd><StockText stock={row.stock} /></dd></div>
        </dl>
        <div className="catalog-row-foot"><SiteLink row={row} /><UpdatedAt row={row} /></div>
      </div>
    ),
  },
  { ...skuColumn, width: 80 },
]
