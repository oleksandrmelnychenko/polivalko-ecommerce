import { ActionIcon, Checkbox, Skeleton, Tooltip } from '@mantine/core'
import { IconExternalLink, IconPhoto } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { sized } from '@polivalko/shared/lib/images'
import { siteUrl } from '@/shared/lib/siteUrl'
import { Money, NumberValue } from '@/shared/ui/Money'
import { TableChip } from '@/shared/ui/TableChip'
import type { ProductRow } from '../api/catalogApi'
import { productHref, productName } from '../lib/productFilters'
import { LabelChip } from './LabelChip'
import { LOW_STOCK, StockText } from './StockText'

const TILE_SIZES = 'calc((100vw - 120px) / 6)'

type TilesSelection = {
  selected: ReadonlySet<string>
  onChange: (ids: ReadonlySet<string>) => void
}

type ProductsTilesProps = {
  rows: ProductRow[]
  isLoading: boolean
  isFetching: boolean
  skeletons: number
  emptyText: ReactNode
  selection?: TilesSelection
}

export function ProductsTiles({ rows, isLoading, isFetching, skeletons, emptyText, selection }: ProductsTilesProps) {
  const selectedOnPage = selection ? rows.filter((row) => selection.selected.has(row.id)).length : 0
  const allSelected = rows.length > 0 && selectedOnPage === rows.length

  function toggleAll(checked: boolean) {
    if (!selection) return
    const next = new Set(selection.selected)
    for (const row of rows) {
      if (checked) next.add(row.id)
      else next.delete(row.id)
    }
    selection.onChange(next)
  }

  function toggle(id: string) {
    if (!selection) return
    const next = new Set(selection.selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.onChange(next)
  }

  return (
    <div className="catalog-tiles-view" aria-busy={isLoading || isFetching || undefined}>
      {selection && !isLoading && rows.length > 0 ? (
        <div className="catalog-tiles-head">
          <Checkbox
            size="xs"
            label="Вибрати всі на сторінці"
            checked={allSelected}
            indeterminate={selectedOnPage > 0 && !allSelected}
            onChange={(event) => toggleAll(event.currentTarget.checked)}
          />
        </div>
      ) : null}
      {isLoading ? (
        <ul className="catalog-tiles" aria-label="Товари">
          {Array.from({ length: skeletons }, (_, index) => (
            <li key={index} className="catalog-tile is-skeleton" aria-hidden="true">
              <Skeleton className="catalog-tile-photo" />
              <div className="catalog-tile-body">
                <Skeleton height={10} width="60%" />
                <Skeleton height={12} />
                <Skeleton height={12} width="80%" />
                <Skeleton height={18} width="40%" mt={6} />
              </div>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="catalog-tiles-empty">{emptyText}</div>
      ) : (
        <ul className="catalog-tiles" aria-label="Товари" data-fetching={isFetching || undefined}>
          {rows.map((row) => (
            <ProductTile key={row.id} row={row} selected={selection?.selected.has(row.id) ?? false} onToggle={selection ? () => toggle(row.id) : undefined} />
          ))}
        </ul>
      )}
    </div>
  )
}

type ProductTileProps = {
  row: ProductRow
  selected: boolean
  onToggle?: () => void
}

function ProductTile({ row, selected, onToggle }: ProductTileProps) {
  const name = productName(row)
  return (
    <li className="catalog-tile" data-selected={selected || undefined} data-hidden={!row.isVisible || undefined}>
      <div className="catalog-tile-photo">
        {row.imageUrl ? (
          <img {...sized(row.imageUrl, TILE_SIZES, 330)} alt="" loading="lazy" />
        ) : (
          <span className="catalog-tile-photo-empty">
            <IconPhoto size={28} stroke={1.4} aria-hidden="true" />
            Фото ще немає
          </span>
        )}
        {row.labels.length > 0 ? (
          <span className="catalog-tile-labels">
            {row.labels.map((label) => (
              <LabelChip key={label.id} name={label.name} tone={label.tone} />
            ))}
          </span>
        ) : null}
        {onToggle ? (
          <span className="catalog-tile-check">
            <Checkbox size="xs" aria-label={`Вибрати «${name}»`} checked={selected} onChange={onToggle} />
          </span>
        ) : null}
        <Tooltip label="На сайті">
          <ActionIcon
            component="a"
            className="catalog-tile-site"
            href={siteUrl(`/product/${row.slug}`)}
            target="_blank"
            rel="noopener"
            variant="default"
            aria-label={`Відкрити «${name}» на сайті`}
          >
            <IconExternalLink size={16} stroke={1.7} />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className="catalog-tile-body">
        <span className="catalog-tile-meta">
          <span className="catalog-code">{row.sku}</span> · {row.categoryName}
        </span>
        <Link to={productHref(row.id)} className="catalog-tile-name" title={name}>
          {name}
        </Link>
        <div className="catalog-tile-price">
          <Money value={row.price} />
          {row.stock > LOW_STOCK ? (
            <span className="catalog-tile-stock">
              Залишок <NumberValue value={row.stock} />
            </span>
          ) : (
            <StockText stock={row.stock} />
          )}
        </div>
        <div className="catalog-tile-foot">
          {row.isVisible ? <TableChip tone="success" dot value="Показується" /> : <TableChip value="Прихований" />}
          {row.hasDescription ? null : <TableChip tone="warning" value="Без опису" />}
        </div>
      </div>
    </li>
  )
}
