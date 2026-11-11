import { Skeleton } from '@mantine/core'
import { IconArrowRight, IconPhoto } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { thumb } from '@polivalko/shared/lib/images'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { Money } from '@/shared/ui/Money'
import { getProducts, type ProductRow, type ProductsQuery } from '../api/catalogApi'
import { productHref, productName } from '../lib/productFilters'
import { LabelChip } from './LabelChip'

const PREVIEW_SIZE = 12
const countFormat = new Intl.NumberFormat('uk-UA')

export function ProductTilesGrid({ items }: { items: readonly ProductRow[] }) {
  return (
    <ul className="catalog-preview-grid">
      {items.map((product) => (
        <li key={product.id}>
          <Link to={productHref(product.id)} className="catalog-preview-product" data-hidden={!product.isVisible || undefined}>
            <span className="catalog-preview-photo">
              {product.imageUrl ? <img src={thumb(product.imageUrl, 250)} alt="" loading="lazy" /> : <IconPhoto size={22} stroke={1.4} aria-hidden="true" />}
              {product.labels.length ? (
                <span className="catalog-preview-labels">
                  {product.labels.map((label) => (
                    <LabelChip key={label.id} name={label.name} tone={label.tone} />
                  ))}
                </span>
              ) : null}
            </span>
            <span className="catalog-preview-name">{productName(product)}</span>
            <Money value={product.price} />
          </Link>
        </li>
      ))}
    </ul>
  )
}

type PreviewCardProps = {
  title: string
  aside?: ReactNode
  children: ReactNode
}

export function PreviewCard({ title, aside, children }: PreviewCardProps) {
  return (
    <section className="catalog-split-card" aria-label={title}>
      <header className="catalog-split-card-head">
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  )
}

type ProductPreviewGridProps = {
  title: string
  cacheKey: string
  filter: Omit<ProductsQuery, 'page' | 'pageSize'>
  listHref: string
  enabled: boolean
  emptyText: string
}

export function ProductPreviewGrid({ title, cacheKey, filter, listHref, enabled, emptyText }: ProductPreviewGridProps) {
  const preview = useApiQuery(cacheKey, () => getProducts({ ...filter, page: 1, pageSize: PREVIEW_SIZE }), { enabled })
  const total = preview.data?.totalItems ?? 0
  const items = preview.data?.items ?? []

  return (
    <PreviewCard
      title={title}
      aside={
        enabled && total > 0 ? (
          <Link to={listHref} className="catalog-preview-all">
            Усі {countFormat.format(total)} у списку товарів
            <IconArrowRight size={14} stroke={2} aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      {!enabled ? (
        <p className="catalog-split-blank">{emptyText}</p>
      ) : preview.isLoading ? (
        <div className="catalog-preview-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={190} radius={10} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="catalog-split-blank">{emptyText}</p>
      ) : (
        <ProductTilesGrid items={items} />
      )}
    </PreviewCard>
  )
}
